"""PPO trainer for the base-game Catan agent (4 players by default).

    conda activate train
    python training/catan/train.py --run main             # Ctrl+C any time: it checkpoints, then exits
    python training/catan/train.py --run main --resume
    tensorboard --logdir training/runs

To stop a run you can't Ctrl+C (e.g. one started in the background), create
an empty file training/runs/catan/<run>/STOP: it saves, finishes queued evals
and exits after the current update (the file is removed on the next start).

Each update:
  1. Collect `--rollout` decisions from every env — `--workers` node processes
     × `--envs-per-worker` matches. Three kinds of worker:
       self       all four seats are the learner
       heuristic  one learner seat, three seats of the hand-written AI (src/ai)
       past       one learner seat, three seats of a past checkpoint drawn from
                  the newest `--pool` (heuristic seats until a checkpoint exists)
     The lone learner seat rotates round the table match by match.
  2. PPO on every finished transition, per (match, seat) stream.
  3. Every `--save-every`: a resumable checkpoint (ckpt/update_N.pt) and an
     exported policy (policies/update_N.json, all kept) — the opponent pool,
     evals and the game's future AI levels read these.
  4. Every `--eval-every`: in the background (separate processes), greedy
     seat-rotated matches of the new policy vs three heuristic AIs and vs
     three copies of the checkpoint `--eval-past-gap` saves earlier → tensorboard
     `eval/*`, evals.jsonl, and progress.md (latest 10 checkpoints, then all).

Reported every update (train.log): throughput, PPO health (KL, clip fraction,
entropy, explained variance), the learner's recent results per worker kind
(win rate — 25% is parity at 4 players —, mean place, mean VP), match length,
how many matches hit the turn cap, and the ETA to `--updates`.

Outputs go to training/runs/catan/<run>/: config.json, metrics.jsonl,
evals.jsonl, progress.md, tensorboard events, ckpt/, policies/.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import queue
import random
import shutil
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.tensorboard import SummaryWriter

import evaluate as ev
from env_client import ROLE_LEARNER, ROLE_OPPONENT, Batch, CatanEnv
from model import (CatanNet, Topology, export_policy, load_checkpoint, load_policy, masked_logits,
                   net_from_checkpoint, save_checkpoint)

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
DEFAULT_RUNS = os.path.join(REPO, "training", "runs", "catan")


def default_workers() -> int:
    """Leave cores for the learner and the background evals."""
    return max(1, min(14, (os.cpu_count() or 4) - 6))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    run = p.add_argument_group("run")
    run.add_argument("--run", default=None, help="run name (default: a timestamp)")
    run.add_argument("--runs-dir", default=DEFAULT_RUNS)
    run.add_argument("--resume", action="store_true", help="continue the run from its latest checkpoint")
    run.add_argument("--updates", type=int, default=10_000, help="train until this many updates in total")
    run.add_argument("--seed", type=int, default=1)
    run.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    run.add_argument("--no-amp", action="store_true", help="float32 trunk (default: bfloat16 trunk on CUDA)")
    run.add_argument("--no-build", action="store_true", help="skip rebuilding training/dist")

    game = p.add_argument_group("game / envs")
    game.add_argument("--players", type=int, default=4)
    game.add_argument("--workers", type=int, default=default_workers(), help="node env processes")
    game.add_argument("--envs-per-worker", type=int, default=32)
    game.add_argument("--rollout", type=int, default=32, help="decisions per env per update")
    game.add_argument("--self-play", type=float, default=0.5, help="share of workers in self-play")
    game.add_argument("--vs-heuristic", type=float, default=0.25,
                      help="share of workers with three heuristic-AI seats; the rest face past checkpoints")
    game.add_argument("--pool", type=int, default=20, help="newest checkpoints past opponents are drawn from")
    game.add_argument("--pool-refresh", type=int, default=10, help="updates between past-opponent re-draws")
    game.add_argument("--past-opponents", type=int, default=2,
                      help="distinct past checkpoints in play at once (shared round-robin by past workers)")
    game.add_argument("--max-turns", type=int, default=200, help="dice rolls before a match is cut off")
    game.add_argument("--vp-shaping", type=float, default=0.5,
                      help="potential-based shaping: this × ΔVP / target per VP change (sums to zero per match)")

    learn = p.add_argument_group("learning")
    learn.add_argument("--width", type=int, default=64)
    learn.add_argument("--rounds", type=int, default=4, help="message-passing rounds")
    learn.add_argument("--lr", type=float, default=3e-4)
    learn.add_argument("--anneal-lr", action="store_true", help="decay lr linearly to 0 at --updates")
    learn.add_argument("--epochs", type=int, default=4)
    learn.add_argument("--minibatch", type=int, default=2048)
    learn.add_argument("--gamma", type=float, default=0.997)
    learn.add_argument("--lam", type=float, default=0.95)
    learn.add_argument("--clip", type=float, default=0.2)
    learn.add_argument("--ent-coef", type=float, default=0.01)
    learn.add_argument("--vf-coef", type=float, default=0.5)
    learn.add_argument("--max-grad-norm", type=float, default=0.5)

    save = p.add_argument_group("checkpoints / eval")
    save.add_argument("--save-every", type=int, default=100)
    save.add_argument("--keep-ckpt", type=int, default=5, help="resumable .pt files to keep (policies are all kept)")
    save.add_argument("--eval-every", type=int, default=100, help="0 = no background eval (multiple of --save-every)")
    save.add_argument("--eval-games", type=int, default=400)
    save.add_argument("--eval-workers", type=int, default=3)
    save.add_argument("--eval-past-gap", type=int, default=5, help="compare with the checkpoint this many saves back")
    return p.parse_args(argv)


# ---------------------------------------------------------------- envs

@dataclass
class Worker:
    role: str  # 'self' | 'heuristic' | 'past'
    env: CatanEnv
    batch: Batch | None = None
    opponent: CatanNet | None = None
    opponent_name: str = ""


def worker_roles(n: int, self_share: float, heuristic_share: float) -> list[str]:
    n_self = min(n, max(0, round(n * self_share)))
    n_heur = min(n - n_self, max(0, round(n * heuristic_share)))
    return ["self"] * n_self + ["heuristic"] * n_heur + ["past"] * (n - n_self - n_heur)


def seats_for(role: str, players: int, has_pool: bool) -> list[str]:
    if role == "self":
        return ["learner"] * players
    other = "opponent" if role == "past" and has_pool else "heuristic"
    return ["learner"] + [other] * (players - 1)


def build_typescript() -> None:
    vite = os.path.join(REPO, "node_modules", "vite", "bin", "vite.js")
    node = shutil.which("node")
    if not node or not os.path.isfile(vite):
        raise FileNotFoundError("need node on PATH and `npm install` run in the repo")
    subprocess.run([node, vite, "build", "--config", os.path.join("training", "vite.config.ts")], cwd=REPO, check=True)


def to_device(batch_parts: list[np.ndarray], device: torch.device) -> list[torch.Tensor]:
    return [torch.from_numpy(np.ascontiguousarray(x)).to(device, non_blocking=True) for x in batch_parts]


def sample(net: CatanNet, obs: list[torch.Tensor], mask: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    with torch.no_grad():
        logits, value = net(*obs)
        dist = torch.distributions.Categorical(logits=masked_logits(logits, mask))
        action = dist.sample()
        return action, dist.log_prob(action), value


# ---------------------------------------------------------------- rollout storage

class Rollout:
    """Learner transitions for one update, in chronological order. Each
    (env, seat) is a stream: `next[i]` links a transition to that seat's
    following decision in the same match, so rewards and GAE follow the seat
    that earned them. A seat's newest transition is still collecting reward
    when the rollout ends — it is carried into the next update instead of
    being trained on."""

    FIELDS = ("hexes", "vertices", "edges", "glob", "mask", "action", "logp", "value", "reward", "done")

    def __init__(self, capacity: int, shape: dict, dims: dict):
        H, V, E = shape["hexes"], shape["vertices"], shape["edges"]
        self.hexes = np.zeros((capacity, H, dims["hex"]), np.float32)
        self.vertices = np.zeros((capacity, V, dims["vertex"]), np.float32)
        self.edges = np.zeros((capacity, E, dims["edge"]), np.float32)
        self.glob = np.zeros((capacity, dims["global"]), np.float32)
        self.mask = np.zeros((capacity, shape["slots"]), bool)
        self.action = np.zeros(capacity, np.int64)
        self.logp = np.zeros(capacity, np.float32)
        self.value = np.zeros(capacity, np.float32)
        self.reward = np.zeros(capacity, np.float32)
        self.done = np.zeros(capacity, bool)
        self.next = np.full(capacity, -1, np.int64)
        self.n = 0

    def clear(self) -> None:
        self.reward[: self.n] = 0
        self.done[: self.n] = False
        self.next[: self.n] = -1
        self.n = 0

    def add(self, **rows: np.ndarray) -> np.ndarray:
        k = len(rows["action"])
        at = np.arange(self.n, self.n + k)
        for name, values in rows.items():
            getattr(self, name)[at] = values
        self.n += k
        return at

    def take(self, idx: np.ndarray) -> dict:
        return {name: getattr(self, name)[idx].copy() for name in self.FIELDS}


# ---------------------------------------------------------------- background eval

class Evaluator:
    """Runs `evaluate.py match` jobs one at a time on a thread, each in its own
    process (own GIL, own CUDA context), so training never waits for an eval."""

    def __init__(self, games: int, workers: int, device: str, max_turns: int, players: int):
        self.games, self.workers, self.device = games, workers, device
        self.max_turns, self.players = max_turns, players
        self.jobs: queue.Queue = queue.Queue()
        self.results: queue.Queue = queue.Queue()
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def _loop(self) -> None:
        while True:
            job = self.jobs.get()
            if job is None:
                return
            update, tag, policy, opponent = job
            cmd = [sys.executable, "-u", os.path.join(HERE, "evaluate.py"), "match", policy, opponent,
                   "--games", str(self.games), "--workers", str(self.workers), "--device", self.device,
                   "--max-turns", str(self.max_turns), "--players", str(self.players), "--json"]
            try:
                out = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, encoding="utf-8")
                if out.returncode != 0:
                    raise RuntimeError(out.stderr.strip().splitlines()[-1] if out.stderr.strip() else f"exit {out.returncode}")
                summary = json.loads(out.stdout.strip().splitlines()[-1])
                self.results.put((update, tag, opponent, summary, None))
            except Exception as e:  # noqa: BLE001 — reported, training carries on
                self.results.put((update, tag, opponent, None, str(e)))

    def submit(self, update: int, policy: str, jobs: list[tuple[str, str]]) -> bool:
        """Queue one eval cycle of (tag, opponent) jobs; refuse while the
        previous cycle hasn't fully started."""
        if self.jobs.qsize() > 0:
            return False
        for tag, opponent in jobs:
            self.jobs.put((update, tag, policy, opponent))
        return True

    def drain(self) -> list[tuple]:
        out = []
        while True:
            try:
                out.append(self.results.get_nowait())
            except queue.Empty:
                return out

    def close(self, drop_queued: bool) -> None:
        """Wait for the running eval, and for queued ones unless `drop_queued`."""
        while drop_queued:
            try:
                self.jobs.get_nowait()
            except queue.Empty:
                break
        self.jobs.put(None)
        self.thread.join()


