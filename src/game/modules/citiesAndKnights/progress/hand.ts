import type {
  GameState,
  ImprovementTrack,
  Player,
  PlayerId,
  ProgressCardHand,
  ProgressCardKind,
} from '../../../types';
import { updatePlayer } from '../../../helpers';
import { VP_PROGRESS_CARDS } from './catalogue';
import { PROGRESS_CARD_HAND_LIMIT } from '../constants';

export const EMPTY_PROGRESS_HAND: ProgressCardHand = { science: [], trade: [], politics: [] };

// Cards in a player's (secret) progress hand. VP cards never sit there.
export function progressHandSize(player: Pick<Player, 'progressCards'>): number {
  const h = player.progressCards ?? EMPTY_PROGRESS_HAND;
  return h.science.length + h.trade.length + h.politics.length;
}

// A player takes a progress card into their area: Victory Point cards are
// placed face up at once (p.6, p.10), everything else goes into the hand.
export function receiveProgressCard(
  state: GameState,
  playerId: PlayerId,
  track: ImprovementTrack,
  card: ProgressCardKind,
): GameState {
  return updatePlayer(state, playerId, (p) => {
    if (VP_PROGRESS_CARDS.has(card)) {
      return { ...p, progressVpCards: [...(p.progressVpCards ?? []), card] };
    }
    const hand = p.progressCards ?? EMPTY_PROGRESS_HAND;
    return { ...p, progressCards: { ...hand, [track]: [...hand[track], card] } };
  });
}

// Remove one copy of `card` from a player's hand (no-op if absent).
export function takeProgressCardFromHand(
  state: GameState,
  playerId: PlayerId,
  track: ImprovementTrack,
  card: ProgressCardKind,
): GameState {
  return updatePlayer(state, playerId, (p) => {
    const hand = p.progressCards ?? EMPTY_PROGRESS_HAND;
    const list = hand[track].slice();
    const idx = list.indexOf(card);
    if (idx >= 0) list.splice(idx, 1);
    return { ...p, progressCards: { ...hand, [track]: list } };
  });
}

// Put a played / discarded card face down under its deck (p.10).
export function returnToDeckBottom(
  state: GameState,
  track: ImprovementTrack,
  card: ProgressCardKind,
): GameState {
  const decks = state.progressDecks ?? { science: [], trade: [], politics: [] };
  return { ...state, progressDecks: { ...decks, [track]: [...decks[track], card] } };
}

// Hand limit (p.6, p.10): a player who is NOT the active player and holds
// more than 4 progress cards discards down to 4 at once. The active player
// has until the end of their Action phase (checked by endTurn). Merges into
// `progressCardDiscardRequired`; resumeFlow turns it into the phase.
export function requireProgressDiscards(state: GameState): GameState {
  const currentId = state.playerOrder[state.currentPlayerIndex];
  const required: Record<PlayerId, number> = { ...(state.progressCardDiscardRequired ?? {}) };
  for (const p of state.players) {
    if (p.id === currentId && !state.endTurnAfterProgressDiscard) continue;
    const over = progressHandSize(p) - PROGRESS_CARD_HAND_LIMIT;
    if (over > 0) required[p.id] = over;
    else delete required[p.id];
  }
  return {
    ...state,
    progressCardDiscardRequired: Object.keys(required).length > 0 ? required : undefined,
  };
}
