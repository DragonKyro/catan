import type {
  BuildCityImprovementAction,
  GameState,
  MetropolisRecord,
} from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addCommodities, subtractCommodities } from '../../../commodities';
import { improvementCost, vertexHasMetropolis } from '../improvements/state';
import {
  MAX_IMPROVEMENT_LEVEL,
  MIN_METROPOLIS_LEVEL,
} from '../constants';

// Build the next level of an improvement track. Pays the matching commodity
// (level N → N commodities, less 1 if the Crane card is active). Requires
// at least one city on the board (rulebook p.8 "you must have at least 1 city
// to make city improvements").
//
// Level 4: gain temporary control of the track's metropolis (placed on one
// of your cities). Level 5: control becomes permanent. If you already hold
// the metropolis at level 4, level 5 just locks it; if another player holds
// it, you take it (placed on one of YOUR cities).
//
// When the player has multiple eligible cities, the transition enters the
// 'placeMetropolis' sub-phase so the player picks the city.
export function handleBuildCityImprovement(
  state: GameState,
  action: BuildCityImprovementAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build city improvement in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const player = getPlayer(state, action.playerId);
  if (player.cities.length === 0) {
    throw new Error('You need a city to build improvements');
  }
  const currentLevel = player.improvements?.[action.track] ?? 0;
  if (currentLevel >= MAX_IMPROVEMENT_LEVEL) {
    throw new Error(`Already at max level on ${action.track}`);
  }
  const target = currentLevel + 1;

  // Level 4/5 metropolis: must have an available city. If the player already
  // owns this track's metropolis we just upgrade level (no new placement).
  // Otherwise the player needs at least one city without a metropolis.
  const trackHolder = state.metropolises?.[action.track] ?? null;
  const ownsThisMetro = trackHolder?.playerId === action.playerId;
  if (target >= MIN_METROPOLIS_LEVEL && !ownsThisMetro) {
    const eligibleCities = player.cities.filter(
      (v) => !vertexHasMetropolis(state, v),
    );
    if (eligibleCities.length === 0) {
      throw new Error('No available city to host the metropolis');
    }
  }

  const cost = improvementCost(action.track, target, !!state.craneActive);
  const playerCommodities = player.commodities ?? {
    paper: 0,
    cloth: 0,
    coin: 0,
  };
  if (playerCommodities[cost.commodity] < cost.amount) {
    throw new Error(`Need ${cost.amount} ${cost.commodity}`);
  }

  // Spend.
  const spend = { [cost.commodity]: cost.amount } as Partial<
    Record<typeof cost.commodity, number>
  >;
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    commodities: subtractCommodities(
      p.commodities ?? { paper: 0, cloth: 0, coin: 0 },
      spend,
    ),
    improvements: {
      ...(p.improvements ?? { science: 0, trade: 0, politics: 0 }),
      [action.track]: target,
    },
  }));
  next = {
    ...next,
    commodityBank: addCommodities(
      next.commodityBank ?? { paper: 0, cloth: 0, coin: 0 },
      spend,
    ),
    craneActive: false,
  };

  // Metropolis transitions.
  if (target >= MIN_METROPOLIS_LEVEL) {
    if (ownsThisMetro) {
      // Already own; just bump permanent flag on level 5.
      if (target === MAX_IMPROVEMENT_LEVEL) {
        next = {
          ...next,
          metropolises: {
            ...(next.metropolises ?? {
              science: null,
              trade: null,
              politics: null,
            }),
            [action.track]: { ...trackHolder!, permanent: true },
          },
        };
      }
    } else {
      const eligibleCities = player.cities.filter(
        (v) => !vertexHasMetropolis(next, v),
      );
      const permanent = target === MAX_IMPROVEMENT_LEVEL;
      if (eligibleCities.length === 1) {
        const newRecord: MetropolisRecord = {
          playerId: action.playerId,
          vertex: eligibleCities[0]!,
          permanent,
        };
        next = {
          ...next,
          metropolises: {
            ...(next.metropolises ?? {
              science: null,
              trade: null,
              politics: null,
            }),
            [action.track]: newRecord,
          },
        };
      } else {
        // Multi-city: prompt for placement. Phase enters 'placeMetropolis';
        // the player must dispatch placeMetropolis next.
        return {
          ...next,
          phase: 'placeMetropolis',
          pendingMetropolis: { track: action.track },
        };
      }
    }
  }
  return next;
}
