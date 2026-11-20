"""Upgrade a policy file to this build's encoder and action space, when the
newer versions only appended features / slots. Everything the file already
has is copied unchanged, so the upgraded policy plays exactly as before:

  - encoder (v2 appended features at the end of each row): the four input
    layers (embed_*.0.weight) gain zero-weight columns for the new features;
  - action space (v2 appended the 3:1 / 1:3 / 3:2 / 2:3 player offers after
    every v1 slot): the global head's last layer gains one row per new slot,
    as --new-offers says.

    python training/catan/upgrade_policy.py IN.json OUT.json --new-offers frozen
    python training/catan/upgrade_policy.py IN.json OUT.json --new-offers warm

  frozen  the new slots are never chosen (bias -100): the policy plays exactly
          as before. For shipped AI levels that weren't trained with them.
  warm    each new offer copies the row of the nearest old one (3:1 and 3:2
          from 2:1, 1:3 and 2:3 from 1:2, same resources) with its bias
          lowered by --warm-offset (default 2, about 1/7 the odds): a starting
          point for training that explores them.

Needs the built env (`npm run train:build`) for this build's slot names.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys

import numpy as np

HEAD_W, HEAD_B = "global_head.2.weight", "global_head.2.bias"
# Input layer per row type (Linear weight [out, in_features]).
EMBED = {"hex": "embed_hex.0.weight", "vertex": "embed_vertex.0.weight",
         "edge": "embed_edge.0.weight", "global": "embed_global.0.weight"}
# New offer shape (give n, get m) -> the old shape its row starts from.
SOURCE_SHAPE = {(3, 1): (2, 1), (1, 3): (1, 2), (3, 2): (2, 1), (2, 3): (1, 2)}
FROZEN_BIAS = -100.0
OFFER = re.compile(r"offer:(\d)([a-z]+)>(\d)([a-z]+)")


def _decode(t: dict) -> np.ndarray:
    return np.frombuffer(base64.b64decode(t["data"]), dtype="<f4").copy().reshape(t["shape"])


def _encode(a: np.ndarray) -> dict:
    a = np.ascontiguousarray(a, dtype="<f4")
    return {"shape": list(a.shape), "data": base64.b64encode(a.tobytes()).decode()}


def source_slot(name: str, slots: list[str]) -> int:
    """Index of the old slot a new offer's row starts from."""
    m = OFFER.fullmatch(name)
    if not m or (int(m.group(1)), int(m.group(3))) not in SOURCE_SHAPE:
        raise ValueError(f"don't know how to start new slot {name!r}")
    n, m2 = SOURCE_SHAPE[(int(m.group(1)), int(m.group(3)))]
    return slots.index(f"offer:{n}{m.group(2)}>{m2}{m.group(4)}")


def upgrade_doc(doc: dict, slots: list[str], version: int, mode: str, warm_offset: float = 2.0) -> dict:
    """A copy of policy `doc` for the action space whose global slots are
    `slots` (append-only over the file's), at action space `version`."""
    old = doc["arch"]["num_globals"]
    if old > len(slots):
        raise ValueError(f"policy has {old} global slots, this build only {len(slots)}")
    if old == len(slots) and doc["actionSpaceVersion"] == version:
        return doc
    w, b = _decode(doc["tensors"][HEAD_W]), _decode(doc["tensors"][HEAD_B])
    if w.shape[0] != old or b.shape[0] != old:
        raise ValueError(f"{HEAD_W} is {w.shape}, expected {old} rows")
    new_w, new_b = [w], [b]
    for name in slots[old:]:
        if mode == "frozen":
            new_w.append(np.zeros((1, w.shape[1]), np.float32))
            new_b.append(np.array([FROZEN_BIAS], np.float32))
        elif mode == "warm":
            k = source_slot(name, slots)
            if k >= old:
                raise ValueError(f"{name!r} would start from {slots[k]!r}, which is new too")
            new_w.append(w[k:k + 1].copy())
            new_b.append(b[k:k + 1] - warm_offset)
        else:
            raise ValueError(f"mode {mode!r}: frozen or warm")
    out = json.loads(json.dumps(doc))  # deep copy
    out["tensors"][HEAD_W] = _encode(np.concatenate(new_w, 0))
    out["tensors"][HEAD_B] = _encode(np.concatenate(new_b, 0))
    out["arch"]["num_globals"] = len(slots)
    out["meta"] = {**doc.get("meta", {}), "upgradedFrom": {"actionSpaceVersion": doc["actionSpaceVersion"],
                                                           "numGlobals": old, "newSlots": mode}}
    out["actionSpaceVersion"] = version
    return out


def upgrade_encoder(doc: dict, dims: dict, version: int) -> dict:
    """A copy of policy `doc` for an encoder whose rows are the file's with
    features appended (`dims` per row type, at encoder `version`): the new
    input columns get zero weight."""
    old = doc["arch"]["dims"]
    if all(old[k] == dims[k] for k in EMBED) and doc["encoderVersion"] == version:
        return doc
    out = json.loads(json.dumps(doc))
    for kind, name in EMBED.items():
        w = _decode(doc["tensors"][name])
        if w.shape[1] != old[kind]:
            raise ValueError(f"{name} is {w.shape}, expected {old[kind]} input features")
        if dims[kind] < old[kind]:
            raise ValueError(f"{kind} rows shrank ({old[kind]} -> {dims[kind]}): not an append-only encoder change")
        pad = np.zeros((w.shape[0], dims[kind] - old[kind]), np.float32)
        out["tensors"][name] = _encode(np.concatenate([w, pad], 1))
    out["arch"]["dims"] = {**old, **{k: dims[k] for k in EMBED}}
    out["meta"] = {**doc.get("meta", {}), "encoderUpgradedFrom": {"encoderVersion": doc["encoderVersion"], "dims": old}}
    out["encoderVersion"] = version
    return out


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--new-offers", choices=("frozen", "warm"), default=None,
                   help="how new action slots start (needed only when the action space grew)")
    p.add_argument("--warm-offset", type=float, default=2.0)
    a = p.parse_args(argv)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from env_client import CatanEnv

    env = CatanEnv(players=4)
    try:
        slots, version, enc, dims = env.global_slots, env.action_space_version, env.encoder_version, env.dims
    finally:
        env.close()
    with open(a.src, encoding="utf-8") as f:
        doc = json.load(f)
    out = upgrade_encoder(doc, dims, enc)
    if out["arch"]["num_globals"] != len(slots) or out["actionSpaceVersion"] != version:
        if not a.new_offers:
            raise SystemExit("the action space grew: say how new slots start with --new-offers frozen|warm")
        out = upgrade_doc(out, slots, version, a.new_offers, a.warm_offset)
    tmp = a.dst + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f)
    os.replace(tmp, a.dst)
    print(f"{a.src} (encoder v{doc['encoderVersion']}, action space v{doc['actionSpaceVersion']}, "
          f"{doc['arch']['num_globals']} globals) -> {a.dst} (encoder v{enc}, action space v{version}, {len(slots)} globals)")


if __name__ == "__main__":
    main()
