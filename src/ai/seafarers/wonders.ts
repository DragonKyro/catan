import type { Action, GameState, PlayerId, Resource, WonderId } from '@/game/types';
import { canAfford } from '@/game/resources';
import { calculateVictoryPoints } from '@/game/scoring/points';
import {
  claimedWonderOf,
  getWonder,
  WONDER_LEVELS,
} from '@/game/modules/seafarers/wonders/catalogue';
import { pipsByResource } from '../value';

// Wonders of Catan AI. Claim a wonder as soon as we meet a requirement (the
// claim is free and locks rivals out), preferring the one our production
// pays for best; then build levels whenever we can afford them. A level
// that wins on the spot — the fourth, or one that gives us the strict lead
// while we hold the VP target — runs in the early "instant win" pass.
export interface BuildWonderOptions {
  instantWinOnly?: boolean;
}

export function tryBuildWonder(
  state: GameState,
  playerId: PlayerId,
  opts: BuildWonderOptions = {},
): Action | null {
  if (!state.wonders || state.wonders.length === 0) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const mine = claimedWonderOf(state, playerId);
  if (mine) {
    if (mine.level >= WONDER_LEVELS) return null;
    const def = getWonder(mine.id);
    if (!canAfford(player.resources, def.costPerLevel)) return null;
    if (opts.instantWinOnly && !levelWins(state, playerId, mine.level + 1)) return null;
    return { type: 'buildWonder', playerId, wonderId: mine.id };
  }
  if (opts.instantWinOnly) return null;

  // Claim the best wonder we qualify for.
  const pips = pipsByResource(state, playerId);
  let best: WonderId | null = null;
  let bestScore = -Infinity;
  for (const w of state.wonders) {
    if (w.claimedBy !== null) continue;
    const def = getWonder(w.id);
    if (!def.requirementMet(state, playerId)) continue;
    let score = 0;
    for (const [res, n] of Object.entries(def.costPerLevel) as [Resource, number][]) {
      score += Math.min(pips[res], 8) * n;
    }
    if (score > bestScore) {
      bestScore = score;
      best = w.id;
    }
  }
  return best ? { type: 'claimWonder', playerId, wonderId: best } : null;
}

// Would reaching `level` win right now?
function levelWins(state: GameState, playerId: PlayerId, level: number): boolean {
  if (level >= WONDER_LEVELS) return true;
  if (calculateVictoryPoints(state, playerId, true) < state.settings.victoryPointsToWin) {
    return false;
  }
  return (state.wonders ?? []).every(
    (w) => w.claimedBy === null || w.claimedBy === playerId || w.level < level,
  );
}
