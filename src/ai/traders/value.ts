import type { GameState, PlayerId, VertexId } from '@/game/types';
import { hexPips, numberPips } from '@/game/board/hexNumbers';
import { vertexIsOnRiverTile } from '@/game/modules/traders/coins/gold';
import { goldValue } from './coins';

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
  if (state.lakeHexId && vertex?.hexes.includes(state.lakeHexId)) {
    const lake = state.board.hexes[state.lakeHexId];
    if (lake) bonus += hexPips(lake) * FISH_PIP_WEIGHT;
  }
  for (const fg of state.fishingGrounds ?? []) {
    if (fg.vertices.includes(vertexId)) bonus += numberPips(fg.token) * FISH_PIP_WEIGHT;
  }
  return bonus;
}
