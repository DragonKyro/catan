import type { GameState, PlayerId, VertexId } from '@/game/types';
import { hexPips, numberPips } from '@/game/board/hexNumbers';
import { vertexIsOnRiverTile } from '@/game/modules/traders/coins/gold';
import { lakeHexes } from '@/game/modules/traders/fishing/lakes';
import { goldValue } from './gold';

// Traders & Barbarians terms in the AI's vertex score.
//
// Rivers of Catan: a settlement on a corner of a river tile pays 1 gold.
// Gold is worth more than its exchange value while it decides the
// Wealthiest (+1 VP) / Poor (-2 VP) tiles, so `goldValue` prices one more
// coin for this player right now.
//
// Fishing on Catan: the lake (2 / 3 / 11 / 12 = 6 pips) and each fishing
// ground pay a fish token per settlement when they roll. A token averages
// ~1.9 fish and 4 fish buy a resource of choice, so a token is worth about
// half a resource card: score fish pips at 0.5 (a resource pip is ~1.1).
const FISH_PIP_WEIGHT = 0.5;

export function tradersVertexBonus(
  state: GameState,
  vertexId: VertexId,
  playerId: PlayerId,
): number {
  let bonus = 0;
  if (state.rivers && vertexIsOnRiverTile(state, vertexId)) {
    bonus += goldValue(state, playerId, 1);
  }
  const vertex = state.board.vertices[vertexId];
  for (const lakeId of lakeHexes(state)) {
    if (!vertex?.hexes.includes(lakeId)) continue;
    const lake = state.board.hexes[lakeId];
    if (lake) bonus += hexPips(lake) * FISH_PIP_WEIGHT;
  }
  for (const fg of state.fishingGrounds ?? []) {
    if (fg.vertices.includes(vertexId)) bonus += numberPips(fg.token) * FISH_PIP_WEIGHT;
  }
  // Traders & Barbarians scenario: the second starting placement (a city)
  // is where the wagon starts — a corner on or next to an interior path
  // reaches a plaza on the first turn.
  if (state.tradersBarbarians && state.phase === 'setupRound2') {
    const plazas = new Set(state.tradersBarbarians.locations.map((l) => l.plaza));
    const near = vertex?.neighborVertices ?? [];
    if (near.some((n) => plazas.has(n))) bonus += 1.2;
    else if (near.some((n) => state.board.vertices[n]?.neighborVertices.some((m) => plazas.has(m)))) {
      bonus += 0.5;
    }
  }
  return bonus;
}
