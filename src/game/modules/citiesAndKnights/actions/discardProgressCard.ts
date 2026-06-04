import type { DiscardProgressCardAction, GameState, PlayerId } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { VP_PROGRESS_CARDS } from '../progress/catalogue';

// Discard a single progress card during the 4-card-limit cleanup sub-phase.
// Each affected player must dispatch this until their `required` count
// drops to zero. VP cards can't be discarded (they're face-up).
export function handleDiscardProgressCard(
  state: GameState,
  action: DiscardProgressCardAction,
): GameState {
  if (state.phase !== 'progressCardDiscard') {
    throw new Error(`Cannot discard progress card in phase ${state.phase}`);
  }
  const required = state.progressCardDiscardRequired?.[action.playerId];
  if (!required || required <= 0) {
    throw new Error('You do not need to discard progress cards');
  }
  if (VP_PROGRESS_CARDS.has(action.card)) {
    throw new Error('Cannot discard VP cards');
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) throw new Error('Unknown player');
  const hand = (player.progressCards?.[action.deck] ?? []).slice();
  const idx = hand.indexOf(action.card);
  if (idx === -1) throw new Error(`No ${action.card} in your ${action.deck} hand`);
  hand.splice(idx, 1);

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    progressCards: {
      ...(p.progressCards ?? { science: [], trade: [], politics: [] }),
      [action.deck]: hand,
    },
  }));

  const remaining = (state.progressCardDiscardRequired ?? {}) as Record<
    PlayerId,
    number
  >;
  const updated: Record<PlayerId, number> = { ...remaining };
  if (required - 1 <= 0) delete updated[action.playerId];
  else updated[action.playerId] = required - 1;

  // Place the discarded card on the bottom of the deck (rulebook p.10).
  next = {
    ...next,
    progressDecks: {
      ...(next.progressDecks ?? { science: [], trade: [], politics: [] }),
      [action.deck]: [
        ...(next.progressDecks?.[action.deck] ?? []),
        action.card,
      ],
    },
  };

  if (Object.keys(updated).length === 0) {
    return {
      ...next,
      phase: 'main',
      progressCardDiscardRequired: undefined,
    };
  }
  return {
    ...next,
    progressCardDiscardRequired: updated,
  };
}
