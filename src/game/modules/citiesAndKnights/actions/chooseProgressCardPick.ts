import type { ChooseProgressCardPickAction, GameState } from '../../../types';
import { receiveProgressCard, takeProgressCardFromHand } from '../progress/hand';
import { ckHandSize } from '../production';
import { holdsSelection, selectionSize, transferCards } from '../cards';
import { resumeFlow } from '../flow';

// Resolver for the two "look at a hand and take" cards:
//   - Espionage (p.15): look at another player's progress cards and MAY take
//     one (VP cards are face up, never in the hand). Omit `card` to take
//     nothing.
//   - Guild Dues (p.14): take any 2 resource / commodity cards from the
//     target's hand (all of them if they hold fewer).
export function handleChooseProgressCardPick(
  state: GameState,
  action: ChooseProgressCardPickAction,
): GameState {
  if (state.phase !== 'chooseProgressCardPick') {
    throw new Error(`Cannot pick in phase ${state.phase}`);
  }
  const ctx = state.progressPickState;
  if (!ctx) throw new Error('No pending pick state');
  if (action.playerId !== ctx.picker) throw new Error('Not your pick');

  if (ctx.kind === 'espionage') {
    let next = state;
    if (action.card) {
      if (!action.deck) throw new Error('Espionage pick needs the deck of the card');
      const target = state.players.find((p) => p.id === ctx.targetId);
      if (!target?.progressCards?.[action.deck].includes(action.card)) {
        throw new Error(`Target has no ${action.card} in ${action.deck}`);
      }
      next = takeProgressCardFromHand(next, ctx.targetId, action.deck, action.card);
      next = receiveProgressCard(next, ctx.picker, action.deck, action.card);
    }
    return resumeFlow({ ...next, progressPickState: undefined });
  }

  if (ctx.kind === 'guildDues') {
    const owed = Math.min(ctx.remaining, ckHandSize(state, ctx.targetId));
    if (selectionSize(action.resources, action.commodities) !== owed) {
      throw new Error(`Take exactly ${owed} cards`);
    }
    if (!holdsSelection(state, ctx.targetId, action.resources, action.commodities)) {
      throw new Error("The target doesn't hold those cards");
    }
    const next = transferCards(state, ctx.targetId, ctx.picker, action.resources, action.commodities);
    return resumeFlow({ ...next, progressPickState: undefined });
  }
  throw new Error(`Unknown pick kind: ${(ctx as { kind: string }).kind}`);
}
