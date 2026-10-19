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
    common = ["--runs-dir", str(tmp_path), "--run", "t", "--workers", "3", "--envs-per-worker", "4",
              "--rollout", "8", "--save-every", "1", "--eval-every", "0", "--no-build", "--width", "32",
              "--rounds", "2", "--minibatch", "64", "--device", "cpu", "--pool-refresh", "1"]
    run_dir = train.main(["--updates", "2", *common])
    pols = ev.list_policies(run_dir)
    assert [u for u, _ in pols] == [1, 2]
    train.main(["--updates", "3", "--resume", *common])
    assert [u for u, _ in ev.list_policies(run_dir)] == [1, 2, 3]
    with open(os.path.join(run_dir, "metrics.jsonl"), encoding="utf-8") as f:
        assert [json.loads(line)["update"] for line in f] == [1, 2, 3]
    s = ev.evaluate(run_dir, "heuristic", games=4, workers=2, max_turns=40, device="cpu")
    assert s["games"] == 4 and 0 <= s["winRate"] <= 1 and 1 <= s["meanRank"] <= 4
    s = ev.evaluate(f"{run_dir}@3", f"{run_dir}@1", games=4, workers=1, max_turns=40, device="cpu")
    assert s["games"] == 4
