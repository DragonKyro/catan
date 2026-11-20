// Catan learned agent — the policy network in plain TypeScript.
//
// Runs a `catan/gnn@1` policy file (exported by training/catan/model.py) on
// the encoder's feature rows: the same layers in the same order, in float32,
// with no ML library. Training ran the trunk in bfloat16, so logits differ
// from PyTorch's float32 forward only by rounding (the parity test in
// training/catan/test_training.py compares the two).
//
//   embed     each row type → width d (Linear, ReLU, Linear)
//   rounds    hex    ← self, mean of its corners, global
//             vertex ← self, mean of its hexes, edges and neighbour vertices, global
//             edge   ← self, mean of its endpoints and hexes, global
//             global ← self, mean + max over hexes, vertices, edges (then LayerNorm)
//             each x ← x + W_out · ReLU(Σ_k W_k · part_k + U · global)
//   heads     LayerNorm per row type; a logit per vertex / edge / hex from
//             ReLU(W_row · x + W_g · global); global-slot logits from the global vector
//
// Neighbour means read the board index's padded topology arrays (−1 = none),
// so any board size works. The value head is in the file but never needed
// to play.

import type { BoardIndex } from './board';
import { EDGE_DIM, ENCODER_VERSION, GLOBAL_DIM, HEX_DIM, VERTEX_DIM, type CatanFeatures } from './encode';
import { ACTION_SPACE_VERSION, GLOBAL_SLOTS } from './actions';
import type { SlotPolicy } from './agent';

export const POLICY_FORMAT = 'catan/gnn@1';

interface TensorJson {
  shape: number[];
  /** Base64 float32 (training's .json files), or already decoded (packed .bin files). */
  data: string | Float32Array;
}

export interface CatanPolicyFile {
  format: string;
  game: string;
  encoderVersion: number;
  actionSpaceVersion: number;
  arch: { dims: { hex: number; vertex: number; edge: number; global: number }; num_globals: number; width: number; rounds: number };
  tensors: Record<string, TensorJson>;
  meta?: Record<string, unknown>;
}

/** float16 bit pattern → float32, for all 65,536 patterns (built on first use). */
let halfTable: Float32Array | null = null;
function halfToFloat(): Float32Array {
  if (halfTable) return halfTable;
  const t = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const sign = h & 0x8000 ? -1 : 1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    t[h] = exp === 0 ? sign * 2 ** -14 * (frac / 1024)
      : exp === 31 ? (frac ? Number.NaN : sign * Infinity)
        : sign * 2 ** (exp - 15) * (1 + frac / 1024);
  }
  halfTable = t;
  return t;
}

const POLICY_MAGIC = 'CATANPOL';

/** Is this a packed (.bin) policy file? */
export function isPolicyBinary(buf: ArrayBuffer | Uint8Array): boolean {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return b.length >= 12 && String.fromCharCode(...b.subarray(0, 8)) === POLICY_MAGIC;
}

/**
 * A packed policy file (training/catan/pack_policy.py: header JSON + float16
 * weights) as a CatanPolicyFile with float32 tensors, ready for CatanPolicyNet.
 */
export function decodePolicyBinary(buf: ArrayBuffer | Uint8Array): CatanPolicyFile {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (!isPolicyBinary(bytes)) throw new Error('not a packed Catan policy file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + n))) as Omit<CatanPolicyFile, 'tensors'> & {
    dtype: string;
    tensors: Record<string, { shape: number[]; offset: number }>;
  };
  if (header.dtype !== 'f16') throw new Error(`packed policy dtype ${header.dtype} is not supported`);
  const start = 12 + n + ((8 - ((12 + n) % 8)) % 8);
  const table = halfToFloat();
  const tensors: Record<string, TensorJson> = {};
  for (const [name, t] of Object.entries(header.tensors)) {
    const count = t.shape.reduce((a, b) => a * b, 1);
    const at = start + t.offset;
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) out[i] = table[view.getUint16(at + 2 * i, true)]!;
    tensors[name] = { shape: t.shape, data: out };
  }
  const { dtype: _dtype, tensors: _t, ...rest } = header;
  void _dtype;
  void _t;
  return { ...rest, tensors };
}

function decodeFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length % 4 !== 0) throw new Error('float32 data length is not a multiple of 4');
  return new Float32Array(bytes.buffer);
}

/** y = W·x (+ b) for every row of x; W is PyTorch's [out][in] row-major. */
class Linear {
  constructor(readonly w: Float32Array, readonly b: Float32Array | null, readonly nIn: number, readonly nOut: number) {}

  /** out[r] (+)= W·x[r] (+ b) for `rows` rows. */
  apply(x: Float32Array, rows: number, out: Float32Array, accumulate = false): Float32Array {
    const { w, b, nIn, nOut } = this;
    for (let r = 0; r < rows; r++) {
      const xi = r * nIn;
      const yo = r * nOut;
      for (let o = 0; o < nOut; o++) {
        let s = b ? b[o]! : 0;
        const wo = o * nIn;
        for (let i = 0; i < nIn; i++) s += w[wo + i]! * x[xi + i]!;
        out[yo + o] = accumulate ? out[yo + o]! + s : s;
      }
    }
    return out;
  }
}

interface Norm {
  w: Float32Array;
  b: Float32Array;
}

interface Update {
  parts: Linear[];
  fromGlobal: Linear | null;
  out: Linear;
  norm: Norm | null;
}

interface Head {
  row: Linear;
  glob: Linear;
  out: Linear;
}

const relu = (x: Float32Array) => {
  for (let i = 0; i < x.length; i++) if (x[i]! < 0) x[i] = 0;
  return x;
};

function layerNorm(x: Float32Array, rows: number, d: number, n: Norm): Float32Array {
  for (let r = 0; r < rows; r++) {
    const o = r * d;
    let mean = 0;
    for (let i = 0; i < d; i++) mean += x[o + i]!;
    mean /= d;
    let v = 0;
    for (let i = 0; i < d; i++) v += (x[o + i]! - mean) ** 2;
    const inv = 1 / Math.sqrt(v / d + 1e-5);
    for (let i = 0; i < d; i++) x[o + i] = (x[o + i]! - mean) * inv * n.w[i]! + n.b[i]!;
  }
  return x;
}

/** Mean over each row's neighbours: `idx` is rows × width, −1-padded, into `src` (n × d). */
function neighbourMean(src: Float32Array, idx: Int32Array, rows: number, width: number, d: number): Float32Array {
  const out = new Float32Array(rows * d);
  for (let r = 0; r < rows; r++) {
    let count = 0;
    for (let k = 0; k < width; k++) {
      const j = idx[r * width + k]!;
      if (j < 0) continue;
      count++;
      for (let i = 0; i < d; i++) out[r * d + i]! += src[j * d + i]!;
    }
    if (count > 1) for (let i = 0; i < d; i++) out[r * d + i]! /= count;
  }
  return out;
}

function pool(x: Float32Array, rows: number, d: number): [Float32Array, Float32Array] {
  const mean = new Float32Array(d);
  const max = new Float32Array(d).fill(-Infinity);
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < d; i++) {
      const v = x[r * d + i]!;
      mean[i]! += v;
      if (v > max[i]!) max[i] = v;
    }
  }
  for (let i = 0; i < d; i++) mean[i]! /= rows;
  return [mean, max];
}

export class CatanPolicyNet {
  readonly width: number;
  readonly meta: Record<string, unknown>;
  private readonly embed: Record<'hex' | 'vertex' | 'edge' | 'global', [Linear, Linear]>;
  private readonly rounds: Array<{ hex: Update; vertex: Update; edge: Update; glob: Update }>;
  private readonly norms: Record<'hex' | 'vertex' | 'edge', Norm>;
  private readonly heads: Record<'vertex' | 'edge' | 'hex', Head>;
  private readonly globalHead: [Linear, Linear];

