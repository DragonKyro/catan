"""Seat-rotated evaluation of Catan policies.

One agent ("A") takes one seat; the other seats are three heuristic AIs
(src/ai) or three copies of agent B. Every match is a fresh deal from a fixed
eval seed set (never trained on), A's seat rotates round the table match by
match, and networks play greedily. Reported for A: win rate with a 95% Wilson
interval (25% = parity at 4 players), mean place (1 = first; ties share),
mean VP, mean match length in dice rolls, and how many matches hit the turn
cap.

Agents: `heuristic`, a policy .json, a run directory (its latest policy) or
RUN@N (the policy saved at update N).

    python training/catan/evaluate.py match training/runs/catan/main heuristic --games 400
    python training/catan/evaluate.py match training/runs/catan/main@5000 training/runs/catan/main@1000
    python training/catan/evaluate.py progress training/runs/catan/main --vs heuristic --every 1000
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time

import numpy as np
import torch

from env_client import ROLE_LEARNER, ROLE_OPPONENT, CatanEnv
from model import CatanNet, Topology, load_policy, masked_logits

EVAL_SEED = 777_000_001
HEURISTIC = "heuristic"


def list_policies(run_dir: str) -> list[tuple[int, str]]:
    """(update, path) for every exported policy of a run, oldest first."""
    d = os.path.join(run_dir, "policies")
    if not os.path.isdir(d):
        return []
    out = []
    for f in os.listdir(d):
        m = re.fullmatch(r"update_(\d+)\.json", f)
        if m:
            out.append((int(m.group(1)), os.path.join(d, f)))
    return sorted(out)


def resolve(spec: str) -> str:
    """An agent spec → `heuristic` or a policy file path."""
    if spec == HEURISTIC:
        return spec
    m = re.fullmatch(r"(.+)@(\d+)", spec)
    if m:
        path = os.path.join(m.group(1), "policies", f"update_{int(m.group(2)):06d}.json")
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        return path
    if os.path.isdir(spec):
        pols = list_policies(spec)
        if not pols:
            raise FileNotFoundError(f"{spec} has no policies/")
        return pols[-1][1]
    if os.path.isfile(spec):
        return spec
    raise FileNotFoundError(spec)


def wilson(k: float, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (max(0.0, centre - half), min(1.0, centre + half))


def _greedy(net: CatanNet, parts: list[np.ndarray], mask: np.ndarray, rows: np.ndarray, device) -> np.ndarray:
    obs = [torch.from_numpy(np.ascontiguousarray(p[rows])).to(device) for p in parts]
    with torch.no_grad():
        logits, _ = net(*obs)
        return masked_logits(logits, torch.from_numpy(mask[rows]).to(device)).argmax(-1).cpu().numpy()


def evaluate(a: str, b: str = HEURISTIC, games: int = 400, workers: int = 3, players: int = 4,
             seed: int = EVAL_SEED, max_turns: int = 200, device: str | None = None) -> dict:
    """A in one seat vs B in every other seat, `games` fresh deals."""
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    torch.backends.cuda.matmul.allow_tf32 = True
    path_a, path_b = resolve(a), resolve(b)
    if path_a == HEURISTIC:
        raise ValueError("agent A must be a network")
    workers = max(1, min(workers, games))
    per = [games // workers + (1 if w < games % workers else 0) for w in range(workers)]
    envs = [CatanEnv(players=players) for _ in per]
    try:
        versions, topo = envs[0].versions, Topology(envs[0].topology, envs[0].shape, device)

        def net(path: str) -> CatanNet:
            n = load_policy(path, versions, device)
            n.topology, n.amp = topo, True
            return n

        net_a = net(path_a)
        net_b = None if path_b == HEURISTIC else net(path_b)
        seats = ["learner"] + [HEURISTIC if net_b is None else "opponent"] * (players - 1)
        batches = [env.reset(num_envs=n, seed=seed + 1_000_003 * w, seats=seats, max_turns=max_turns, quota=1)
                   for w, (env, n) in enumerate(zip(envs, per))]
        episodes: list = []
        t0 = time.perf_counter()
        while True:
            for bt in batches:
                episodes.extend(bt.episodes)
            role = np.concatenate([bt.role for bt in batches])
            if (role < 0).all():
                break
            parts = [np.concatenate([getattr(bt, k) for bt in batches]) for k in ("hexes", "vertices", "edges", "glob")]
            mask = np.concatenate([bt.mask for bt in batches])
            actions = np.zeros(len(role), np.int64)
            for code, model in ((ROLE_LEARNER, net_a), (ROLE_OPPONENT, net_b)):
                rows = np.flatnonzero(role == code)
                if len(rows):
                    actions[rows] = _greedy(model, parts, mask, rows, device)
            at = 0
            for env, n in zip(envs, per):
                env.send_step(actions[at:at + n])
                at += n
            batches = [env.recv_batch() for env in envs]
        seconds = time.perf_counter() - t0
    finally:
        for env in envs:
            env.close()

    seat = [ep["roles"].index("learner") for ep in episodes]
    wins = sum(ep["winnerSeat"] == s for ep, s in zip(episodes, seat))
    n = len(episodes)
    return {
        "a": path_a,
        "b": path_b,
        "games": n,
        "wins": wins,
        "winRate": wins / n if n else 0.0,
        "winCi95": list(wilson(wins, n)),
        "meanRank": float(np.mean([ep["rank"][s] for ep, s in zip(episodes, seat)])),
        "meanVp": float(np.mean([ep["vp"][s] for ep, s in zip(episodes, seat)])),
        "meanTurns": float(np.mean([ep["turns"] for ep in episodes])),
        "truncated": sum(ep["truncated"] for ep in episodes) / n if n else 0.0,
        "seconds": seconds,
    }


def report(s: dict) -> str:
    lo, hi = s["winCi95"]
    return (f"A {s['a']}\nB {s['b']} (every other seat)\n"
            f"{s['games']} matches in {s['seconds']:.0f}s: A wins {100 * s['winRate']:.1f}% [{100 * lo:.1f}-{100 * hi:.1f}] "
            f"(parity 25% at 4 players) | place {s['meanRank']:.2f} | VP {s['meanVp']:.1f} | "
            f"{s['meanTurns']:.0f} turns | {100 * s['truncated']:.1f}% cut off")


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(q: argparse.ArgumentParser) -> None:
        q.add_argument("--games", type=int, default=400)
        q.add_argument("--workers", type=int, default=3)
        q.add_argument("--players", type=int, default=4)
        q.add_argument("--max-turns", type=int, default=200)
        q.add_argument("--seed", type=int, default=EVAL_SEED)
        q.add_argument("--device", default=None)

    m = sub.add_parser("match", help="A in one seat vs B in the others")
    m.add_argument("a")
    m.add_argument("b", nargs="?", default=HEURISTIC)
    m.add_argument("--json", action="store_true", help="print the summary as one JSON line")
    common(m)
    pr = sub.add_parser("progress", help="a run's checkpoints vs one opponent")
    pr.add_argument("run")
    pr.add_argument("--vs", default=HEURISTIC)
    pr.add_argument("--every", type=int, default=1000)
    common(pr)
    args = p.parse_args(argv)

    kw = dict(games=args.games, workers=args.workers, players=args.players, seed=args.seed,
              max_turns=args.max_turns, device=args.device)
    if args.cmd == "match":
        s = evaluate(args.a, args.b, **kw)
        print(json.dumps(s) if args.json else report(s), flush=True)
        return
    print(f"| update | win vs {args.vs} (95% CI) | place | VP | turns |\n|---:|---:|---:|---:|---:|")
    for update, path in list_policies(args.run):
        if update % args.every:
            continue
        s = evaluate(path, args.vs, **kw)
        lo, hi = s["winCi95"]
        print(f"| {update} | {100 * s['winRate']:.1f}% ({100 * lo:.1f}-{100 * hi:.1f}) | {s['meanRank']:.2f} | "
              f"{s['meanVp']:.1f} | {s['meanTurns']:.0f} |", flush=True)


if __name__ == "__main__":
    sys.exit(main())
