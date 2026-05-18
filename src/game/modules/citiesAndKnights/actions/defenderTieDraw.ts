import type {
  DefenderTieDrawAction,
  GameState,
  ProgressCardKind,
} from '../../../types';
import { updatePlayer } from '../../../helpers';

// Defender-of-Catan tie: the top-strength contributors are tied so no one
// gets the VP token. Instead each tied player draws 1 progress card from
// the deck of their choice. Iterates in turn order.
export function handleDefenderTieDraw(
  state: GameState,
  action: DefenderTieDrawAction,
): GameState {
  if (!state.pendingDefenderTieDraw || state.pendingDefenderTieDraw.length === 0) {
    throw new Error('No pending defender-tie draws');
  }
  const expected = state.pendingDefenderTieDraw[0]!;
  if (action.playerId !== expected) {
    throw new Error(`It's ${expected}'s draw`);
  }
  const deck = state.progressDecks?.[action.deck] ?? [];
  if (deck.length === 0) {
    // Skip — deck empty means no draw possible.
    return advance(state);
  }
  const drawn = deck[0]! as ProgressCardKind;
  const rest = deck.slice(1);
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    progressCards: {
      ...(p.progressCards ?? { science: [], trade: [], politics: [] }),
      [action.deck]: [
        ...(p.progressCards?.[action.deck] ?? []),
        drawn,
      ],
    },
  }));
  next = {
    ...next,
    progressDecks: {
      ...(next.progressDecks ?? { science: [], trade: [], politics: [] }),
      [action.deck]: rest,
    },
  };
  return advance(next);
}

function advance(state: GameState): GameState {
  if (!state.pendingDefenderTieDraw) return state;
  const remaining = state.pendingDefenderTieDraw.slice(1);
  if (remaining.length === 0) {
    // Hand back to the post-attack phase (which is always 'main' under C&K
    // — barbarian resolution runs inside rollDice, so 'main' is correct).
    return {
      ...state,
      pendingDefenderTieDraw: undefined,
    };
  }
  return { ...state, pendingDefenderTieDraw: remaining };
}
