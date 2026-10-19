"""Python side of the Catan training bridge.

Spawns `node training/dist/catan-env.mjs` (build it with `npm run train:build`)
and drives the vectorized env over stdin/stdout (JSON lines; batch replies
add the feature arrays as raw bytes after the line). The game rules, the
hidden-information boundary, the feature encoder and the action space all live
in TypeScript (src/ai/nn/); this side only ever sees encoded observations,
legal masks and rewards.

    with CatanEnv() as env:
        batch = env.reset(num_envs=32, seats=["learner"] * 4)
        while training:
            actions = policy(batch)            # one slot per env row
            batch = env.step(actions)

For many env processes in parallel, split each step into `send_step` (all
workers) then `recv_batch` (all workers) — every node process works while the
others are being written to.

Run this file directly for a random-agent smoke test of the bridge:

    python training/catan/env_client.py --episodes 64 --envs 32
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import time
from dataclasses import dataclass

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SCRIPT = os.path.normpath(os.path.join(HERE, "..", "dist", "catan-env.mjs"))

ROLE_LEARNER, ROLE_OPPONENT, ROLE_IDLE = 0, 1, -1


@dataclass
class Batch:
    seat: np.ndarray  # (n,) int64 -- seat (state.players index) deciding row i
    role: np.ndarray  # (n,) int64 -- 0 learner, 1 opponent, -1 idle (quota reached)
    hexes: np.ndarray  # (n, H, hex_dim) float32
    vertices: np.ndarray  # (n, V, vertex_dim) float32
    edges: np.ndarray  # (n, E, edge_dim) float32
    glob: np.ndarray  # (n, global_dim) float32
    mask: np.ndarray  # (n, slots) bool -- True = legal
    reward: np.ndarray  # (n, players) float32 -- per-seat reward since the previous batch
    done: np.ndarray  # (n,) bool -- a match ended; row i is already the next match's first decision
    episodes: list  # summaries of the matches that ended


class CatanEnv:
    def __init__(self, players: int = 4, script: str = DEFAULT_SCRIPT, node: str | None = None):
        if not os.path.exists(script):
            raise FileNotFoundError(f"{script} not found -- run `npm run train:build` first")
        node = node or shutil.which("node")
        if not node:
            raise FileNotFoundError("node executable not found on PATH")
        # Binary pipes: batch replies are a JSON line followed by raw feature bytes.
        self._proc = subprocess.Popen([node, script], stdin=subprocess.PIPE, stdout=subprocess.PIPE, bufsize=1 << 20)
        spec = self._call({"cmd": "spec", "players": players})
        self.players = players
        self.dims: dict = spec["dims"]
        self.shape: dict = spec["shape"]
        self.global_slots: list[str] = spec["globalSlots"]
        self.layouts: dict = spec["layouts"]
        self.topology: dict = spec["topology"]
        self.encoder_version: int = spec["encoderVersion"]
        self.action_space_version: int = spec["actionSpaceVersion"]
        self.num_slots: int = self.shape["slots"]

    @property
    def versions(self) -> dict:
        return {"encoderVersion": self.encoder_version, "actionSpaceVersion": self.action_space_version}

    def _send(self, msg: dict) -> None:
        assert self._proc.stdin
        self._proc.stdin.write((json.dumps(msg) + "\n").encode())
        self._proc.stdin.flush()

    def _recv(self) -> dict:
        assert self._proc.stdout
        line = self._proc.stdout.readline()
        if not line:
            raise RuntimeError(f"env server exited (code {self._proc.poll()})")
        reply = json.loads(line)
        if not reply.get("ok"):
            raise RuntimeError(f"env server: {reply.get('error')}")
        if "binary" in reply:
            sizes = reply.pop("binary")
            data = self._proc.stdout.read(sum(size for _, size in sizes))
            if data is None or len(data) < sum(size for _, size in sizes):
                raise RuntimeError(f"env server exited mid-reply (code {self._proc.poll()})")
            at, raw = 0, {}
            for name, size in sizes:
                raw[name] = memoryview(data)[at:at + size]
                at += size
            reply["raw"] = raw
        return reply

    def _call(self, msg: dict) -> dict:
        self._send(msg)
        return self._recv()

    def _batch(self, r: dict) -> Batch:
        n, sh, d = r["n"], self.shape, self.dims

        def f32(key: str, *shape: int) -> np.ndarray:
            return np.frombuffer(r["raw"][key], dtype="<f4").reshape(n, *shape)

        return Batch(
            seat=np.asarray(r["seat"], dtype=np.int64),
            role=np.asarray(r["role"], dtype=np.int64),
            hexes=f32("hexes", sh["hexes"], d["hex"]),
            vertices=f32("vertices", sh["vertices"], d["vertex"]),
            edges=f32("edges", sh["edges"], d["edge"]),
            glob=f32("global", d["global"]),
            mask=np.frombuffer(r["raw"]["mask"], dtype=np.uint8).reshape(n, sh["slots"]).astype(bool),
            reward=np.asarray(r["reward"], dtype=np.float32).reshape(n, self.players),
            done=np.asarray(r["done"], dtype=bool),
            episodes=r["episodes"],
        )

    def reset(
        self,
        num_envs: int = 16,
        seed: int = 1,
        seats: list[str] | None = None,
        max_turns: int = 200,
        max_steps: int = 4000,
        vp_shaping: float = 0.0,
        victory_points: int = 10,
        quota: int = 0,
        reward: dict | None = None,
    ) -> Batch:
        """seats: a role per seat, 'learner' | 'opponent' | 'heuristic' (rotated one
        seat per match). quota: matches per env before it idles (0 = forever)."""
        options = {
            "numEnvs": num_envs,
            "seed": seed,
            "players": self.players,
            "seats": seats or ["learner"] * self.players,
            "maxTurns": max_turns,
            "maxSteps": max_steps,
            "vpShaping": vp_shaping,
            "victoryPoints": victory_points,
            "quota": quota,
        }
        if reward is not None:
            options["reward"] = reward
        return self._batch(self._call({"cmd": "reset", "options": options}))

    def step(self, actions) -> Batch:
        self.send_step(actions)
        return self.recv_batch()

    def send_step(self, actions) -> None:
        self._send({"cmd": "step", "actions": [int(a) for a in actions]})

    def recv_batch(self) -> Batch:
        return self._batch(self._recv())

    def configure(self, seats: list[str]) -> None:
        """New seat roles for matches that start from now on."""
        self._call({"cmd": "configure", "options": {"seats": seats}})

    def close(self) -> None:
        if self._proc.poll() is None:
            try:
                assert self._proc.stdin
                self._proc.stdin.write(b'{"cmd": "close"}\n')
                self._proc.stdin.flush()
                self._proc.wait(timeout=5)
            except (OSError, subprocess.TimeoutExpired):
                self._proc.kill()

    def __enter__(self) -> "CatanEnv":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


def random_actions(mask: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """A uniformly random legal slot per row (0 for rows with nothing legal)."""
    u = rng.random(mask.shape) * mask
    return np.where(mask.any(axis=1), u.argmax(axis=1), 0)


def _smoke(args: argparse.Namespace) -> None:
    rng = np.random.default_rng(args.seed)
    seats = ["learner"] + [args.opponent] * 3 if args.opponent != "self" else ["learner"] * 4
    with CatanEnv() as env:
        print(f"dims={env.dims} shape={env.shape} encoder v{env.encoder_version} action space v{env.action_space_version}")
        batch = env.reset(num_envs=args.envs, seed=args.seed, seats=seats, vp_shaping=0.5)
        episodes: list = []
        decisions = 0
        t0 = time.perf_counter()
        while len(episodes) < args.episodes:
            for name in ("hexes", "vertices", "edges", "glob"):
                assert np.isfinite(getattr(batch, name)).all(), f"non-finite {name}"
            assert batch.mask.any(axis=1).all(), "a decision row has no legal slot"
            batch = env.step(random_actions(batch.mask, rng))
            decisions += len(batch.seat)
            episodes.extend(batch.episodes)
        dt = time.perf_counter() - t0
    print(f"{len(episodes)} matches ({args.opponent}), {decisions} network decisions in {dt:.1f}s "
          f"({decisions / dt:,.0f} decisions/s)")
    print(f"truncated {sum(e['truncated'] for e in episodes)}; mean turns {np.mean([e['turns'] for e in episodes]):.0f}; "
          f"mean actions/match {np.mean([e['steps'] for e in episodes]):.0f}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Random-agent smoke test for the Catan env bridge.")
    p.add_argument("--envs", type=int, default=32)
    p.add_argument("--episodes", type=int, default=64)
    p.add_argument("--opponent", default="heuristic", help="'self' or 'heuristic' for the other three seats")
    p.add_argument("--seed", type=int, default=1)
    _smoke(p.parse_args())
