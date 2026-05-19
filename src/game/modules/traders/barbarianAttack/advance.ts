import type { GameState, CastleState } from '../../../types';

// Move every barbarian one hex closer to its castle. Clamps at the
// castle hex (last index of the path). Combat resolution happens
// separately — see `resolveCombat`. Returns a new state with the
// advanced positions; mutates nothing.
export function advanceBarbarians(state: GameState): GameState {
  if (!state.castles?.length) return state;
  const nextCastles: CastleState[] = state.castles.map((c) => {
    const max = c.barbarianPath.length - 1;
    if (c.barbarianPosition >= max) return c;
    return { ...c, barbarianPosition: c.barbarianPosition + 1 };
  });
  return { ...state, castles: nextCastles };
}
