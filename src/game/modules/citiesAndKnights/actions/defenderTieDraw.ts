import type { DefenderTieDrawAction, GameState } from '../../../types';
import { drawTopCard } from '../progress/draw';
import { requireProgressDiscards } from '../progress/hand';
import { resumeFlow } from '../flow';

// Defenders tied for the top contribution (p.11): nobody takes the VP token;
// instead each tied player, starting with the active player, draws the top
// card of the progress deck of their choice. A non-active player who goes
// over 4 progress cards discards right away.
export function handleDefenderTieDraw(state: GameState, action: DefenderTieDrawAction): GameState {
  if (state.phase !== 'defenderTieDraw') {
    throw new Error(`Cannot draw for a defender tie in phase ${state.phase}`);
  }
  const queue = state.pendingDefenderTieDraw ?? [];
  if (queue.length === 0) throw new Error('No pending defender-tie draws');
  if (action.playerId !== queue[0]) throw new Error(`It's ${queue[0]}'s draw`);
  if (!['science', 'trade', 'politics'].includes(action.deck)) {
    throw new Error('Unknown progress deck');
  }
  const decks = state.progressDecks ?? { science: [], trade: [], politics: [] };
  const anyCards = decks.science.length + decks.trade.length + decks.politics.length > 0;
  if (anyCards && decks[action.deck].length === 0) {
    throw new Error(`The ${action.deck} deck is empty — pick another`);
  }
  let next = drawTopCard(state, action.playerId, action.deck);
  next = requireProgressDiscards(next);
  return resumeFlow({ ...next, pendingDefenderTieDraw: queue.slice(1) });
}