# ---------------------------------------------------------------- trainer

def fmt_duration(seconds: float) -> str:
    seconds = max(0, int(seconds))
    h, m = divmod(seconds // 60, 60)
    return f"{h}h{m:02d}m" if h else f"{m}m{seconds % 60:02d}s"


@dataclass
class Trainer:
    args: argparse.Namespace
    run_dir: str = ""
    workers: list[Worker] = field(default_factory=list)
    update: int = 0
    decisions: int = 0
    learner_decisions: int = 0
    episodes: int = 0
    train_seconds: float = 0.0

    def setup(self) -> None:
        a = self.args
        name = a.run or time.strftime("%Y%m%d-%H%M%S")
        self.run_dir = os.path.join(a.runs_dir, name)
        if os.path.isdir(os.path.join(self.run_dir, "ckpt")) and not a.resume:
            raise SystemExit(f"{self.run_dir} already has checkpoints — pass --resume or pick another --run")
        os.makedirs(self.run_dir, exist_ok=True)
        if not a.no_build:
            build_typescript()
        random.seed(a.seed)
        np.random.seed(a.seed)
        torch.manual_seed(a.seed)
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        if a.device == "cpu":
            torch.set_num_threads(min(4, os.cpu_count() or 1))
        self.device = torch.device(a.device)

        probe = CatanEnv(players=a.players)
        self.dims, self.shape, self.num_globals = probe.dims, probe.shape, len(probe.global_slots)
        self.versions = probe.versions
        self.topology = Topology(probe.topology, probe.shape, self.device)
        probe.close()

        ckpt_dir = os.path.join(self.run_dir, "ckpt")
        ckpts = sorted(f for f in os.listdir(ckpt_dir) if f.endswith(".pt")) if a.resume and os.path.isdir(ckpt_dir) else []
        if ckpts:
            ck = load_checkpoint(os.path.join(ckpt_dir, ckpts[-1]), self.device)
            if ck["versions"] != self.versions:
                raise SystemExit(f"checkpoint was trained on {ck['versions']}, this build is {self.versions}")
            self.net = net_from_checkpoint(ck, self.device)
            self.opt = torch.optim.Adam(self.net.parameters(), lr=a.lr, eps=1e-5)
            self.opt.load_state_dict(ck["optimizer"])
            self.update, self.decisions, self.episodes = ck["update"], ck["decisions"], ck["episodes"]
            self.learner_decisions = ck.get("learner_decisions", 0)
            self.train_seconds = ck.get("train_seconds", 0.0)
            print(f"resumed {name} at update {self.update} ({self.decisions:,} decisions, "
                  f"{fmt_duration(self.train_seconds)} trained)")
        else:
            self.net = CatanNet(self.dims, self.num_globals, a.width, a.rounds).to(self.device)
            self.opt = torch.optim.Adam(self.net.parameters(), lr=a.lr, eps=1e-5)
        self.net.topology = self.topology
        self.net.amp = not a.no_amp
        n_params = sum(p.numel() for p in self.net.parameters())

        with open(os.path.join(self.run_dir, "config.json"), "w", encoding="utf-8") as f:
            json.dump({**vars(a), **self.versions, "dims": self.dims, "shape": self.shape,
                       "arch": self.net.arch, "params": n_params}, f, indent=2)

        has_pool = bool(ev.list_policies(self.run_dir))
        roles = worker_roles(a.workers, a.self_play, a.vs_heuristic)
        for w, role in enumerate(roles):
            env = CatanEnv(players=a.players)
            seed = a.seed * 10_007 + w * 7_919 + self.update * 104_729
            worker = Worker(role, env)
            worker.batch = env.reset(num_envs=a.envs_per_worker, seed=seed, seats=seats_for(role, a.players, False),
                                     max_turns=a.max_turns, vp_shaping=a.vp_shaping)
            self.workers.append(worker)
        self.n_envs = a.workers * a.envs_per_worker
        self.slices = [slice(i * a.envs_per_worker, (i + 1) * a.envs_per_worker) for i in range(a.workers)]
        # Two interleaved groups (each a mix of worker kinds) for pipelined collection.
        self.groups = [g for g in (list(range(0, a.workers, 2)), list(range(1, a.workers, 2))) if g]
        self.in_flight = [False] * a.workers
        print(f"run {self.run_dir}\n  {a.workers} workers ({', '.join(f'{roles.count(r)} {r}' for r in dict.fromkeys(roles))})"
              f" x {a.envs_per_worker} envs, {a.players} players | board {self.shape['hexes']} hexes, "
              f"{self.shape['slots']} slots | net {a.width}x{a.rounds} ({n_params:,} params) | device {self.device}"
              f"{' bf16' if self.net.amp and self.device.type == 'cuda' else ''}", flush=True)
        if has_pool:
            print("  (past checkpoints found — past workers switch from heuristic seats at the first refresh)")

        # Up to one carried (still pending) transition per seat, plus a decision per env per step.
        self.buf = Rollout(self.n_envs * (a.rollout + a.players), self.shape, self.dims)
        self.last = np.full((self.n_envs, a.players), -1, np.int64)
        self.carry: dict | None = None
        self.carry_streams: np.ndarray | None = None
        self.writer = SummaryWriter(os.path.join(self.run_dir, "tb"))
        self.evaluator = (Evaluator(a.eval_games, a.eval_workers, a.device, a.max_turns, a.players)
                          if a.eval_every > 0 else None)
        self.window: dict[str, collections.deque] = collections.defaultdict(lambda: collections.deque(maxlen=400))
        self.update_seconds: collections.deque = collections.deque(maxlen=50)
        self.eval_expected: dict[int, list[str]] = {}
        self.eval_results: dict[int, dict[str, dict]] = {}
        self.eval_meta: dict[int, dict] = {}
        self.progress_shown: set[int] = set()
        evals_path = os.path.join(self.run_dir, "evals.jsonl")
        if a.resume and os.path.isfile(evals_path):
            with open(evals_path, encoding="utf-8") as f:
                for line in f:
                    r = json.loads(line)
                    self.eval_results.setdefault(r["update"], {})[r["vs"]] = r
                    self.eval_meta[r["update"]] = {"hours": r.get("hours"), "decisions": r.get("decisions")}
            for u, res in self.eval_results.items():
                self.eval_expected[u] = list(res)
                self.progress_shown.add(u)

    # ------------------------------------------------------------ collection

    def collect(self) -> np.ndarray:
        """Fill the rollout; returns a mask of the transitions that are still
        pending (carried to the next update, not trained on now).

        Workers run in two interleaved groups: while one group's node
        processes compute their next states, this process runs the networks
        for the other group, so env time and GPU time overlap."""
        a, buf, last = self.args, self.buf, self.last
        buf.clear()
        last[:] = -1
        if self.carry is not None:
            rows = buf.add(**self.carry)
            last[self.carry_streams[:, 0], self.carry_streams[:, 1]] = rows
        for _ in range(a.rollout):
            for g in self.groups:
                if self.in_flight[g[0]]:
                    self.absorb(g)
                self.decide(g)
        for g in self.groups:
            self.absorb(g)

        pending = np.zeros(buf.n, bool)
        streams = np.argwhere(last >= 0)
        pending[last[streams[:, 0], streams[:, 1]]] = True
        self.carry = buf.take(last[streams[:, 0], streams[:, 1]])
        self.carry_streams = streams
        return pending

    def decide(self, group: list[int]) -> None:
        """Pick a slot for every env of these workers (learner rows go in the
        rollout) and send the actions off."""
        buf, last, dev = self.buf, self.last, self.device
        ws = [self.workers[k] for k in group]
        envs = np.concatenate([np.arange(self.slices[k].start, self.slices[k].stop) for k in group])
        batches = [w.batch for w in ws]
        role = np.concatenate([b.role for b in batches])
        seat = np.concatenate([b.seat for b in batches])
        parts = [np.concatenate([getattr(b, k) for b in batches]) for k in ("hexes", "vertices", "edges", "glob")]
        mask = np.concatenate([b.mask for b in batches])
        actions = np.zeros(len(envs), np.int64)

        learner = np.flatnonzero(role == ROLE_LEARNER)
        if len(learner):
            obs = to_device([p[learner] for p in parts], dev)
            action, logp, value = sample(self.net, obs, torch.from_numpy(mask[learner]).to(dev))
            action_np = action.cpu().numpy()
            actions[learner] = action_np
            rows = buf.add(hexes=parts[0][learner], vertices=parts[1][learner], edges=parts[2][learner],
                           glob=parts[3][learner], mask=mask[learner], action=action_np,
                           logp=logp.cpu().numpy(), value=value.cpu().numpy())
            env_ids, seats = envs[learner], seat[learner]
            prev = last[env_ids, seats]
            linked = prev >= 0
            buf.next[prev[linked]] = rows[linked]
            last[env_ids, seats] = rows

        # Past-checkpoint seats: one forward pass per distinct opponent network.
        by_net: dict[int, list[np.ndarray]] = {}
        nets: dict[int, CatanNet] = {}
        at = 0
        for w in ws:
            n = len(w.batch.role)
            if w.opponent is not None:
                rows_w = np.flatnonzero(w.batch.role == ROLE_OPPONENT) + at
                if len(rows_w):
                    by_net.setdefault(id(w.opponent), []).append(rows_w)
                    nets[id(w.opponent)] = w.opponent
            at += n
        for key, chunks in by_net.items():
            idx = np.concatenate(chunks)
            obs = to_device([p[idx] for p in parts], dev)
            action, _, _ = sample(nets[key], obs, torch.from_numpy(mask[idx]).to(dev))
            actions[idx] = action.cpu().numpy()

        at = 0
        for k, w in zip(group, ws):
            n = len(w.batch.role)
            w.env.send_step(actions[at:at + n])
            self.in_flight[k] = True
            at += n
        self.decisions += int((role >= 0).sum())
        self.learner_decisions += len(learner)

    def absorb(self, group: list[int]) -> None:
        """Receive these workers' next batches and credit their rewards and match ends."""
        buf, last = self.buf, self.last
        for k in group:
            w = self.workers[k]
            w.batch = w.env.recv_batch()
            self.in_flight[k] = False
            sl = self.slices[k]
            lw = last[sl]
            for s in range(self.args.players):
                ok = lw[:, s] >= 0
                buf.reward[lw[ok, s]] += w.batch.reward[ok, s]
                buf.done[lw[ok & w.batch.done, s]] = True
            lw[w.batch.done] = -1
            for ep in w.batch.episodes:
                self.episodes += 1
                self.record_episode(w.role, ep)

    def record_episode(self, role: str, ep: dict) -> None:
        self.window["all"].append({"turns": ep["turns"], "truncated": ep["truncated"]})
        if role == "self":
            return
        seat = ep["roles"].index("learner")
        kind = "past" if "opponent" in ep["roles"] else "heuristic"
        self.window[kind].append({
            "win": float(ep["winnerSeat"] == seat), "rank": ep["rank"][seat], "vp": ep["vp"][seat],
            "truncated": ep["truncated"],
        })

    def advantages(self, pending: np.ndarray) -> np.ndarray:
        a, buf = self.args, self.buf
        adv = np.zeros(buf.n, np.float32)
        for i in range(buf.n - 1, -1, -1):
            if pending[i]:
                continue
            if buf.done[i]:
                next_value = next_adv = 0.0
            else:
                j = buf.next[i]
                next_value = buf.value[j]
                next_adv = 0.0 if pending[j] else adv[j]
            delta = buf.reward[i] + a.gamma * next_value - buf.value[i]
            adv[i] = delta + a.gamma * a.lam * next_adv
        return adv

    # ------------------------------------------------------------ learning

    def learn(self, pending: np.ndarray, adv: np.ndarray) -> dict:
        a, buf, dev = self.args, self.buf, self.device
        idx = np.flatnonzero(~pending)
        hexes, vertices, edges, glob = to_device([buf.hexes[idx], buf.vertices[idx], buf.edges[idx], buf.glob[idx]], dev)
        mask = torch.from_numpy(buf.mask[idx]).to(dev)
        action = torch.from_numpy(buf.action[idx]).to(dev)
        old_logp = torch.from_numpy(buf.logp[idx]).to(dev)
        advantage = torch.from_numpy(adv[idx]).to(dev)
        returns = advantage + torch.from_numpy(buf.value[idx]).to(dev)
        # Normalised once over the whole update (a tiny last minibatch has no usable std).
        norm_adv = (advantage - advantage.mean()) / (advantage.std() + 1e-8)
        n = len(idx)
        stats = collections.defaultdict(list)
        self.net.train()
        for _ in range(a.epochs):
            perm = torch.randperm(n, device=dev)
            for start in range(0, n, a.minibatch):
                b = perm[start:start + a.minibatch]
                logits, value = self.net(hexes[b], vertices[b], edges[b], glob[b])
                logp_all = F.log_softmax(masked_logits(logits, mask[b]), dim=-1)
                entropy = -(logp_all.exp() * logp_all).sum(-1).mean()
                new_logp = logp_all.gather(1, action[b, None]).squeeze(1)
                log_ratio = new_logp - old_logp[b]
                ratio = log_ratio.exp()
                adv_b = norm_adv[b]
                pi_loss = -torch.min(ratio * adv_b, ratio.clamp(1 - a.clip, 1 + a.clip) * adv_b).mean()
                stats["approx_kl"].append(((ratio - 1) - log_ratio).mean().item())
                stats["clipfrac"].append(((ratio - 1).abs() > a.clip).float().mean().item())
                v_loss = 0.5 * (value - returns[b]).pow(2).mean()
                loss = pi_loss + a.vf_coef * v_loss - a.ent_coef * entropy
                if not torch.isfinite(loss):
                    stats["skipped_steps"].append(1.0)
                    continue
                self.opt.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.net.parameters(), a.max_grad_norm)
                self.opt.step()
                stats["policy_loss"].append(pi_loss.item())
                stats["value_loss"].append(v_loss.item())
                stats["entropy"].append(entropy.item())
        self.net.eval()
        out = {k: float(np.sum(v) if k == "skipped_steps" else np.mean(v)) for k, v in stats.items()}
        ret_np, val_np = returns.cpu().numpy(), buf.value[idx]
        out["explained_variance"] = float(1 - np.var(ret_np - val_np) / (np.var(ret_np) + 1e-8))
        out["transitions"] = n
        return out

    # ------------------------------------------------------------ checkpoints

    def save(self) -> str:
        a, u = self.args, self.update
        state = {"update": u, "decisions": self.decisions, "learner_decisions": self.learner_decisions,
                 "episodes": self.episodes, "train_seconds": self.train_seconds, "versions": self.versions,
                 "args": vars(a)}
        ckpt_dir = os.path.join(self.run_dir, "ckpt")
        save_checkpoint(os.path.join(ckpt_dir, f"update_{u:06d}.pt"), self.net, self.opt, state)
        for old in sorted(f for f in os.listdir(ckpt_dir) if f.endswith(".pt"))[:-a.keep_ckpt]:
            os.remove(os.path.join(ckpt_dir, old))
        path = os.path.join(self.run_dir, "policies", f"update_{u:06d}.json")
        export_policy(self.net, path, self.versions,
                      meta={"run": os.path.basename(self.run_dir), "update": u, "decisions": self.decisions})
        return path

    def eval_jobs(self) -> list[tuple[str, str]]:
        jobs = [("heuristic", "heuristic")]
        past = ev.list_policies(self.run_dir)
        if len(past) > self.args.eval_past_gap:
            jobs.append(("past", past[-1 - self.args.eval_past_gap][1]))
        return jobs

    def refresh_past_opponents(self) -> None:
        pool = [p for _, p in ev.list_policies(self.run_dir)][-self.args.pool:]
        past = [w for w in self.workers if w.role == "past"]
        if not pool or not past:
            return
        picks = [random.choice(pool) for _ in range(max(1, self.args.past_opponents))]
        nets = []
        for path in picks:
            net = load_policy(path, self.versions, self.device)
            net.topology, net.amp = self.topology, self.net.amp
            nets.append((net, os.path.basename(path)))
        for k, w in enumerate(past):
            if w.opponent is None:
                w.env.configure(seats_for("past", self.args.players, True))
            w.opponent, w.opponent_name = nets[k % len(nets)]

    # ------------------------------------------------------------ logging

    def summary(self, kind: str) -> dict | None:
        rows = self.window.get(kind)
        if not rows:
            return None
        return {k: float(np.mean([r[k] for r in rows])) for k in rows[0]}

    def log_update(self, stats: dict, seconds: float) -> None:
        a, u, w = self.args, self.update, self.writer
        rate = stats["decisions"] / max(seconds, 1e-9)
        for k, v in stats.items():
            w.add_scalar(f"learn/{k}", v, u)
        w.add_scalar("perf/decisions_per_sec", rate, u)
        w.add_scalar("perf/seconds_per_update", seconds, u)
        w.add_scalar("progress/decisions", self.decisions, u)
        w.add_scalar("progress/episodes", self.episodes, u)
        w.add_scalar("progress/hours", self.train_seconds / 3600, u)
        line = {"update": u, "decisions": self.decisions, "episodes": self.episodes, "seconds": seconds,
                "hours": self.train_seconds / 3600, **stats}
        parts = []
        for kind in ("heuristic", "past"):
            s = self.summary(kind)
            if s:
                for k, v in s.items():
                    w.add_scalar(f"train_vs_{kind}/{k}", v, u)
                    line[f"vs_{kind}_{k}"] = v
                parts.append(f"{kind[:4]}: win {100 * s['win']:3.0f}% place {s['rank']:.2f} vp {s['vp']:4.1f}")
        allm = self.summary("all")
        if allm:
            w.add_scalar("train/match_turns", allm["turns"], u)
            w.add_scalar("train/match_truncated", allm["truncated"], u)
            line["match_turns"], line["match_truncated"] = allm["turns"], allm["truncated"]
            parts.append(f"{allm['turns']:3.0f} turns, {100 * allm['truncated']:.0f}% cut")
        with open(os.path.join(self.run_dir, "metrics.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(line) + "\n")
        self.update_seconds.append(seconds)
        eta = np.mean(self.update_seconds) * (a.updates - u)
        head = (f"pi {stats['policy_loss']:+.3f} kl {stats['approx_kl']:.4f} clip {stats['clipfrac']:.2f} "
                f"v {stats['value_loss']:.3f} ent {stats['entropy']:.2f} ev {stats['explained_variance']:+.2f}")
        print(f"u {u:5d} | {self.decisions / 1e6:6.2f}M dec | {rate / 1e3:4.1f}k/s | {head} | {' | '.join(parts)} | "
              f"{seconds:.1f}s/u, ETA {fmt_duration(eta)}", flush=True)

    def log_evals(self) -> None:
        if not self.evaluator:
            return
        for update, tag, opponent, s, err in self.evaluator.drain():
            if err:
                print(f"  eval u{update} vs {tag} failed: {err}", flush=True)
                expected = self.eval_expected.get(update, [])
                if tag in expected:
                    expected.remove(tag)  # so the progress table doesn't wait on it
                continue
            w = self.writer
            lo, hi = s["winCi95"]
            w.add_scalar(f"eval/win_vs_{tag}", s["winRate"], update)
            w.add_scalar(f"eval/win_vs_{tag}_ci_low", lo, update)
            w.add_scalar(f"eval/place_vs_{tag}", s["meanRank"], update)
            w.add_scalar(f"eval/vp_vs_{tag}", s["meanVp"], update)
            w.add_scalar(f"eval/turns_vs_{tag}", s["meanTurns"], update)
            meta = self.eval_meta.get(update, {})
            row = {"update": update, "vs": tag, "opponent": opponent, **meta, **s}
            with open(os.path.join(self.run_dir, "evals.jsonl"), "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
            print(f"  eval u{update} vs {tag}: win {100 * s['winRate']:.1f}% [{100 * lo:.1f}-{100 * hi:.1f}] "
                  f"place {s['meanRank']:.2f} vp {s['meanVp']:.1f} turns {s['meanTurns']:.0f} "
                  f"over {s['games']} matches", flush=True)
            self.eval_results.setdefault(update, {})[tag] = row
        complete = [u for u, tags in self.eval_expected.items()
                    if u not in self.progress_shown and all(t in self.eval_results.get(u, {}) for t in tags)]
        if complete:
            self.progress_shown.update(complete)
            print(self.progress_table(last=10), flush=True)
            self.write_progress()

    # ------------------------------------------------------------ progress table

    def progress_table(self, last: int | None = None) -> str:
        """Markdown table of the evaluated checkpoints (the newest `last` of them)."""
        a = self.args
        done = sorted(u for u in self.eval_results if u in self.progress_shown)
        rows = done[-last:] if last else done
        gap = a.eval_past_gap * a.save_every
        lines = ["| update | hours | decisions | vs heuristic: win (95% CI) | place | VP | turns "
                 f"| vs {gap} updates earlier: win (95% CI) | place |",
                 "|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
        def win(x: dict | None) -> str:
            return f"{100 * x['winRate']:.1f}% ({100 * x['winCi95'][0]:.1f}-{100 * x['winCi95'][1]:.1f})" if x else ""

        def num(x: dict | None, key: str, fmt: str) -> str:
            return format(x[key], fmt) if x else ""

        for u in rows:
            r = self.eval_results[u]
            h, p = r.get("heuristic"), r.get("past")
            hours = next((x["hours"] for x in r.values() if x.get("hours") is not None), None)
            dec = next((x["decisions"] for x in r.values() if x.get("decisions") is not None), None)
            cells = [str(u), "" if hours is None else f"{hours:.1f}", "" if dec is None else f"{dec / 1e6:.1f}M",
                     win(h), num(h, "meanRank", ".2f"), num(h, "meanVp", ".1f"), num(h, "meanTurns", ".0f"),
                     win(p), num(p, "meanRank", ".2f")]
            lines.append("| " + " | ".join(cells) + " |")
        heur = [u for u in done if "heuristic" in self.eval_results[u]]
        if heur:
            best = max(heur, key=lambda u: self.eval_results[u]["heuristic"]["winRate"])
            lines.append(f"\nbest vs heuristic so far: update {best} at "
                         f"{100 * self.eval_results[best]['heuristic']['winRate']:.1f}% (25% = as good as each heuristic seat)")
        return "\n".join(lines)

    def write_progress(self) -> None:
        a = self.args
        v = self.versions
        doc = [f"# {os.path.basename(self.run_dir)} progress",
               "",
               f"Base-game Catan, {a.players} players. Encoder v{v['encoderVersion']}, action space "
               f"v{v['actionSpaceVersion']} ({self.shape['slots']} slots), graph net {a.width}x{a.rounds}. "
               f"Each checkpoint plays {a.eval_games} greedy matches as one seat against three heuristic AIs, and "
               f"{a.eval_games} against three copies of the checkpoint {a.eval_past_gap * a.save_every} updates "
               f"earlier; its seat rotates round the table. Win 25% = parity with each opponent seat; place 1 = first, "
               f"{a.players} = last (2.5 = average). Updated {time.strftime('%Y-%m-%d %H:%M')}, update "
               f"{self.update}/{a.updates}, {self.train_seconds / 3600:.1f} h trained.",
               "",
               "## Latest 10 checkpoints",
               "",
               self.progress_table(last=10),
               "",
               "## Every checkpoint",
               "",
               self.progress_table()]
        path = os.path.join(self.run_dir, "progress.md")
        with open(path + ".tmp", "w", encoding="utf-8") as f:
            f.write("\n".join(doc) + "\n")
        os.replace(path + ".tmp", path)

    # ------------------------------------------------------------ main loop

    def train(self) -> None:
        a = self.args
        stop_file = os.path.join(self.run_dir, "STOP")
        if os.path.exists(stop_file):
            os.remove(stop_file)
        self.refresh_past_opponents()
        try:
            while self.update < a.updates:
                if os.path.exists(stop_file):
                    print(f"STOP file found - saving update {self.update} and exiting", flush=True)
                    if self.update % a.save_every:
                        self.save()
                    break
                if a.anneal_lr:
                    for g in self.opt.param_groups:
                        g["lr"] = a.lr * (1 - self.update / a.updates)
                t0 = time.perf_counter()
                d0 = self.decisions
                pending = self.collect()
                t1 = time.perf_counter()
                stats = self.learn(pending, self.advantages(pending))
                t2 = time.perf_counter()
                self.update += 1
                self.train_seconds += t2 - t0
                stats["collect_seconds"], stats["learn_seconds"] = t1 - t0, t2 - t1
                stats["decisions"] = self.decisions - d0
                self.log_update(stats, t2 - t0)
                if self.update % a.save_every == 0 or self.update == a.updates:
                    policy = self.save()
                    if self.evaluator and self.update % a.eval_every == 0:
                        jobs = self.eval_jobs()
                        self.eval_meta[self.update] = {"hours": self.train_seconds / 3600, "decisions": self.decisions}
                        if self.evaluator.submit(self.update, policy, jobs):
                            self.eval_expected[self.update] = [tag for tag, _ in jobs]
                        else:
                            print("  (eval skipped - previous evals still running)", flush=True)
                if self.update % a.pool_refresh == 0 or self.update == a.save_every:
                    self.refresh_past_opponents()  # (also right after the first checkpoint lands)
                self.log_evals()
        except KeyboardInterrupt:
            print(f"\ninterrupted - saving update {self.update}", flush=True)
            self.save()
            self.close(finish_evals=False)
            return
        except BaseException:
            self.close(finish_evals=False)
            raise
        self.close(finish_evals=True)

    def close(self, finish_evals: bool) -> None:
        for w in self.workers:
            w.env.close()
        if self.evaluator:
            print("finishing queued evals..." if finish_evals else "finishing the running eval...", flush=True)
            self.evaluator.close(drop_queued=not finish_evals)
            self.log_evals()
        self.writer.close()


def main(argv: list[str] | None = None) -> str:
    trainer = Trainer(parse_args(argv))
    trainer.setup()
    trainer.train()
    return trainer.run_dir


if __name__ == "__main__":
    main()
