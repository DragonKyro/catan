# training/

Offline tooling for the learned Catan AI. Nothing here ships to GitHub Pages:
it runs the real game engine headlessly (no React, no timers) for a Python
learner to train against and evaluate with.

Currently: **base-game Catan, 4 players** (the network plays any player count;
the standard board only — expansions and Fun Maps keep the heuristic AI). The
game-side pieces (knowledge tracker, observation, encoder, action space,
reward) live in `src/ai/nn/`; see CLAUDE.md.

## Setup

Uses the same conda env as card-collecting (`train`: Python 3.11, PyTorch
CUDA, numpy, tensorboard, pytest), e.g. `C:\ProgramData\anaconda3\envs\train`.

```sh
conda activate train
npm run train:build                              # bundle the TS side → training/dist/catan-env.mjs
python -m pytest training/catan -q               # export round trip, train → checkpoint → resume → evaluate
python training/catan/env_client.py              # random-agent smoke test of the Python ↔ Node bridge
python training/catan/bench_model.py             # network speed / memory on this GPU
```

`train.py` rebuilds `training/dist` itself at start (skip with `--no-build`).

## Training

```sh
python training/catan/train.py --run main              # Ctrl+C any time: saves, then exits
python training/catan/train.py --run main --resume     # carry on to --updates (default 10000)
tensorboard --logdir training/runs
```

To stop a run you can't Ctrl+C (one started in the background), create an
empty `training/runs/catan/<run>/STOP`; it saves and exits after the current
update. Run the same command with `--resume` to carry on.

PPO from scratch. Each update collects `--rollout` (32) decisions from every
match: `--workers` (default cores − 6, max 14) node processes ×
`--envs-per-worker` (32) matches, ~14k decisions. Workers come in three kinds:

- **self** (`--self-play`, half): all four seats are the network being trained.
- **heuristic** (`--vs-heuristic`, a quarter): one learner seat, three seats of
  the hand-written AI in `src/ai`.
- **past** (the rest): one learner seat, three seats of a checkpoint drawn from
  the newest `--pool` (20), re-drawn every `--pool-refresh` (10) updates
  (`--past-opponents` distinct ones at a time). Heuristic seats until the first
  checkpoint exists.

The lone learner seat rotates round the table match by match. Networks always
run in this Python process (GPU-batched); heuristic seats play inside node.
Workers run in two interleaved groups so env time and GPU time overlap.

Reward (`src/ai/nn/reward.ts`): at match end, win + placement + VP share,
centred on the table (10/8/6/4 VP → +1.15 / −0.12 / −0.38 / −0.65); a match
cut off at `--max-turns` (200 dice rolls) costs every seat −0.5 extra. Plus
potential-based shaping, `--vp-shaping` (0.5) × ΔVP / 10 whenever a seat's VP
changes, paid back at the end so it sums to zero per match.

The network (`model.py`) is a graph net over the board: hexes, vertices and
edges exchange messages for `--rounds` (4) rounds at `--width` (64), with a
global vector for hands, dev cards, dice and opponents; per-vertex / per-edge /
per-hex logits for spatial actions, a head for the 119 global slots, and a
value head. ~0.5M parameters. The trunk runs in bfloat16 on CUDA (`--no-amp`
for float32).

### What it reports

Every update, one line in the log:

```
u  1234 |  17.69M dec | 2.9k/s | pi -0.004 kl 0.0061 clip 0.07 v 0.031 ent 1.42 ev +0.58 | heur: win  21% place 2.71 vp  6.4 | past: win  26% place 2.48 vp  7.1 |  71 turns, 1% cut | 4.9s/u, ETA 11h47m
```

- `heur` / `past`: the learner's last 400 matches against three heuristic AIs /
  three past checkpoints — win rate (**25% = parity** at 4 players), mean place
  (1 = first, 4 = last, 2.5 average) and mean VP. These come from the
  *sampling* policy; trust the evals below.
- `turns` / `cut`: match length in dice rolls, share of matches that hit the cap.
- PPO health: `kl` (should stay ≲ 0.02), `clip` (≲ 0.2), `ent` (falls slowly),
  `ev` (value explained variance, rises toward 1).

Every `--save-every` (100) updates: `ckpt/update_N.pt` (newest `--keep-ckpt`
kept) and `policies/update_N.json` (all kept). Every `--eval-every` (100), in
background processes: `--eval-games` (400) greedy matches vs three heuristic
AIs, and vs three copies of the checkpoint 500 updates earlier, on fixed deals
never trained on. Results print as they land, go to tensorboard `eval/*` and
`evals.jsonl`, and once a checkpoint's evals are in, the log prints the latest
10 as a table and `progress.md` is rewritten:

| update | hours | decisions | vs heuristic: win (95% CI) | place | VP | turns | vs 500 updates earlier: win (95% CI) | place |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|

A rising win rate vs the heuristic, and a score above 25% vs 500 updates
earlier, mean it's still improving. Win rate vs the earlier self drifting back
toward 25% means progress is flattening.

| Path | What |
|---|---|
| `train.log` | the log (when started from `train.cmd`) |
| `progress.md` | the eval table, latest 10 then every checkpoint |
| `metrics.jsonl`, `tb/` | per-update losses, entropy, KL, explained variance, throughput, training results |
| `evals.jsonl` | every eval result |
| `config.json` | the arguments, encoder / action-space versions, architecture |

## Evaluating

```sh
python training/catan/evaluate.py match training/runs/catan/main heuristic --games 400
python training/catan/evaluate.py match training/runs/catan/main@5000 training/runs/catan/main@1000
python training/catan/evaluate.py progress training/runs/catan/main --vs heuristic --every 1000
```

Agents: `heuristic`, a policy `.json`, a run directory (its latest policy), or
`RUN@N`. Agent A takes one seat (rotating), agent B every other seat.

## Pieces

| File | Role |
|---|---|
| `catan/train.py` | PPO trainer, worker kinds, opponent pool, checkpoints, background evals, progress table |
| `catan/model.py` | graph policy/value network, policy-file export / load, checkpoint I/O |
| `catan/evaluate.py` | seat-rotated eval API + CLI (`match`, `progress`) |
| `catan/env_client.py` | Python `CatanEnv` client, plus a random-agent smoke test |
| `catan/bench_model.py` | network speed / memory on this GPU |
| `catan/test_training.py` | pytest: export round trip, topology, bridge, train → resume → evaluate |
| `catan/vec-env.ts` | `CatanVecEnv`: N matches, seat roles, heuristic seats, rewards, auto-reset, quotas for evals |
| `catan/env-server.ts` | stdio wrapper around `CatanVecEnv` (protocol in the file header; batch replies carry raw bytes) |
| `catan/vec-env.test.ts` | vitest: random self-play and vs-heuristic matches, rotation, quotas |

## Versioning

`ENCODER_VERSION` (`src/ai/nn/encode.ts`) and `ACTION_SPACE_VERSION`
(`src/ai/nn/actions.ts`) are pinned by tests with the feature / slot sizes.
Checkpoints and policy files record both and refuse to load on a mismatch —
retrain after changing either.
