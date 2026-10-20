"""Speed / memory check of the network on this GPU (no env needed beyond the spec).

    python training/catan/bench_model.py
"""

from __future__ import annotations

import argparse
import time

import torch

from env_client import CatanEnv
from model import CatanNet, Topology


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--width", type=int, default=64)
    p.add_argument("--rounds", type=int, default=4)
    p.add_argument("--batches", default="448,2048,4096")
    args = p.parse_args()
    with CatanEnv() as env:
        dims, n_globals, shape, topo = env.dims, len(env.global_slots), env.shape, env.topology
    dev = "cuda"
    H, V, E = shape["hexes"], shape["vertices"], shape["edges"]
    for mode in ("fp32", "tf32", "bf16"):
        torch.backends.cuda.matmul.allow_tf32 = mode != "fp32"
        torch.backends.cudnn.allow_tf32 = mode != "fp32"
        net = CatanNet(dims, n_globals, args.width, args.rounds).to(dev)
        net.amp = mode == "bf16"
        net.topology = Topology(topo, shape, dev)
        opt = torch.optim.Adam(net.parameters())
        for B in (int(b) for b in args.batches.split(",")):
            x = (torch.randn(B, H, dims["hex"], device=dev), torch.randn(B, V, dims["vertex"], device=dev),
                 torch.randn(B, E, dims["edge"], device=dev), torch.randn(B, dims["global"], device=dev))
            torch.cuda.synchronize()
            torch.cuda.reset_peak_memory_stats()
            for i in range(6):
                if i == 1:
                    torch.cuda.synchronize()
                    t0 = time.perf_counter()
                logits, value = net(*x)
                loss = logits.logsumexp(-1).mean() + value.pow(2).mean()
                opt.zero_grad()
                loss.backward()
                opt.step()
            torch.cuda.synchronize()
            train = (time.perf_counter() - t0) / 5
            with torch.no_grad():
                torch.cuda.synchronize()
                t1 = time.perf_counter()
                for _ in range(5):
                    net(*x)
                torch.cuda.synchronize()
                infer = (time.perf_counter() - t1) / 5
            print(f"{mode} B={B}: train step {train * 1000:.1f} ms, inference {infer * 1000:.1f} ms, "
                  f"peak {torch.cuda.max_memory_allocated() / 1e9:.2f} GB", flush=True)
    print(f"params {sum(p.numel() for p in net.parameters()):,}")


if __name__ == "__main__":
    main()
