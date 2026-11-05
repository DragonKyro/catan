import type { GameState, PlayerId } from '../../types';
import { runProduction } from './production';
import { endTurnCK } from './actions/endTurn';

// Cities & Knights turn flow. A roll (and some progress cards) resolve
// everything automatic at once and leave a set of "pending" fields behind;
// each interactive step is its own phase, answered by one player at a time.
// Every C&K sub-phase handler finishes by calling `resumeFlow`, which picks
// the next pending step in rulebook order:
//
//   1. defenderTieDraw     barbarians driven off, tied top defenders draw
//   2. choosePillage       barbarians won, losers pick the city to reduce
//   3. (production)        the held-back dice total now produces — after the
//                          attack, so a pillaged city yields as a settlement
//   4. progressCardDiscard non-active players over 4 progress cards
//   5. discard             a 7: hands over 7 + 2 per city wall
//   6. moveRobber          a 7 / chased robber / Taxation, once it's active
//   7. aqueductPick        science level 3 players who got nothing
//   8. the active player's own end-of-turn progress discard → end the turn
//
// Anything else returns to the Action phase (or to the Roll Dice phase if
// the dice haven't been rolled yet).
export function resumeFlow(state: GameState): GameState {
  let s = state;
  if (nonEmpty(s.pendingDefenderTieDraw)) return { ...s, phase: 'defenderTieDraw' };
  if (nonEmpty(s.pendingPillage)) return { ...s, phase: 'choosePillage' };
  if (s.pendingProduction !== undefined) {
    const total = s.pendingProduction;
    s = runProduction({ ...s, pendingProduction: undefined }, total);
  }
  if (anyRequired(s.progressCardDiscardRequired)) {
    return { ...s, phase: 'progressCardDiscard' };
  }
  if (s.discardState && anyRequired(s.discardState.required)) {
    return { ...s, phase: 'discard' };
  }
  if (s.pendingRobberMove) return { ...s, phase: 'moveRobber' };
  s = dropAqueductPicksWithEmptyBank(s);
  if (nonEmpty(s.pendingAqueduct)) return { ...s, phase: 'aqueductPick' };
  if (s.endTurnAfterProgressDiscard) {
    return endTurnCK({ ...s, endTurnAfterProgressDiscard: undefined, phase: 'main' });
  }
  return {
    ...s,
    phase: s.hasRolledThisTurn ? 'main' : 'rollOrPlayKnight',
    discardState: undefined,
    progressCardDiscardRequired: undefined,
    pendingAqueduct: undefined,
    pendingDefenderTieDraw: undefined,
    pendingPillage: undefined,
  };
}

function nonEmpty(list: PlayerId[] | undefined): boolean {
  return !!list && list.length > 0;
}

function anyRequired(req: Record<PlayerId, number> | undefined): boolean {
  if (!req) return false;
  return Object.values(req).some((n) => n > 0);
}

// Aqueduct takes a resource from the supply; with the supply empty there is
// nothing to take, so the pick is skipped rather than left unanswerable.
function dropAqueductPicksWithEmptyBank(state: GameState): GameState {
  if (!nonEmpty(state.pendingAqueduct)) return state;
  const anyLeft = Object.values(state.bank).some((n) => n > 0);
  return anyLeft ? state : { ...state, pendingAqueduct: undefined };
}
