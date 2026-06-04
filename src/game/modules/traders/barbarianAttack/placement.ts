import type { GameState, EdgeId, PlayerId } from '../../../types';

// Is `edgeId` a legal place for `playerId` to hire a defender knight?
// Rules:
//   - Edge must directly bound a castle hex (an edge of the castle hex's
//     perimeter — 6 such edges per castle, matching the rulebook's
//     knight slots).
//   - Edge must be empty: no road, ship, bridge, defender knight, or
//     wagon already there.
//   - Shared knight supply must have a token available.
//
// Note: defender knights don't require network connectivity. The rulebook
// treats castle slots as predefined positions any player may fill. This
// keeps Barbarian Attack defenses possible even when an opponent's road
// network rings a castle.
export function canPlaceKnight(
  state: GameState,
  edgeId: EdgeId,
  _playerId: PlayerId,
): boolean {
  if (!state.castles?.length) return false;
  if ((state.barbarianKnightSupply ?? 0) <= 0) return false;
  const edge = state.board.edges[edgeId];
  if (!edge) return false;
  if (edgeIsOccupied(state, edgeId)) return false;
  const castleHexes = new Set(state.castles.map((c) => c.hexId));
  return edge.hexes.some((h) => castleHexes.has(h));
}

// Which castle does this edge belong to (the castle this edge bounds)?
// Returns null if the edge doesn't bound any castle. An edge can only
// bound one castle because castle hexes don't touch each other in our
// layout.
export function castleForEdge(
  state: GameState,
  edgeId: EdgeId,
): string | null {
  if (!state.castles?.length) return null;
  const edge = state.board.edges[edgeId];
  if (!edge) return null;
  for (const c of state.castles) {
    if (edge.hexes.includes(c.hexId)) return c.id;
  }
  return null;
}

// Defender knight edges owned by `playerId` at `castleHexId`.
export function defendersAtCastle(
  state: GameState,
  castleHexId: string,
): Record<PlayerId, EdgeId[]> {
  const out: Record<PlayerId, EdgeId[]> = {};
  for (const p of state.players) {
    const owned: EdgeId[] = [];
    for (const e of p.defenderKnights ?? []) {
      const edge = state.board.edges[e];
      if (edge && edge.hexes.includes(castleHexId)) owned.push(e);
    }
    if (owned.length > 0) out[p.id] = owned;
  }
  return out;
}

function edgeIsOccupied(state: GameState, edgeId: EdgeId): boolean {
  for (const p of state.players) {
    if (p.roads.includes(edgeId)) return true;
    if (p.ships?.includes(edgeId)) return true;
    if (p.bridges?.includes(edgeId)) return true;
    if (p.defenderKnights?.includes(edgeId)) return true;
  }
  if (state.wagons?.some((w) => w.edge === edgeId)) return true;
  return false;
}

