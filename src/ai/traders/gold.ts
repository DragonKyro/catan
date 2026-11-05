import type { GameState, PlayerId } from '@/game/types';
import { recalcWealthTiles } from '@/game/modules/traders/scoring/wealthTiles';
import { POOR_CATANIAN_VP, WEALTHIEST_CATANIAN_VP } from '@/game/modules/traders/constants';

// Pricing gold for the heuristic AI (Rivers of Catan). Kept free of
// src/ai/value.ts so vertexScore can use it without an import cycle.

// VP change for `playerId` from the wealth tiles if their gold moved by
// `delta` (0 outside Rivers).
export function wealthVpSwing(state: GameState, playerId: PlayerId, delta: number): number {
  if (!state.wealthTiles) return 0;
  const before = wealthVp(state.wealthTiles, playerId);
  const players = state.players.map((p) =>
    p.id === playerId ? { id: p.id, gold: Math.max(0, (p.gold ?? 0) + delta) } : { id: p.id, gold: p.gold ?? 0 },
  );
  const after = wealthVp(recalcWealthTiles({ players }), playerId);
  return after - before;
}

function wealthVp(tiles: { wealthiest: PlayerId | null; poor: PlayerId[] }, pid: PlayerId): number {
  let vp = 0;
  if (tiles.wealthiest === pid) vp += WEALTHIEST_CATANIAN_VP;
  if (tiles.poor.includes(pid)) vp += POOR_CATANIAN_VP;
  return vp;
}

// Value of `delta` more gold for this player in vertex-score units: half a
// card per coin (2 gold buy a card), plus the wealth-tile swing. Tile swings
// are discounted because the race moves every turn.
export function goldValue(state: GameState, playerId: PlayerId, delta: number): number {
  return 0.6 * delta + 1.2 * wealthVpSwing(state, playerId, delta);
}

