"""Policy / value graph network for base-game Catan, its checkpoints, and its
export for the TypeScript side.

Inputs are the encoder's rows (src/ai/nn/encode.ts): one per hex, vertex and
edge, plus the global vector. The board's topology comes from the env spec;
it isn't part of the weights, so the same network runs on the 19-, 30- and
37-hex boards.

    embed      each row type → width d (Linear, ReLU, Linear)
    rounds ×R  hex    ← self, mean of its 6 corners, global
               vertex ← self, mean of its hexes, its edges, its neighbour vertices, global
               edge   ← self, mean of its 2 endpoints, its hexes, global
               global ← self, mean + max over hexes, vertices, edges
               (each a residual MLP; messages read the previous round)
    heads      LayerNorm per row type, then a per-vertex / per-edge / per-hex
               logit from [row, global]; global-slot logits and the value from
               the global vector

Logits come out in the action space's slot order (src/ai/nn/actions.ts):
vertices, edges, hexes, then the global slots.

Built for speed on a memory-bound GPU: rows are entity-major inside ([N, B, d])
so each neighbour mean is one GEMM with a dense incidence matrix; an update
sums one projection per input instead of concatenating them; the global input
is projected once per row and broadcast; only the global vector is normalised
every round. With `amp`, the trunk runs in bfloat16 on CUDA and the heads in
float32 (so PPO's probability ratios aren't computed from bf16 logits).
"""

from __future__ import annotations

import base64
import json
import math
import os

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

POLICY_FORMAT = "catan/gnn@1"
GAME = "catan"
ILLEGAL_LOGIT = -1e9


class Topology:
    """Row-normalised incidence matrices (a mean over each entity's neighbours)
    for one board shape, built from the env spec's topology arrays."""

    def __init__(self, topology: dict, shape: dict, device: str | torch.device = "cpu"):
        H, V, E = shape["hexes"], shape["vertices"], shape["edges"]
        self.shape = (H, V, E)

        def mean(key: str, rows: int, width: int, cols: int) -> torch.Tensor:
            flat = np.asarray(topology[key], dtype=np.int64).reshape(rows, width)
            m = np.zeros((rows, cols), np.float32)
            for r, idx in enumerate(flat):
                valid = idx[idx >= 0]
                if len(valid):
                    m[r, valid] += 1.0 / len(valid)
            return torch.from_numpy(m).to(device)

        self.hex_vertex = mean("hexVertices", H, 6, V)
        self.vertex_hex = mean("vertexHexes", V, 3, H)
        self.vertex_edge = mean("vertexEdges", V, 3, E)
        self.vertex_vertex = mean("vertexNeighbors", V, 3, V)
        self.edge_vertex = mean("edgeVertices", E, 2, V)
        self.edge_hex = mean("edgeHexes", E, 2, H)


def _linear(n_in: int, n_out: int, gain: float, bias: bool = True) -> nn.Linear:
    layer = nn.Linear(n_in, n_out, bias=bias)
    nn.init.orthogonal_(layer.weight, gain=gain)
    if bias:
        nn.init.zeros_(layer.bias)
    return layer


def _mlp(n_in: int, d: int, n_out: int, out_gain: float) -> nn.Sequential:
    return nn.Sequential(_linear(n_in, d, math.sqrt(2)), nn.ReLU(), _linear(d, n_out, out_gain))


def _mean(m: torch.Tensor, x: torch.Tensor) -> torch.Tensor:
    """Neighbour mean: incidence [M, N] applied to entity-major rows [N, B, d] → [M, B, d], one GEMM."""
    n, b, d = x.shape
    return (m.to(x.dtype) @ x.reshape(n, b * d)).view(m.shape[0], b, d)


class Update(nn.Module):
    """x ← x + W2·ReLU(Σ_k W1k·part_k + U·global), optionally LayerNorm'd. The
    global term is projected once per row and broadcast over the entities."""

    def __init__(self, n_parts: int, d: int, from_global: bool = True, norm: bool = False):
        super().__init__()
        self.parts = nn.ModuleList(_linear(d, d, math.sqrt(2 / n_parts), bias=k == 0) for k in range(n_parts))
        self.from_global = _linear(d, d, math.sqrt(2 / n_parts), bias=False) if from_global else None
        self.out = _linear(d, d, 1.0)
        self.norm = nn.LayerNorm(d) if norm else None

    def forward(self, x: torch.Tensor, parts: list[torch.Tensor], g: torch.Tensor | None = None) -> torch.Tensor:
        z = self.parts[0](parts[0])
        for linear, part in zip(self.parts[1:], parts[1:]):
            z = z + linear(part)
        if self.from_global is not None:
            z = z + self.from_global(g)[None]
        y = x + self.out(F.relu(z))
        return self.norm(y) if self.norm is not None else y


class Round(nn.Module):
    def __init__(self, d: int):
        super().__init__()
        self.hex = Update(2, d)
        self.vertex = Update(4, d)
        self.edge = Update(3, d)
        self.glob = Update(7, d, from_global=False, norm=True)

    def forward(self, h, v, e, g, t: Topology):
        h2 = self.hex(h, [h, _mean(t.hex_vertex, v)], g)
        v2 = self.vertex(v, [v, _mean(t.vertex_hex, h), _mean(t.vertex_edge, e), _mean(t.vertex_vertex, v)], g)
        e2 = self.edge(e, [e, _mean(t.edge_vertex, v), _mean(t.edge_hex, h)], g)
        pooled = [h2.mean(0), h2.amax(0), v2.mean(0), v2.amax(0), e2.mean(0), e2.amax(0)]
        g2 = self.glob(g, [g, *pooled])
        return h2, v2, e2, g2


