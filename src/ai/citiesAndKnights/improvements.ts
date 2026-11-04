import type { Action, GameState, ImprovementTrack, PlayerId, VertexId } from '@/game/types';
import { COSTS, IMPROVEMENT_TRACKS, TRACK_COMMODITY } from '@/game/types';
import { canAfford } from '@/game/resources';
import { improvementCost, vertexHasMetropolis } from '@/game/modules/citiesAndKnights/improvements/state';
import { MAX_CITY_WALLS, MAX_IMPROVEMENT_LEVEL } from '@/game/modules/citiesAndKnights/constants';
import { vertexScore } from '../value';
import { commoditiesOf, firstLegal, handSizeCK, playerById } from './common';
import { ckReportNeeds, trackPriority } from './value';

// City improvements, metropolises and city walls.

// Tracks in the order we'd like to raise them.
export function rankedTracks(state: GameState, playerId: PlayerId): ImprovementTrack[] {
  const pri = trackPriority(state, playerId);
  return [...IMPROVEMENT_TRACKS].sort((a, b) => pri[b] - pri[a]);
}

// Next level's commodity cost on `track` (Crane included), or null if maxed.
export function nextImprovementCost(
  state: GameState,
  playerId: PlayerId,
  track: ImprovementTrack,
  crane = !!state.craneActive,
): number | null {
  const p = playerById(state, playerId);
  const level = p.improvements?.[track] ?? 0;
  if (level >= MAX_IMPROVEMENT_LEVEL) return null;
  return improvementCost(track, level + 1, crane).amount;
}

// Commodities only buy improvements (and trades), and each track takes its
// own commodity, so raising a level whenever we can afford it never starves
// another plan. Highest-priority affordable track first.
export function tryBuildImprovement(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (p.cities.length === 0) return null;
  const have = commoditiesOf(p);
  const candidates: Action[] = [];
  for (const track of rankedTracks(state, playerId)) {
    const cost = nextImprovementCost(state, playerId, track);
    if (cost === null) continue;
    if (have[TRACK_COMMODITY[track]] < cost) continue;
    candidates.push({ type: 'buildCityImprovement', playerId, track });
  }
  return firstLegal(state, candidates);
}

// Would Crane turn an unaffordable level into an affordable one, or save a
// commodity on an expensive level (3+)?
export function craneTrack(state: GameState, playerId: PlayerId): ImprovementTrack | null {
  if (state.craneActive) return null;
  const p = playerById(state, playerId);
  if (p.cities.length === 0) return null;
  const have = commoditiesOf(p);
  for (const track of rankedTracks(state, playerId)) {
    const full = nextImprovementCost(state, playerId, track, false);
    if (full === null || full < 2) continue;
    const c = have[TRACK_COMMODITY[track]];
    if (c >= full - 1) return track;
  }
  return null;
}

// Metropolis goes on our most productive city without one (it can never be
// pillaged, so protect the best).
export function chooseMetropolisVertex(state: GameState, playerId: PlayerId): Action | null {
  const track = state.pendingMetropolis?.track;
  if (!track) return null;
  const p = playerById(state, playerId);
  const options = p.cities
    .filter((v) => !vertexHasMetropolis(state, v))
    .sort((a, b) => vertexScore(state, b, playerId) - vertexScore(state, a, playerId));
  return firstLegal(
    state,
    options.map((vertex) => ({ type: 'placeMetropolis' as const, playerId, track, vertex })),
  );
}

// City without a wall (best city first).
export function wallSpot(state: GameState, playerId: PlayerId): VertexId | null {
  const p = playerById(state, playerId);
  if ((p.cityWalls ?? 0) >= MAX_CITY_WALLS) return null;
  const open = p.cities
    .filter((v) => !state.cityWalls?.[v])
    .sort((a, b) => vertexScore(state, b, playerId) - vertexScore(state, a, playerId));
  return open[0] ?? null;
}

// City walls raise the 7-roll hand limit by 2. Worth it when we tend to hold
// a big hand and the brick isn't needed for the next build.
export function tryBuildWall(state: GameState, playerId: PlayerId): Action | null {
  const spot = wallSpot(state, playerId);
  if (!spot) return null;
  const p = playerById(state, playerId);
  if (!state.engineeringActive) {
    if (!canAfford(p.resources, COSTS.cityWall)) return null;
    const limit = 7 + 2 * (p.cityWalls ?? 0);
    const hand = handSizeCK(p);
    const needs = ckReportNeeds(state, playerId);
    const brickNeeded = needs.goal === 'settlement' || needs.goal === 'road';
    const spareBrick = p.resources.brick - (brickNeeded ? 1 : 0);
    if (spareBrick < 2) return null;
    if (hand < limit - 1) return null;
  }
  return firstLegal(state, [{ type: 'buildCityWall', playerId, vertex: spot }]);
}
