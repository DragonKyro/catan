import type {
  BoardState,
  EdgeId,
  FishingGround,
  HexId,
  RiverPath,
  VertexId,
} from '../../../types';
import { shuffle } from '../../../rng';
import type { FishingGroundDef, RiverDef, ScenarioEdgeRef } from './scenarios/types';

// Resolve the Rivers of Catan / Fishing on Catan declarations (axial hex
// coords + edge directions) against a freshly built board.

// Edge `direction` of hex (q, r): the edge between its corners `direction`
// and `direction + 1` (same convention as ScenarioPortAnchor / resolvePorts).
export function resolveEdgeRef(board: BoardState, ref: ScenarioEdgeRef): EdgeId | null {
  const hex = board.hexes[`${ref.q},${ref.r}`];
  if (!hex) return null;
  const v1 = hex.corners[ref.direction];
  const v2 = hex.corners[(ref.direction + 1) % 6];
  if (!v1 || !v2) return null;
  return edgeBetween(board, v1, v2);
}

function edgeBetween(board: BoardState, a: VertexId, b: VertexId): EdgeId | null {
  for (const eid of board.vertices[a]?.edges ?? []) {
    const e = board.edges[eid]!;
    if (e.vertices.includes(b)) return eid;
  }
  return null;
}

// The edge two neighbouring hexes share.
function sharedEdge(board: BoardState, h1: HexId, h2: HexId): EdgeId | null {
  const a = board.hexes[h1];
  const b = board.hexes[h2];
  if (!a || !b) return null;
  const common = a.corners.filter((v) => b.corners.includes(v));
  if (common.length !== 2) return null;
  return edgeBetween(board, common[0]!, common[1]!);
}

// Rivers → runtime river paths plus the bridge sites: every edge shared by
// consecutive river hexes, and each river's mouth.
export function resolveRivers(
  defs: RiverDef[],
  board: BoardState,
): { rivers: RiverPath[]; riverEdges: EdgeId[] } {
  const rivers: RiverPath[] = [];
  const sites: EdgeId[] = [];
  for (const def of defs) {
    const hexes = def.hexes
      .map(({ q, r }) => `${q},${r}`)
      .filter((id) => board.hexes[id] !== undefined);
    if (hexes.length === 0) continue;
    for (let i = 0; i + 1 < hexes.length; i++) {
      const e = sharedEdge(board, hexes[i]!, hexes[i + 1]!);
      if (e && !sites.includes(e)) sites.push(e);
    }
    const mouth = def.mouth ? resolveEdgeRef(board, def.mouth) : null;
    if (mouth && !sites.includes(mouth)) sites.push(mouth);
    rivers.push({ hexes, mouth });
  }
  return { rivers, riverEdges: sites };
}

// Fishing grounds: each tile's two coastal edges and their three corners,
// with the numbers dealt at random (seeded).
export function resolveFishingGrounds(
  defs: FishingGroundDef[],
  tokens: number[],
  board: BoardState,
  rngState: number,
): [FishingGround[], number] {
  if (defs.length === 0) return [[], rngState];
  const [dealt, rng] = shuffle(rngState, tokens);
  const out: FishingGround[] = [];
  defs.forEach((def, i) => {
    const edges = def.edges
      .map((ref) => resolveEdgeRef(board, ref))
      .filter((e): e is EdgeId => e !== null);
    if (edges.length !== 2) return;
    const [e1, e2] = edges.map((e) => board.edges[e]!);
    const middle = e1!.vertices.find((v) => e2!.vertices.includes(v));
    if (!middle) return;
    const outer1 = e1!.vertices.find((v) => v !== middle)!;
    const outer2 = e2!.vertices.find((v) => v !== middle)!;
    out.push({ vertices: [outer1, middle, outer2], edges, token: dealt[i] ?? 0 });
  });
  return [out, rng];
}