class EntityHead(nn.Module):
    """One logit per entity from its row and the global vector → [B, N]."""

    def __init__(self, d: int):
        super().__init__()
        self.row = _linear(d, d, math.sqrt(2))
        self.glob = _linear(d, d, math.sqrt(2), bias=False)
        self.out = _linear(d, 1, 0.01)

    def forward(self, x: torch.Tensor, g: torch.Tensor) -> torch.Tensor:
        return self.out(F.relu(self.row(x) + self.glob(g)[None])).squeeze(-1).transpose(0, 1)


class CatanNet(nn.Module):
    def __init__(self, dims: dict, num_globals: int, width: int = 64, rounds: int = 4):
        super().__init__()
        self.dims, self.num_globals, self.width, self.n_rounds = dict(dims), num_globals, width, rounds
        d = width
        self.embed_hex = _mlp(dims["hex"], d, d, 1.0)
        self.embed_vertex = _mlp(dims["vertex"], d, d, 1.0)
        self.embed_edge = _mlp(dims["edge"], d, d, 1.0)
        self.embed_global = _mlp(dims["global"], 2 * d, d, 1.0)
        self.rounds = nn.ModuleList(Round(d) for _ in range(rounds))
        self.norm_hex, self.norm_vertex, self.norm_edge = nn.LayerNorm(d), nn.LayerNorm(d), nn.LayerNorm(d)
        # Small policy init → near-uniform play at the start; value starts near 0.
        self.vertex_head = EntityHead(d)
        self.edge_head = EntityHead(d)
        self.hex_head = EntityHead(d)
        self.global_head = _mlp(d, d, num_globals, 0.01)
        self.value_head = _mlp(d, d, 1, 1.0)
        self.topology: Topology | None = None
        self.amp = False

    @property
    def arch(self) -> dict:
        return {"dims": self.dims, "num_globals": self.num_globals, "width": self.width, "rounds": self.n_rounds}

    def forward(self, hexes, vertices, edges, glob) -> tuple[torch.Tensor, torch.Tensor]:
        """Rows come batch-major ([B, N, features]); inside, entities lead ([N, B, d])."""
        t = self.topology
        if t is None:
            raise RuntimeError("set net.topology before calling the network")
        with torch.autocast("cuda", dtype=torch.bfloat16, enabled=self.amp and glob.is_cuda):
            h = self.embed_hex(hexes.transpose(0, 1).contiguous())
            v = self.embed_vertex(vertices.transpose(0, 1).contiguous())
            e = self.embed_edge(edges.transpose(0, 1).contiguous())
            g = self.embed_global(glob)
            for r in self.rounds:
                h, v, e, g = r(h, v, e, g, t)
        h, v, e, g = (self.norm_hex(h.float()), self.norm_vertex(v.float()), self.norm_edge(e.float()), g.float())
        logits = torch.cat([self.vertex_head(v, g), self.edge_head(e, g), self.hex_head(h, g), self.global_head(g)], -1)
        return logits, self.value_head(g).squeeze(-1)


def masked_logits(logits: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    return logits.masked_fill(~mask, ILLEGAL_LOGIT)


# ---------------------------------------------------------------- policy files

def _b64(t: torch.Tensor) -> str:
    return base64.b64encode(np.ascontiguousarray(t.detach().float().cpu().numpy(), dtype="<f4").tobytes()).decode()


def export_policy(net: CatanNet, path: str, versions: dict, meta: dict | None = None) -> None:
    """Every tensor of the network as base64 little-endian float32 (row-major,
    PyTorch layout), keyed by its state_dict name. The TypeScript runtime will
    read the trunk and policy heads; the value head rides along so Python can
    reload a policy file as an opponent."""
    doc = {
        "format": POLICY_FORMAT,
        "game": GAME,
        **versions,
        "arch": net.arch,
        "tensors": {k: {"shape": list(v.shape), "data": _b64(v)} for k, v in net.state_dict().items()},
        "meta": meta or {},
    }
    _atomic_write(path, json.dumps(doc))


def load_policy(path: str, versions: dict | None = None, device: str | torch.device = "cpu") -> CatanNet:
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    if doc.get("format") != POLICY_FORMAT or doc.get("game") != GAME:
        raise ValueError(f"{path} is not a {GAME} policy ({doc.get('format')}, {doc.get('game')})")
    if versions:
        mine = {k: doc.get(k) for k in versions}
        if mine != versions:
            raise ValueError(f"{path} was trained on {mine}, this build is {versions}")
    a = doc["arch"]
    net = CatanNet(a["dims"], a["num_globals"], a["width"], a["rounds"])
    state = {k: torch.from_numpy(np.frombuffer(base64.b64decode(t["data"]), dtype="<f4").copy().reshape(t["shape"]))
             for k, t in doc["tensors"].items()}
    net.load_state_dict(state)
    return net.to(device).eval()


# ---------------------------------------------------------------- checkpoints

def save_checkpoint(path: str, net: CatanNet, optimizer: torch.optim.Optimizer, state: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    torch.save({"model": net.state_dict(), "optimizer": optimizer.state_dict(), "arch": net.arch, **state}, tmp)
    os.replace(tmp, path)


def load_checkpoint(path: str, device: str | torch.device = "cpu") -> dict:
    return torch.load(path, map_location=device, weights_only=False)


def net_from_checkpoint(ckpt: dict, device: str | torch.device = "cpu") -> CatanNet:
    a = ckpt["arch"]
    net = CatanNet(a["dims"], a["num_globals"], a["width"], a["rounds"]).to(device)
    net.load_state_dict(ckpt["model"])
    return net


def _atomic_write(path: str, text: str) -> None:
    """Readers (opponent pools, evals) never see a half-written file."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)
