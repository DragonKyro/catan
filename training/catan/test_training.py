"""Python-side checks: policy export round trip, topology, and a tiny
train → checkpoint → resume → evaluate run. Needs `npm run train:build`.

    python -m pytest training/catan -q
"""

from __future__ import annotations

import json
import os

import numpy as np
import torch

import evaluate as ev
import train
from env_client import CatanEnv, random_actions
from model import CatanNet, Topology, export_policy, load_policy


def _spec():
    with CatanEnv() as env:
        batch = env.reset(num_envs=4, seats=["learner"] * 4)
        return env.dims, len(env.global_slots), env.shape, env.topology, env.versions, batch


def test_topology_means_are_row_normalised():
    _, _, shape, topo, _, _ = _spec()
    t = Topology(topo, shape)
    for m in (t.hex_vertex, t.vertex_hex, t.vertex_edge, t.vertex_vertex, t.edge_vertex, t.edge_hex):
        assert torch.allclose(m.sum(1), torch.ones(m.shape[0]))
    assert t.hex_vertex.shape == (19, 54) and t.edge_hex.shape == (72, 19)


def test_policy_export_round_trip(tmp_path):
    dims, n_globals, shape, topo, versions, batch = _spec()
    net = CatanNet(dims, n_globals, width=32, rounds=2)
    net.topology = Topology(topo, shape)
    path = os.path.join(tmp_path, "p.json")
    export_policy(net, path, versions, meta={"note": "test"})
    back = load_policy(path, versions)
    back.topology = net.topology
    x = [torch.from_numpy(np.ascontiguousarray(getattr(batch, k))) for k in ("hexes", "vertices", "edges", "glob")]
    with torch.no_grad():
        a, va = net(*x)
        b, vb = back(*x)
    assert torch.equal(a, b) and torch.equal(va, vb)
    assert a.shape == (4, shape["slots"])
    with open(path, encoding="utf-8") as f:
        assert json.load(f)["meta"] == {"note": "test"}


def test_random_bridge_keeps_masks_and_features_sane():
    rng = np.random.default_rng(0)
    with CatanEnv() as env:
        batch = env.reset(num_envs=4, seats=["learner", "heuristic", "heuristic", "heuristic"])
        for _ in range(50):
            assert batch.mask.any(axis=1).all()
            assert np.isfinite(batch.glob).all() and np.abs(batch.vertices).max() <= 4
            batch = env.step(random_actions(batch.mask, rng))


def test_train_checkpoint_resume_evaluate(tmp_path):
    # 1 imitation update, then PPO with the anchor fading over 2; one worker of each kind.
    common = ["--runs-dir", str(tmp_path), "--run", "t", "--workers", "3", "--envs-per-worker", "4",
              "--rollout", "8", "--save-every", "1", "--eval-every", "0", "--no-build", "--width", "32",
              "--rounds", "2", "--minibatch", "64", "--device", "cpu", "--pool-refresh", "1",
              "--bc-updates", "1", "--bc-anchor-updates", "2"]
    run_dir = train.main(["--updates", "2", *common])
    pols = ev.list_policies(run_dir)
    assert [u for u, _ in pols] == [1, 2]
    train.main(["--updates", "3", "--resume", *common])
    assert [u for u, _ in ev.list_policies(run_dir)] == [1, 2, 3]
    with open(os.path.join(run_dir, "metrics.jsonl"), encoding="utf-8") as f:
        rows = [json.loads(line) for line in f]
    assert [r["update"] for r in rows] == [1, 2, 3]
    assert "approx_kl" not in rows[0] and 0 < rows[0]["teacher_agreement"] <= 1  # imitation
    assert rows[1]["anchor_weight"] > rows[2]["anchor_weight"] > 0  # PPO, anchor fading
    with open(os.path.join(run_dir, "config.json"), encoding="utf-8") as f:
        assert json.load(f)["mixed"] == 0.35
    s = ev.evaluate(run_dir, "heuristic", games=4, workers=2, max_turns=40, device="cpu")
    assert s["games"] == 4 and 0 <= s["winRate"] <= 1 and 1 <= s["meanRank"] <= 4
    s = ev.evaluate(f"{run_dir}@3", f"{run_dir}@1", games=4, workers=1, max_turns=40, device="cpu")
    assert s["games"] == 4


class _FakeEnv:
    def __init__(self):
        self.seats = None

    def configure(self, seats=None, teacher=None):
        self.seats = seats


def test_guard_moves_self_play_to_heuristic_tables_and_back():
    t = train.Trainer(train.parse_args(["--players", "4", "--guard-max-shift", "2"]))
    t.workers = [train.Worker(role, _FakeEnv()) for role in ("self", "self", "self", "heuristic")]
    result = lambda win, lo, hi: {"winRate": win, "winCi95": [lo, hi]}  # noqa: E731
    t.guard(5, result(0.20, 0.15, 0.25))
    assert t.guard_best == 0.20 and t.guard_workers == []
    t.guard(10, result(0.18, 0.13, 0.23))  # within noise: CI reaches the best
    assert t.guard_workers == []
    t.guard(15, result(0.08, 0.05, 0.12))  # clearly worse
    assert t.guard_workers == [2] and t.workers[2].role == "heuristic"
    assert t.workers[2].env.seats == ["learner", "heuristic", "heuristic", "heuristic"]
    t.guard(20, result(0.07, 0.04, 0.11))
    assert t.guard_workers == [2, 1]
    t.guard(25, result(0.06, 0.03, 0.10))  # at --guard-max-shift
    assert t.guard_workers == [2, 1]
    t.guard(30, result(0.19, 0.14, 0.24))  # back near the best
    assert t.guard_workers == [2] and t.workers[1].role == "self"
    assert t.workers[1].env.seats == ["learner"] * 4
