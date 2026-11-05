import type { EdgeId, GameState, HexId, PlayerId, VertexId } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { recalcWealthTiles } from '../scoring/wealthTiles';

// Coins (T&B Rivers of Catan; Barbarian Attack and the Traders & Barbarians
// scenario use the same coins). Gold is a separate currency on
// `player.gold`: not a resource card, not in the hand size, never stolen or
// monopolised.

// Change a player's gold by `delta` and refresh the Wealthiest / Poor
// Catanian tiles when the scenario tracks them (`state.wealthTiles`). The
// one place gold should change, so the wealth status is never stale.
export function addGold(state: GameState, playerId: PlayerId, delta: number): GameState {
  if (delta === 0) return state;
  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    gold: Math.max(0, (p.gold ?? 0) + delta),
  }));
  return refreshWealthTiles(next);
}

export function refreshWealthTiles(state: GameState): GameState {
  if (!state.wealthTiles) return state;
  return { ...state, wealthTiles: recalcWealthTiles(state) };
}

// Rivers of Catan: the hexes of the river tiles.
export function riverTileHexes(state: GameState): Set<HexId> {
  const out = new Set<HexId>();
  for (const river of state.rivers ?? []) for (const h of river.hexes) out.add(h);
  return out;
}

// "An intersection of a river tile": a corner of any river-tile hex.
export function vertexIsOnRiverTile(state: GameState, vertexId: VertexId): boolean {
  if (!state.rivers) return false;
  const tiles = riverTileHexes(state);
  return (state.board.vertices[vertexId]?.hexes ?? []).some((h) => tiles.has(h));
}

// "An edge of a river tile": any of the six edges of a river-tile hex
// (bridge sites included, though roads can't go there).
export function edgeIsOnRiverTile(state: GameState, edgeId: EdgeId): boolean {
  if (!state.rivers) return false;
  const tiles = riverTileHexes(state);
  return (state.board.edges[edgeId]?.hexes ?? []).some((h) => tiles.has(h));
}
