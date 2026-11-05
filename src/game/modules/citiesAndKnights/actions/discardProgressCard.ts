import type { DiscardProgressCardAction, GameState, PlayerId } from '../../../types';
import { returnToDeckBottom, takeProgressCardFromHand } from '../progress/hand';
import { resumeFlow } from '../flow';

// Discard one progress card while over the 4-card hand limit (p.10). Each
// player listed in `progressCardDiscardRequired` sends one of these per card
// owed, in any order. The card goes face down under its deck.
export function handleDiscardProgressCard(
  state: GameState,
  action: DiscardProgressCardAction,
): GameState {
  if (state.phase !== 'progressCardDiscard') {
    throw new Error(`Cannot discard progress card in phase ${state.phase}`);
  }
  const required = state.progressCardDiscardRequired?.[action.playerId] ?? 0;
  if (required <= 0) throw new Error('You do not need to discard progress cards');
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) throw new Error('Unknown player');
  if (!(player.progressCards?.[action.deck] ?? []).includes(action.card)) {
    throw new Error(`No ${action.card} in your ${action.deck} hand`);
  }

  let next = takeProgressCardFromHand(state, action.playerId, action.deck, action.card);
  next = returnToDeckBottom(next, action.deck, action.card);

  const updated: Record<PlayerId, number> = { ...(state.progressCardDiscardRequired ?? {}) };
  if (required - 1 <= 0) delete updated[action.playerId];
  else updated[action.playerId] = required - 1;
  return resumeFlow({
    ...next,
    progressCardDiscardRequired: Object.keys(updated).length > 0 ? updated : undefined,
  });
}
