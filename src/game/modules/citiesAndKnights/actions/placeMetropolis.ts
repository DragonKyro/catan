import type { GameState, PlaceMetropolisAction } from '../../../types';
import { currentPlayerId, getPlayer } from '../../../helpers';
import { MAX_IMPROVEMENT_LEVEL } from '../constants';
import { metropolisSites } from './buildCityImprovement';
import { resumeFlow } from '../flow';

// Put a just-won metropolis on one of your cities without one (p.8). Only
// in the `placeMetropolis` phase, entered when 2+ cities could take it.
export function handlePlaceMetropolis(state: GameState, action: PlaceMetropolisAction): GameState {
  if (state.phase !== 'placeMetropolis') {
    throw new Error(`Cannot place metropolis in phase ${state.phase}`);
  }
  if (!state.pendingMetropolis) throw new Error('No pending metropolis');
  if (state.pendingMetropolis.track !== action.track) {
    throw new Error(`Wrong track — expected ${state.pendingMetropolis.track}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!metropolisSites(state, action.playerId).includes(action.vertex)) {
    throw new Error('Pick one of your cities without a metropolis');
  }
  const level = getPlayer(state, action.playerId).improvements?.[action.track] ?? 0;
  return resumeFlow({
    ...state,
    pendingMetropolis: undefined,
    metropolises: {
      ...(state.metropolises ?? { science: null, trade: null, politics: null }),
      [action.track]: {
        playerId: action.playerId,
        vertex: action.vertex,
        permanent: level === MAX_IMPROVEMENT_LEVEL,
      },
    },
  });
}