  constructor(file: CatanPolicyFile) {
    if (file.format !== POLICY_FORMAT || file.game !== 'catan') {
      throw new Error(`not a Catan policy file (${file.format}, ${file.game})`);
    }
    if (file.encoderVersion !== ENCODER_VERSION || file.actionSpaceVersion !== ACTION_SPACE_VERSION) {
      throw new Error(`policy was trained on encoder v${file.encoderVersion} / action space v${file.actionSpaceVersion}; `
        + `this build is v${ENCODER_VERSION} / v${ACTION_SPACE_VERSION} — retrain and re-freeze it`);
    }
    const { dims, num_globals, width: d, rounds } = file.arch;
    if (dims.hex !== HEX_DIM || dims.vertex !== VERTEX_DIM || dims.edge !== EDGE_DIM || dims.global !== GLOBAL_DIM
      || num_globals !== GLOBAL_SLOTS.length) {
      throw new Error('policy file dimensions do not match this build');
    }
    this.width = d;
    this.meta = file.meta ?? {};
    const tensor = (name: string, shape: number[]) => {
      const t = file.tensors[name];
      if (!t) throw new Error(`policy file is missing ${name}`);
      if (t.shape.join() !== shape.join()) throw new Error(`${name} is [${t.shape}], expected [${shape}]`);
      return typeof t.data === 'string' ? decodeFloat32(t.data) : t.data;
    };
    const linear = (name: string, nIn: number, nOut: number, bias = true) =>
      new Linear(tensor(`${name}.weight`, [nOut, nIn]), bias ? tensor(`${name}.bias`, [nOut]) : null, nIn, nOut);
    const norm = (name: string): Norm => ({ w: tensor(`${name}.weight`, [d]), b: tensor(`${name}.bias`, [d]) });
    const mlp = (name: string, nIn: number, hidden: number, nOut: number): [Linear, Linear] =>
      [linear(`${name}.0`, nIn, hidden), linear(`${name}.2`, hidden, nOut)];
    const update = (name: string, parts: number, fromGlobal: boolean, withNorm: boolean): Update => ({
      parts: Array.from({ length: parts }, (_, k) => linear(`${name}.parts.${k}`, d, d, k === 0)),
      fromGlobal: fromGlobal ? linear(`${name}.from_global`, d, d, false) : null,
      out: linear(`${name}.out`, d, d),
      norm: withNorm ? norm(`${name}.norm`) : null,
    });
    const head = (name: string): Head => ({
      row: linear(`${name}.row`, d, d), glob: linear(`${name}.glob`, d, d, false), out: linear(`${name}.out`, d, 1),
    });
    this.embed = {
      hex: mlp('embed_hex', HEX_DIM, d, d),
      vertex: mlp('embed_vertex', VERTEX_DIM, d, d),
      edge: mlp('embed_edge', EDGE_DIM, d, d),
      global: mlp('embed_global', GLOBAL_DIM, 2 * d, d),
    };
    this.rounds = Array.from({ length: rounds }, (_, r) => ({
      hex: update(`rounds.${r}.hex`, 2, true, false),
      vertex: update(`rounds.${r}.vertex`, 4, true, false),
      edge: update(`rounds.${r}.edge`, 3, true, false),
      glob: update(`rounds.${r}.glob`, 7, false, true),
    }));
    this.norms = { hex: norm('norm_hex'), vertex: norm('norm_vertex'), edge: norm('norm_edge') };
    this.heads = { vertex: head('vertex_head'), edge: head('edge_head'), hex: head('hex_head') };
    this.globalHead = mlp('global_head', d, d, num_globals);
  }

