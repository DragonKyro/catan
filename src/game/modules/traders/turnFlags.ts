import type { ActionHandler } from '../types';
import type { ActionType } from '../../types';

// Per-turn T&B counters that reset when the turn passes to another player
// (gold spends: 2 per turn). Wraps every T&B handler instead of the endTurn
// path so it holds whichever action ends the turn (endTurn, or a Merchant
// Trains vote / wagon placement).
export function withTradersTurnFlags(
  handlers: Partial<Record<ActionType, ActionHandler>>,
): Partial<Record<ActionType, ActionHandler>> {
  const out: Partial<Record<ActionType, ActionHandler>> = {};
  for (const [type, handler] of Object.entries(handlers) as Array<[ActionType, ActionHandler]>) {
    out[type] = (state, action) => {
      const next = handler(state, action);
      if (
        next.goldSpendsThisTurn !== undefined &&
        next.currentPlayerIndex !== state.currentPlayerIndex
      ) {
        return { ...next, goldSpendsThisTurn: undefined };
      }
      return next;
    };
  }
  return out;
}
