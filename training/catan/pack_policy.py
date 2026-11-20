"""Pack a policy file for shipping: the same network, weights as 16-bit floats
in a binary file instead of base64 float32 text (~4x smaller: Hard 10 MB ->
3.8 MB). The game's runtime (src/ai/nn/runtime.ts `decodePolicyBinary`) and
model.py `load_policy` read both formats.

    python training/catan/pack_policy.py IN.json OUT.bin

Layout (little-endian): the 8 bytes "CATANPOL", a uint32 header length, the
header as UTF-8 JSON (the policy file's fields with each tensor's `shape` and
`offset` instead of its data, plus "dtype": "f16"), zero padding to a multiple
of 8, then every tensor's float16 values back to back (row-major, PyTorch
layout).
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import struct

import numpy as np

MAGIC = b"CATANPOL"


def pack(doc: dict) -> bytes:
    header = {k: v for k, v in doc.items() if k != "tensors"}
    header["dtype"] = "f16"
    header["tensors"] = {}
    chunks: list[bytes] = []
    offset = 0
    for name, t in doc["tensors"].items():
        a = np.frombuffer(base64.b64decode(t["data"]), dtype="<f4")
        if np.abs(a).max(initial=0) > 65504:
            raise ValueError(f"{name}: values beyond the float16 range")
        h = a.astype("<f2")
        header["tensors"][name] = {"shape": t["shape"], "offset": offset}
        chunks.append(h.tobytes())
        offset += h.nbytes
    head = json.dumps(header).encode("utf-8")
    pad = (-(len(MAGIC) + 4 + len(head))) % 8
    return MAGIC + struct.pack("<I", len(head)) + head + b"\0" * pad + b"".join(chunks)


def unpack(blob: bytes) -> tuple[dict, dict[str, np.ndarray]]:
    """(header, float32 tensors) of a packed policy."""
    if blob[:8] != MAGIC:
        raise ValueError("not a packed Catan policy")
    (n,) = struct.unpack("<I", blob[8:12])
    header = json.loads(blob[12:12 + n].decode("utf-8"))
    start = 12 + n + (-(12 + n)) % 8
    tensors = {}
    for name, t in header["tensors"].items():
        count = int(np.prod(t["shape"])) if t["shape"] else 1
        a = np.frombuffer(blob, dtype="<f2", count=count, offset=start + t["offset"])
        tensors[name] = a.astype(np.float32).reshape(t["shape"])
    return header, tensors


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("src")
    p.add_argument("dst")
    a = p.parse_args(argv)
    with open(a.src, encoding="utf-8") as f:
        doc = json.load(f)
    blob = pack(doc)
    tmp = a.dst + ".tmp"
    with open(tmp, "wb") as f:
        f.write(blob)
    os.replace(tmp, a.dst)
    _, back = unpack(blob)
    worst = max(float(np.abs(back[k] - np.frombuffer(base64.b64decode(t["data"]), dtype="<f4").reshape(t["shape"])).max(initial=0))
                for k, t in doc["tensors"].items())
    print(f"{a.src} ({os.path.getsize(a.src) / 1e6:.1f} MB) -> {a.dst} ({len(blob) / 1e6:.1f} MB), "
          f"largest weight change {worst:.2e}")


if __name__ == "__main__":
    main()