  /** One logit per action slot (actions.ts order: vertices, edges, hexes, globals). */
  logits(f: CatanFeatures, idx: BoardIndex): Float32Array {
    const d = this.width;
    const H = f.numHexes;
    const V = f.numVertices;
    const E = f.numEdges;
    const embed = ([a, b]: [Linear, Linear], x: Float32Array, rows: number) =>
      b.apply(relu(a.apply(x, rows, new Float32Array(rows * a.nOut))), rows, new Float32Array(rows * d));
    let h = embed(this.embed.hex, f.hexes, H);
    let v = embed(this.embed.vertex, f.vertices, V);
    let e = embed(this.embed.edge, f.edges, E);
    let g = embed(this.embed.global, f.global, 1);

    // x + W_out·ReLU(Σ parts + U·g), the global term computed once and broadcast.
    const step = (u: Update, x: Float32Array, rows: number, parts: Float32Array[], gv: Float32Array) => {
      const z = new Float32Array(rows * d);
      u.parts.forEach((lin, k) => lin.apply(parts[k]!, rows, z, k > 0));
      if (u.fromGlobal) {
        const gu = u.fromGlobal.apply(gv, 1, new Float32Array(d));
        for (let r = 0; r < rows; r++) for (let i = 0; i < d; i++) z[r * d + i]! += gu[i]!;
      }
      const y = u.out.apply(relu(z), rows, new Float32Array(rows * d));
      for (let i = 0; i < y.length; i++) y[i]! += x[i]!;
      return u.norm ? layerNorm(y, rows, d, u.norm) : y;
    };

    for (const r of this.rounds) {
      const h2 = step(r.hex, h, H, [h, neighbourMean(v, idx.hexVertices, H, 6, d)], g);
      const v2 = step(r.vertex, v, V, [
        v,
        neighbourMean(h, idx.vertexHexes, V, 3, d),
        neighbourMean(e, idx.vertexEdges, V, 3, d),
        neighbourMean(v, idx.vertexNeighbors, V, 3, d),
      ], g);
      const e2 = step(r.edge, e, E, [e, neighbourMean(v, idx.edgeVertices, E, 2, d), neighbourMean(h, idx.edgeHexes, E, 2, d)], g);
      const [hm, hx] = pool(h2, H, d);
      const [vm, vx] = pool(v2, V, d);
      const [em, ex] = pool(e2, E, d);
      // The global update reads this round's entity states (hm, hx, vm, vx, em, ex), as in model.py.
      const g2 = step(r.glob, g, 1, [g, hm, hx, vm, vx, em, ex], g);
      h = h2;
      v = v2;
      e = e2;
      g = g2;
    }
    layerNorm(h, H, d, this.norms.hex);
    layerNorm(v, V, d, this.norms.vertex);
    layerNorm(e, E, d, this.norms.edge);

    const out = new Float32Array(V + E + H + GLOBAL_SLOTS.length);
    const entity = (head: Head, x: Float32Array, rows: number, at: number) => {
      const gu = head.glob.apply(g, 1, new Float32Array(d));
      const z = head.row.apply(x, rows, new Float32Array(rows * d));
      for (let r = 0; r < rows; r++) for (let i = 0; i < d; i++) z[r * d + i]! += gu[i]!;
      head.out.apply(relu(z), rows, out.subarray(at, at + rows));
    };
    entity(this.heads.vertex, v, V, 0);
    entity(this.heads.edge, e, E, V);
    entity(this.heads.hex, h, H, V + E);
    const [g1, g2] = this.globalHead;
    g2.apply(relu(g1.apply(g, 1, new Float32Array(d))), 1, out.subarray(V + E + H));
    return out;
  }
}

/** The highest-scoring legal slot (lowest index on ties), or −1 if none is legal. */
export function greedySlot(logits: ArrayLike<number>, mask: ArrayLike<number>): number {
  let best = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && (best === -1 || logits[i]! > logits[best]!)) best = i;
  }
  return best;
}

/** A slot policy that always plays the network's top legal move (how the evals measured it). */
export function greedyPolicy(net: CatanPolicyNet): SlotPolicy {
  return (features, mask, obs) => greedySlot(net.logits(features, obs.index), mask);
}
