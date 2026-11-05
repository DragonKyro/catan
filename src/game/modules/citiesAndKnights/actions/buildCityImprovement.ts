import type {
  BuildCityImprovementAction,
  GameState,
  ImprovementTrack,
  MetropolisRecord,
  PlayerId,
  VertexId,
} from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { addCommodities, subtractCommodities } from '../../../commodities';
import { improvementCost, vertexHasMetropolis } from '../improvements/state';
import { MAX_IMPROVEMENT_LEVEL, MIN_METROPOLIS_LEVEL } from '../constants';

const NO_METROPOLISES: Record<ImprovementTrack, MetropolisRecord | null> = {
  science: null,
  trade: null,
  politics: null,
};

// What reaching `level` on `track` does to that track's metropolis (p.8):
//   - 'claim': you're the first to level 4 (nobody holds it) or the first to
//     level 5 (it isn't permanent yet and isn't yours) → it goes on one of
//     your cities; level 5 makes it permanent.
//   - 'lock':  you already hold it and reach level 5 → permanent.
//   - 'none':  below level 4, or someone got there first.
export function metropolisEffect(
  state: GameState,
  playerId: PlayerId,
  track: ImprovementTrack,
  level: number,
): 'claim' | 'lock' | 'none' {
  if (level < MIN_METROPOLIS_LEVEL) return 'none';
  const holder = state.metropolises?.[track] ?? null;
  if (holder?.playerId === playerId) return level === MAX_IMPROVEMENT_LEVEL ? 'lock' : 'none';
  if (!holder) return 'claim';
  if (level === MAX_IMPROVEMENT_LEVEL && !holder.permanent) return 'claim';
  return 'none';
}

// Your cities that could take a new metropolis (one per city).
export function metropolisSites(state: GameState, playerId: PlayerId): VertexId[] {
  const p = state.players.find((pl) => pl.id === playerId);
  return (p?.cities ?? []).filter((v) => !vertexHasMetropolis(state, v));
}

// Why `playerId` can't build the next improvement on `track` right now, or
// null when they can (phase / turn aside). Shared with the UI and AI.
export function improvementBlocker(
  state: GameState,
  playerId: PlayerId,
  track: ImprovementTrack,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 'Unknown player';
  if (player.cities.length === 0) return 'You need a city on the board to build improvements';
  const level = player.improvements?.[track] ?? 0;
  if (level >= MAX_IMPROVEMENT_LEVEL) return 'This track is complete';
  const target = level + 1;
  if (
    metropolisEffect(state, playerId, track, target) === 'claim' &&
    metropolisSites(state, playerId).length === 0
  ) {
    return 'This level wins the metropolis, and none of your cities is free to take it';
  }
  const cost = improvementCost(track, target, !!state.craneActive);
  if ((player.commodities?.[cost.commodity] ?? 0) < cost.amount) {
    return `Needs ${cost.amount} ${cost.commodity}`;
  }
  return null;
}

// Build the next city improvement (p.8): needs at least one city; costs as
// many of the track's commodity as the level reached (Crane: 1 fewer); no
// skipping levels. Level 3 unlocks the track's ability. The first player to
// level 4 takes the track's metropolis (temporary); the first to level 5
// takes it for good. Taking it needs a city without a metropolis — without
// one you may not buy that level. With 2+ free cities the player picks
// (placeMetropolis phase).
export function handleBuildCityImprovement(
  state: GameState,
  action: BuildCityImprovementAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot build city improvement in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const blocker = improvementBlocker(state, action.playerId, action.track);
  if (blocker) throw new Error(blocker);

  const player = getPlayer(state, action.playerId);
  const target = (player.improvements?.[action.track] ?? 0) + 1;
  const cost = improvementCost(action.track, target, !!state.craneActive);
  const spend = { [cost.commodity]: cost.amount };
  const effect = metropolisEffect(state, action.playerId, action.track, target);

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    commodities: subtractCommodities(p.commodities ?? { paper: 0, cloth: 0, coin: 0 }, spend),
    improvements: {
      ...(p.improvements ?? { science: 0, trade: 0, politics: 0 }),
      [action.track]: target,
    },
  }));
  next = {
    ...next,
    commodityBank: addCommodities(next.commodityBank ?? { paper: 0, cloth: 0, coin: 0 }, spend),
    craneActive: false,
  };

  const metros = next.metropolises ?? NO_METROPOLISES;
  if (effect === 'lock') {
    return {
      ...next,
      metropolises: { ...metros, [action.track]: { ...metros[action.track]!, permanent: true } },
    };
  }
  if (effect === 'claim') {
    const sites = metropolisSites(next, action.playerId);
    if (sites.length === 1) {
      return {
        ...next,
        metropolises: {
          ...metros,
          [action.track]: {
            playerId: action.playerId,
            vertex: sites[0]!,
            permanent: target === MAX_IMPROVEMENT_LEVEL,
          },
        },
      };
    }
    return { ...next, phase: 'placeMetropolis', pendingMetropolis: { track: action.track } };
  }
  return next;
}
