import type {
  GameState,
  MetropolisRecord,
  PlaceMetropolisAction,
} from '../../../types';
import { currentPlayerId, getPlayer } from '../../../helpers';
import {
  MAX_IMPROVEMENT_LEVEL,
} from '../constants';
import { vertexHasMetropolis } from '../improvements/state';

// Place a freshly-claimed metropolis on one of your eligible cities. Only
// legal in the 'placeMetropolis' sub-phase entered by buildCityImprovement
// when the player has 2+ cities to choose from.
export function handlePlaceMetropolis(
  state: GameState,
  action: PlaceMetropolisAction,
): GameState {
  if (state.phase !== 'placeMetropolis') {
    throw new Error(`Cannot place metropolis in phase ${state.phase}`);
  }
  if (!state.pendingMetropolis) throw new Error('No pending metropolis');
  if (state.pendingMetropolis.track !== action.track) {
    throw new Error(`Wrong track — expected ${state.pendingMetropolis.track}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');

  const player = getPlayer(state, action.playerId);
  if (!player.cities.includes(action.vertex)) {
    throw new Error('That vertex is not one of your cities');
  }
  if (vertexHasMetropolis(state, action.vertex)) {
    throw new Error('That city already hosts a metropolis');
  }

  // Permanence is determined by the player's track level after the build:
  // if they just reached level 5 the metropolis is permanent.
  const level = player.improvements?.[action.track] ?? 0;
  const permanent = level === MAX_IMPROVEMENT_LEVEL;
  const record: MetropolisRecord = {
    playerId: action.playerId,
    vertex: action.vertex,
    permanent,
  };
  return {
    ...state,
    phase: 'main',
    pendingMetropolis: undefined,
    metropolises: {
      ...(state.metropolises ?? { science: null, trade: null, politics: null }),
      [action.track]: record,
    },
  };
}
