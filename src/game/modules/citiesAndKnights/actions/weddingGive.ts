import type { GameState, WeddingGiveAction } from '../../../types';
import { ckHandSize } from '../production';
import { holdsSelection, selectionSize, transferCards } from '../cards';
import { resumeFlow } from '../flow';

// Wedding follow-up (p.16): each player with more VPs than the card's player
// gives them 2 resource and/or commodity cards of their own choice (all
// they have if fewer than 2). Answered one giver at a time.
export function handleWeddingGive(state: GameState, action: WeddingGiveAction): GameState {
  if (state.phase !== 'weddingGive') {
    throw new Error(`Cannot give in phase ${state.phase}`);
  }
  const ctx = state.pendingWedding;
  if (!ctx) throw new Error('No pending wedding');
  if (ctx.remaining[0] !== action.playerId) throw new Error('Not your turn to give');
  const owed = Math.min(2, ckHandSize(state, action.playerId));
  if (selectionSize(action.resources, action.commodities) !== owed) {
    throw new Error(`Must give exactly ${owed} cards`);
  }
  if (!holdsSelection(state, action.playerId, action.resources, action.commodities)) {
    throw new Error("You don't hold those cards");
  }
  const next = transferCards(state, action.playerId, ctx.collector, action.resources, action.commodities);
  const remaining = ctx.remaining.slice(1);
  if (remaining.length > 0) return { ...next, pendingWedding: { ...ctx, remaining } };
  return resumeFlow({ ...next, pendingWedding: undefined });
}
