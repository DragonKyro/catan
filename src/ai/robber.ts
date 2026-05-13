import type { GameState, PlayerId, HexId } from '@/game/types';
import { probabilityDots } from './value';
import { totalResources } from '@/game/resources';

export interface RobberChoice {
  hex: HexId;
  stealFrom: PlayerId | null;
}

export function chooseRobberMove(state: GameState, playerId: PlayerId): RobberChoice {
  let bestHex: HexId | null = null;
  let bestScore = -Infinity;
  for (const hexId of state.board.hexIds) {
    if (hexId === state.board.robberHex) continue;
    const hex = state.board.hexes[hexId]!;
    if (hex.terrain === 'desert') {
      // Robber on desert produces nothing; only useful if forced
    }
    const pips = probabilityDots(hex.numberToken);
    let score = 0;
    let touchesOwn = false;
    for (const v of Object.values(state.board.vertices)) {
      if (!v.hexes.includes(hexId)) continue;
      for (const p of state.players) {
        if (p.settlements.includes(v.id) || p.cities.includes(v.id)) {
          if (p.id === playerId) {
            touchesOwn = true;
          } else {
            const mult = p.cities.includes(v.id) ? 2 : 1;
            score += mult * pips * (1 + totalResources(p.resources) * 0.1);
          }
        }
      }
    }
    if (touchesOwn) score -= 50; // strongly prefer not to hurt ourselves
    if (score > bestScore) {
      bestScore = score;
      bestHex = hexId;
    }
  }
  if (!bestHex) {
    // Pick the first non-current hex as fallback
    bestHex = state.board.hexIds.find((h) => h !== state.board.robberHex)!;
  }

  // Pick the steal target on that hex with the largest hand
  const candidates: PlayerId[] = [];
  for (const v of Object.values(state.board.vertices)) {
    if (!v.hexes.includes(bestHex)) continue;
    for (const p of state.players) {
      if (p.id === playerId) continue;
      if (totalResources(p.resources) === 0) continue;
      if (p.settlements.includes(v.id) || p.cities.includes(v.id)) {
        if (!candidates.includes(p.id)) candidates.push(p.id);
      }
    }
  }
  if (candidates.length === 0) return { hex: bestHex, stealFrom: null };
  let target = candidates[0]!;
  let bestHand = -1;
  for (const pid of candidates) {
    const p = state.players.find((x) => x.id === pid)!;
    const h = totalResources(p.resources);
    if (h > bestHand) {
      bestHand = h;
      target = pid;
    }
  }
  return { hex: bestHex, stealFrom: target };
}
