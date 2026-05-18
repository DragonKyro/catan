import type {
  EventDieFace,
  GameState,
  ImprovementTrack,
  PlayerId,
  ProgressCardKind,
} from '../../../types';
import { updatePlayer } from '../../../helpers';
import { VP_PROGRESS_CARDS } from './catalogue';
import { PROGRESS_CARD_HAND_LIMIT } from '../constants';

// Iterate players in turn order starting with the current player; each
// whose improvement on the matching track >= the red die value draws the
// top card of the deck. VP cards (Printing / Constitution) auto-flip and
// don't count toward the 4-card hand limit. After the draws, any non-current
// player whose hand limit exceeded 4 enters the progressCardDiscard sub-phase.
export function drawProgressCardsForEvent(
  state: GameState,
  face: EventDieFace,
  redDie: number,
): GameState {
  if (face === 'barbarian') return state;
  const track: ImprovementTrack = face;
  const deck = state.progressDecks?.[track] ?? [];
  if (deck.length === 0) return state;

  let next: GameState = state;
  const remaining = [...deck];
  const startIdx = state.currentPlayerIndex;
  const currentId = state.playerOrder[startIdx]!;

  for (let i = 0; i < state.playerOrder.length; i++) {
    const pid = state.playerOrder[(startIdx + i) % state.playerOrder.length]!;
    const p = next.players.find((pl) => pl.id === pid)!;
    const level = p.improvements?.[track] ?? 0;
    if (level < redDie) continue;
    if (remaining.length === 0) break;
    const drawn = remaining.shift()! as ProgressCardKind;
    next = updatePlayer(next, pid, (pl) => ({
      ...pl,
      progressCards: {
        ...(pl.progressCards ?? { science: [], trade: [], politics: [] }),
        [track]: [
          ...(pl.progressCards?.[track] ?? []),
          drawn,
        ],
      },
    }));
  }
  next = {
    ...next,
    progressDecks: {
      ...(next.progressDecks ?? { science: [], trade: [], politics: [] }),
      [track]: remaining,
    },
  };

  // Hand limit enforcement (rulebook p.10): non-current players over the
  // limit discard immediately to 4. Current player has until endTurn.
  const required: Record<PlayerId, number> = {};
  for (const p of next.players) {
    if (p.id === currentId) continue;
    const handSize = nonVpProgressCount(p.progressCards);
    if (handSize > PROGRESS_CARD_HAND_LIMIT) {
      required[p.id] = handSize - PROGRESS_CARD_HAND_LIMIT;
    }
  }
  if (Object.keys(required).length > 0) {
    return {
      ...next,
      phase: 'progressCardDiscard',
      progressCardDiscardRequired: required,
    };
  }
  return next;
}

// Count of non-VP progress cards in a hand (4-card limit applies only to
// these — VP cards are face-up and don't count).
function nonVpProgressCount(
  hand: GameState['players'][number]['progressCards'],
): number {
  if (!hand) return 0;
  let n = 0;
  for (const track of ['science', 'trade', 'politics'] as ImprovementTrack[]) {
    for (const c of hand[track]) {
      if (!VP_PROGRESS_CARDS.has(c)) n++;
    }
  }
  return n;
}

export { nonVpProgressCount };
