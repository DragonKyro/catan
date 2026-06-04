import type { FishTokenType, GameState } from '../../../types';
import { rngInt, shuffle } from '../../../rng';

// Initial fish-token pool per the rulebook component list:
//   11 × "one fish", 10 × "two fish", 8 × "three fish", 1 × old boot.
// Total 30 tokens. Mixed face-down at game start.
export function buildInitialFishPool(): FishTokenType[] {
  return [
    ...Array<FishTokenType>(11).fill('one'),
    ...Array<FishTokenType>(10).fill('two'),
    ...Array<FishTokenType>(8).fill('three'),
    'oldBoot',
  ];
}

export interface FishDrawResult {
  // The drawn token, or null when the pool + discard are both empty.
  token: FishTokenType | null;
  state: GameState;
}

// Draw a single fish token from the pool, reshuffling the discard pile into
// a fresh pool when needed. Pure: returns a new state with `fishTokenPool`,
// `fishTokenDiscard`, and `rngState` advanced. The caller is responsible
// for assigning the token (to a player or to the boot holder slot).
export function drawFish(state: GameState): FishDrawResult {
  let pool = state.fishTokenPool ?? [];
  let discard = state.fishTokenDiscard ?? [];
  let rng = state.rngState;
  if (pool.length === 0 && discard.length > 0) {
    [pool, rng] = shuffle(rng, discard);
    discard = [];
  }
  if (pool.length === 0) {
    return {
      token: null,
      state: {
        ...state,
        fishTokenPool: pool,
        fishTokenDiscard: discard,
        rngState: rng,
      },
    };
  }
  const [idx, nextRng] = rngInt(rng, pool.length);
  const token = pool[idx]!;
  const newPool = [...pool.slice(0, idx), ...pool.slice(idx + 1)];
  return {
    token,
    state: {
      ...state,
      fishTokenPool: newPool,
      fishTokenDiscard: discard,
      rngState: nextRng,
    },
  };
}
