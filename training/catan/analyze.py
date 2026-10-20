"""How a policy plays: per-game action habits next to its opponents'.

Agent A takes one seat (rotating) against three heuristic AIs or three
copies of agent B, on the eval deal set, greedy. For A and for the average
opponent seat it tallies, per game: results, builds, dev cards, and every
kind of trade — bank / port trades, offers made and how many were taken,
offers answered (accepted vs rejected), and player trades completed.

    python training/catan/analyze.py training/runs/catan/main --vs heuristic --games 400
    python training/catan/analyze.py training/runs/catan/main@600 --vs training/runs/catan/main@600

Uses its own env bundle (training/dist-analysis/, built on start unless
--no-build) so it never disturbs a training run's training/dist/.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

import numpy as np
import torch

from env_client import ROLE_LEARNER, ROLE_OPPONENT, CatanEnv
from evaluate import EVAL_SEED, HEURISTIC, _greedy, resolve
from model import load_policy, Topology

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT_DIR = os.path.join(REPO, "training", "dist-analysis")
SCRIPT = os.path.join(OUT_DIR, "catan-env.mjs")

ROWS = [
    ("results", None),
    ("win %", "win"), ("place", "rank"), ("VP", "vp"),
    ("building", None),
    ("roads", "buildRoad"), ("settlements", "buildSettlement"), ("cities", "buildCity"),
    ("dev cards bought", "buyDevCard"), ("knights played", "playKnight"),
    ("road building / plenty / monopoly", "otherDev"),
    ("trading", None),
    ("bank / port trades", "bankTrade"),
    ("offers made", "proposeTrade"), ("... taken by someone", "offerTaken"),
    ("others' offers accepted", "acceptTrade"), ("others' offers rejected", "rejectTrade"),
    ("player trades completed", "tradeDone"),
    ("turn", None),
    ("own turns (rolls)", "rollDice"), ("robber moves", "moveRobber"), ("discards", "discard"),
]


def build() -> None:
    vite = os.path.join(REPO, "node_modules", "vite", "bin", "vite.js")
    subprocess.run([shutil.which("node"), vite, "build", "--config", os.path.join("training", "vite.config.ts"),
                    "--outDir", OUT_DIR, "--emptyOutDir"], cwd=REPO, check=True)


def play(a: str, b: str, games: int, workers: int, device: str, max_turns: int) -> list[dict]:
    path_a, path_b = resolve(a), resolve(b)
    per = [games // workers + (1 if w < games % workers else 0) for w in range(workers)]
    envs = [CatanEnv(script=SCRIPT) for _ in per]
    try:
        topo = Topology(envs[0].topology, envs[0].shape, device)

        def net(path: str):
            n = load_policy(path, envs[0].versions, device)
            n.topology, n.amp = topo, True
            return n

        net_a = net(path_a)
        net_b = None if path_b == HEURISTIC else net(path_b)
        seats = ["learner"] + [HEURISTIC if net_b is None else "opponent"] * 3
        batches = [env.reset(num_envs=n, seed=EVAL_SEED + 1_000_003 * w, seats=seats, max_turns=max_turns, quota=1)
                   for w, (env, n) in enumerate(zip(envs, per))]
        episodes: list = []
        while True:
            for bt in batches:
                episodes.extend(bt.episodes)
            role = np.concatenate([bt.role for bt in batches])
            if (role < 0).all():
                return episodes
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
    finally:
        for env in envs:
            env.close()


def tally(episodes: list[dict]) -> tuple[dict, dict, dict]:
    """Per-game means for A's seat and for the average other seat, plus match facts."""
    a_rows, b_rows = [], []
    for ep in episodes:
        seat = ep["roles"].index("learner")
        acts = ep.get("actions", {})
        for s in range(len(ep["roles"])):
            row = {k: acts.get(k, [0] * 4)[s] for _, k in ROWS if k and k not in ("win", "rank", "vp", "otherDev")}
            row["otherDev"] = sum(acts.get(k, [0] * 4)[s] for k in ("playRoadBuilding", "playYearOfPlenty", "playMonopoly"))
            row["win"] = 100.0 * (ep["winnerSeat"] == s)
            row["rank"], row["vp"] = ep["rank"][s], ep["vp"][s]
            (a_rows if s == seat else b_rows).append(row)
    mean = lambda rows: {k: float(np.mean([r[k] for r in rows])) for k in rows[0]}  # noqa: E731
    facts = {
        "games": len(episodes),
        "turns": float(np.mean([ep["turns"] for ep in episodes])),
        "cut": float(np.mean([ep["truncated"] for ep in episodes])),
    }
    return mean(a_rows), mean(b_rows), facts


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("a")
    p.add_argument("--vs", default=HEURISTIC)
    p.add_argument("--games", type=int, default=400)
    p.add_argument("--workers", type=int, default=3)
    p.add_argument("--max-turns", type=int, default=200)
    p.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    p.add_argument("--no-build", action="store_true")
    args = p.parse_args(argv)
    if not args.no_build or not os.path.isfile(SCRIPT):
        build()
    torch.backends.cuda.matmul.allow_tf32 = True
    episodes = play(args.a, args.vs, args.games, args.workers, args.device, args.max_turns)
    a, b, facts = tally(episodes)
    print(f"A = {resolve(args.a)}\nB = {resolve(args.vs)} (the other three seats)\n"
          f"{facts['games']} games, {facts['turns']:.1f} turns (dice rolls) per game, {100 * facts['cut']:.1f}% cut off\n")
    print(f"| per game | A | B (avg seat) |\n|---|---:|---:|")
    for label, key in ROWS:
        if key is None:
            print(f"| **{label}** | | |")
        else:
            print(f"| {label} | {a[key]:.2f} | {b[key]:.2f} |")
    responded_a = a["acceptTrade"] + a["rejectTrade"]
    responded_b = b["acceptTrade"] + b["rejectTrade"]
    print(f"\naccepts {100 * a['acceptTrade'] / max(responded_a, 1e-9):.0f}% of offers it answers "
          f"(B: {100 * b['acceptTrade'] / max(responded_b, 1e-9):.0f}%); "
          f"{100 * a['offerTaken'] / max(a['proposeTrade'], 1e-9):.0f}% of its offers are taken "
          f"(B: {100 * b['offerTaken'] / max(b['proposeTrade'], 1e-9):.0f}%)")


if __name__ == "__main__":
    sys.exit(main())
