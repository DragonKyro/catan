import type {
  GameState,
  KnightRecord,
  KnightStrength,
  PlayerId,
  VertexId,
} from '../../../types';
import { LEVEL3_ABILITY_THRESHOLD } from '../constants';

// Pure read-side helpers for knight state. No mutations.

export function knightAt(
  state: GameState,
  vertex: VertexId,
): KnightRecord | undefined {
  return state.knights?.[vertex];
}

export function playerKnights(
  state: GameState,
  playerId: PlayerId,
): Array<{ vertex: VertexId; knight: KnightRecord }> {
  const out: Array<{ vertex: VertexId; knight: KnightRecord }> = [];
  for (const [vid, k] of Object.entries(state.knights ?? {})) {
    if (k.playerId === playerId) out.push({ vertex: vid, knight: k });
  }
  return out;
}

// How many knights of a given strength does this player have left in supply?
export function supplyAvailable(
  state: GameState,
  playerId: PlayerId,
  strength: KnightStrength,
): number {
  return state.knightSupply?.[playerId]?.[strength] ?? 0;
}

// Mighty knights (level 3) require politics improvement >= 3 to promote into.
export function mightyAllowed(state: GameState, playerId: PlayerId): boolean {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  return (p.improvements?.politics ?? 0) >= LEVEL3_ABILITY_THRESHOLD;
}

// Helper: is vertex occupied by anyone (any building OR any knight, mine or
// otherwise)? Used by recruit (place on empty vertex) and move (destination
// must be empty).
export function vertexIsOccupied(
  state: GameState,
  vertex: VertexId,
): boolean {
  if (state.knights?.[vertex]) return true;
  for (const p of state.players) {
    if (p.settlements.includes(vertex) || p.cities.includes(vertex)) return true;
  }
  return false;
}

// Player-owned road/ship/bridge edges as a Set for the knight movement BFS.
export function playerNetworkEdges(
  state: GameState,
  playerId: PlayerId,
): Set<string> {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return new Set();
  const out = new Set<string>();
  for (const eid of p.roads) out.add(eid);
  for (const eid of p.ships) out.add(eid);
  for (const eid of p.bridges ?? []) out.add(eid);
  return out;
}

// True if `vertex` is adjacent (via any edge) to a player-owned road/ship/
// bridge. Used by recruitKnight (a freshly recruited knight must connect
// to your network).
export function vertexConnectedToOwnNetwork(
  state: GameState,
  playerId: PlayerId,
  vertex: VertexId,
): boolean {
  const v = state.board.vertices[vertex];
  if (!v) return false;
  const ownEdges = playerNetworkEdges(state, playerId);
  for (const eid of v.edges) {
    if (ownEdges.has(eid)) return true;
  }
  return false;
}

// True if `vertex` is among the corners of the robber hex (knight can chase
// the robber from that vertex).
export function vertexAdjacentToRobber(
  state: GameState,
  vertex: VertexId,
): boolean {
  const robberHex = state.board.robberHex;
  const v = state.board.vertices[vertex];
  if (!v) return false;
  return v.hexes.includes(robberHex);
}
