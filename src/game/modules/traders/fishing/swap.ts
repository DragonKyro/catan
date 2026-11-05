import type { GameState, SwapFishAction } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { drawFish } from './pool';
import { takeToken } from './production';

// 'fishSwap' phase (Fishing on Catan): "Once per turn, if you have 7 fish
// tokens and would receive more, you may discard 1 fish token and replace it
// from the supply. Then stop drawing tokens." The head of the queue answers
// with the token to discard, or null to keep their hand.
export function handleSwapFish(state: GameState, action: SwapFishAction): GameState {
  if (state.phase !== 'fishSwap' || !state.fishSwap) {
    throw new Error(`Cannot swap fish in phase ${state.phase}`);
  }
  const [head, ...rest] = state.fishSwap.queue;
  if (action.playerId !== head) throw new Error('Not your fish swap');
  let next: GameState = state;
  // Nothing left to draw at all: the swap would just hand the token back.
  const supplyLeft =
    (state.fishTokenPool?.length ?? 0) + (state.fishTokenDiscard?.length ?? 0) > 0;
  if (action.token !== null && supplyLeft) {
    const token = action.token;
    const hand = state.players.find((p) => p.id === head)?.fishTokens ?? [];
    const idx = hand.indexOf(token);
    if (idx === -1) throw new Error(`You don't have a ${token}-fish token`);
    next = updatePlayer(next, head, (p) => ({
      ...p,
      fishTokens: [...hand.slice(0, idx), ...hand.slice(idx + 1)],
    }));
    // Draw before discarding so the swapped token can't come straight back.
    const draw = drawFish(next);
    next = { ...draw.state, fishTokenDiscard: [...(draw.state.fishTokenDiscard ?? []), token] };
    if (draw.token !== null) next = takeToken(next, head, draw.token);
  }
  if (rest.length > 0) {
    return { ...next, fishSwap: { ...state.fishSwap, queue: rest } };
  }
  return { ...next, phase: state.fishSwap.returnTo, fishSwap: undefined };
}
