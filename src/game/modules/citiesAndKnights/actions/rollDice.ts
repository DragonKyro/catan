import type { EventDieFace, GameState, RollDiceAction } from '../../../types';
import { EVENT_DIE_FACES } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { rngInt } from '../../../rng';
import { advanceBarbarianShip, resolveBarbarianAttack } from '../barbarian';
import { drawProgressCardsForEvent } from '../progress/draw';
import { resumeFlow } from '../flow';

// Re-exported for older imports (tests, UI).
export { distributeWithCommodities } from '../production';

// Cities & Knights `rollDice` (p.6-7). Roll Dice phase:
//   1. (Alchemy may have fixed the production dice before this roll.)
//   2. Roll the two production dice (red = dice[0]) and the event die. The
//      event die comes from the seeded RNG so every peer reduces the same
//      face.
//   3. Resolve the event die first: a ship moves the barbarians one space
//      (attacking on the last one); a city-improvement icon makes every
//      player whose cube on that track covers the red die draw a progress
//      card, in turn order from the active player.
// Production phase:
//   4. Collect resources + commodities, or Resolve a 7.
// Interactive leftovers (tie draws, pillage choices, progress discards,
// 7 discards, the robber, Aqueduct picks) are walked by `resumeFlow`. While
// an attack still waits on choices the production total is held back so a
// pillaged city produces as the settlement it now is.
export function handleRollDiceCK(state: GameState, action: RollDiceAction): GameState {
  if (state.phase !== 'rollOrPlayKnight') {
    throw new Error(`Cannot roll dice in phase ${state.phase}`);
  }
  if (state.hasRolledThisTurn) throw new Error('Already rolled this turn');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');

  // Alchemy: the production dice were set before the roll.
  const [d1, d2] = state.pendingAlchemy ?? action.dice;
  if (![d1, d2].every((d) => Number.isInteger(d) && d >= 1 && d <= 6)) {
    throw new Error('Invalid dice values');
  }
  const total = d1 + d2;

  const [eventIdx, rngAfterEvent] = rngInt(state.rngState, EVENT_DIE_FACES.length);
  const eventDie: EventDieFace = EVENT_DIE_FACES[eventIdx]!;

  let next: GameState = {
    ...state,
    rngState: rngAfterEvent,
    hasRolledThisTurn: true,
    lastRoll: { dice: [d1, d2], total, player: action.playerId },
    lastEventDie: eventDie,
    pendingAlchemy: undefined,
  };

  if (eventDie === 'barbarian') {
    const advanced = advanceBarbarianShip(next);
    next = advanced.state;
    if (advanced.attacked) next = resolveBarbarianAttack(next);
  } else {
    next = drawProgressCardsForEvent(next, eventDie, d1);
  }

  return resumeFlow({ ...next, pendingProduction: total });
}
