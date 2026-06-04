import type { Action, GameState, PlayerId, Resource, WonderState } from '@/game/types';
import { canAfford } from '@/game/resources';
import { getWonder, WONDERS } from '@/game/modules/seafarers/wonders/catalogue';

// Build (or progress) the most attractive wonder this AI can advance. Returns
// `null` when no wonder is reachable right now. Wonders are a Seafarers-
// scenario-specific scoring track: each built level is +1 VP, and completing
// a wonder is an instant win regardless of VP. The heuristic prefers:
//   1. Completing a wonder we already started (next level = instant win).
//   2. Continuing a wonder we already committed to (level ≥ 1).
//   3. Starting a wonder whose prereq we already meet, where cost overlaps
//      with our current hand.
//
// `instantWinOnly` runs only step (1) — used by main.ts to splice an
// instant-win check in early, before the normal-priority pass.
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

  let bestId: WonderState['id'] | null = null;
  let bestScore = -Infinity;

  for (const w of state.wonders) {
    if (w.builtBy !== null && w.builtBy !== playerId) continue;
    const def = getWonder(w.id);
    if (w.level >= def.maxLevel) continue;
    if (!def.prereqMet(state, playerId)) continue;
    if (!canAfford(player.resources, def.costPerLevel)) continue;

    const isInstantWin = w.level + 1 >= def.maxLevel;
    if (opts.instantWinOnly && !isInstantWin) continue;

    // Score components:
    //   - +1000 if next build wins immediately (always pick over anything)
    //   - +10 per level already built (commitment / sunk-cost)
    //   - +2 per remaining level we can already afford from current hand
    //     (smooths the choice between two unclaimed wonders by hand fit)
    //   - +1 if this wonder's prereq is unique to us (no opponent meets it,
    //     so they can't race; small tiebreaker)
    let score = 0;
    if (isInstantWin) score += 1000;
    score += w.level * 10;
    score += affordableLevels(player.resources, def.costPerLevel) * 2;
    const competitors = countOtherPrereqHolders(state, w.id, playerId);
    if (competitors === 0) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestId = w.id;
    }
  }

  if (!bestId) return null;
  return { type: 'buildWonder', playerId, wonderId: bestId };
}

// How many copies of `cost` could `resources` pay back-to-back? Used as a
// proxy for "how committed can I be to this wonder right now". A hand that
// covers 2-3 levels in one go is strictly better than one that covers 1.
function affordableLevels(
  resources: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): number {
  let min = Infinity;
  for (const [res, n] of Object.entries(cost) as [Resource, number][]) {
    if (n <= 0) continue;
    min = Math.min(min, Math.floor(resources[res] / n));
  }
  return min === Infinity ? 0 : min;
}

function countOtherPrereqHolders(
  state: GameState,
  wonderId: WonderState['id'],
  playerId: PlayerId,
): number {
  const def = WONDERS.find((d) => d.id === wonderId);
  if (!def) return 0;
  let count = 0;
  for (const p of state.players) {
    if (p.id === playerId) continue;
    if (def.prereqMet(state, p.id)) count++;
  }
  return count;
}
