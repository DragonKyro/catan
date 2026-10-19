// stdio bridge from CatanVecEnv to an out-of-process learner (Python).
// One JSON object per line in, one per line out, strictly request/response.
//
//   → {"cmd":"spec","players":4}
//   ← {"ok":true,"dims":{hex,vertex,edge,global},"shape":{hexes,vertices,edges,slots},
//      "globalSlots":[…],"layouts":{hex,vertex,edge,global},"topology":{…},
//      "encoderVersion":…,"actionSpaceVersion":…}
//   → {"cmd":"reset","options":{numEnvs, seed, players, seats, maxTurns, maxSteps,
//      vpShaping, victoryPoints, reward, quota}}
//   → {"cmd":"step","actions":[slot, …]}          (one per env)
//   ← {"ok":true,"n":…,"seat":[…],"role":[…],"reward":[…],"done":[…],"episodes":[…],
//      "binary":[["hexes",bytes],["vertices",bytes],["edges",bytes],["global",bytes],["mask",bytes]]}
//     followed by those raw bytes, in that order: f32 little-endian features, u8 mask
//   → {"cmd":"configure","options":{seats}}       ← {"ok":true}
//   → {"cmd":"close"}
//   ← {"ok":false,"error":"…"}                       (on any failure)
//
// Batch replies carry the (large) feature arrays as raw bytes after the JSON
// line instead of base64 inside it — decoding is then a buffer view on both
// sides. Every other reply is a JSON line alone.
//
// `topology` is the board index (src/ai/nn/board.ts) as plain arrays, −1 padded:
// hexVertices H×6, vertexHexes / vertexEdges / vertexNeighbors V×3,
// edgeVertices / edgeHexes E×2.
//
// Nothing else is written to stdout; diagnostics go to stderr.

import { createInterface } from 'node:readline';
import { createGame } from '@/game/createGame';
import { boardIndex } from '@/ai/nn/board';
import { ACTION_SPACE_VERSION, GLOBAL_SLOTS } from '@/ai/nn/actions';
import {
  EDGE_DIM, EDGE_LAYOUT, ENCODER_VERSION, GLOBAL_DIM, GLOBAL_LAYOUT, HEX_DIM, HEX_LAYOUT, VERTEX_DIM, VERTEX_LAYOUT,
} from '@/ai/nn/encode';
import { CatanVecEnv, boardShape, type VecBatch, type VecEnvOptions } from './vec-env';

const bytes = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

/** A batch reply: the JSON line, then the feature arrays as raw bytes. */
class BatchReply {
  constructor(readonly b: VecBatch) {}

  write(): void {
    const b = this.b;
    const arrays: Array<[string, ArrayBufferView]> = [
      ['hexes', b.hexes], ['vertices', b.vertices], ['edges', b.edges], ['global', b.global], ['mask', b.mask],
    ];
    const header = {
      ok: true,
      n: b.seat.length,
      seat: Array.from(b.seat),
      role: Array.from(b.role),
      reward: Array.from(b.reward),
      done: Array.from(b.done),
      episodes: b.episodes,
      binary: arrays.map(([name, a]) => [name, a.byteLength]),
    };
    process.stdout.write(Buffer.concat([Buffer.from(JSON.stringify(header) + '\n'), ...arrays.map(([, a]) => bytes(a))]));
  }
}

function spec(players: number) {
  const idx = boardIndex(createGame({ playerNames: Array.from({ length: players }, (_, i) => `p${i}`), seed: 1 }).board);
  return {
    ok: true,
    dims: { hex: HEX_DIM, vertex: VERTEX_DIM, edge: EDGE_DIM, global: GLOBAL_DIM },
    shape: boardShape(players),
    globalSlots: GLOBAL_SLOTS,
    layouts: {
      hex: HEX_LAYOUT.segments, vertex: VERTEX_LAYOUT.segments, edge: EDGE_LAYOUT.segments, global: GLOBAL_LAYOUT.segments,
    },
    topology: {
      hexVertices: Array.from(idx.hexVertices),
      vertexHexes: Array.from(idx.vertexHexes),
      vertexEdges: Array.from(idx.vertexEdges),
      vertexNeighbors: Array.from(idx.vertexNeighbors),
      edgeVertices: Array.from(idx.edgeVertices),
      edgeHexes: Array.from(idx.edgeHexes),
    },
    encoderVersion: ENCODER_VERSION,
    actionSpaceVersion: ACTION_SPACE_VERSION,
  };
}

let env: CatanVecEnv | null = null;

interface Request {
  cmd?: string;
  players?: number;
  options?: Partial<VecEnvOptions>;
  actions?: number[];
}

function handle(msg: Request): object | BatchReply {
  switch (msg.cmd) {
    case 'spec':
      return spec(msg.players ?? 4);
    case 'reset':
      env = new CatanVecEnv(msg.options ?? {});
      return new BatchReply(env.reset());
    case 'step':
      if (!env) throw new Error('step before reset');
      if (!Array.isArray(msg.actions)) throw new Error('step needs "actions": number[]');
      return new BatchReply(env.step(msg.actions));
    case 'configure':
      if (!env) throw new Error('configure before reset');
      env.configure(msg.options ?? {});
      return { ok: true };
    case 'close':
      process.exit(0);
    default:
      throw new Error(`unknown cmd ${JSON.stringify(msg.cmd)}`);
  }
}

createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', (line) => {
  if (!line.trim()) return;
  let reply: object | BatchReply;
  try {
    reply = handle(JSON.parse(line));
  } catch (e) {
    reply = { ok: false, error: (e as Error).stack ?? (e as Error).message };
  }
  if (reply instanceof BatchReply) reply.write();
  else process.stdout.write(JSON.stringify(reply) + '\n');
});
