import type {
  GameState,
  BuildRoadAction,
  PlaceInitialRoadAction,
} from '../../../types';
import { handleBuildRoad as baseBuildRoad } from '../../../actions/build';
import { handlePlaceInitialRoad as basePlaceInitialRoad } from '../../../actions/setup';
import { revealAdjacentFog } from './fog';

// Seafarers wrappers for road handlers. The only thing they add beyond
// the base behaviour is the Fog Island reveal hook: building a road
// adjacent to an unrevealed fog hex lifts the fog and grants the reveal
// reward (the helper is a no-op when no fog is active).
export function handleBuildRoadWithFog(state: GameState, action: BuildRoadAction): GameState {
  const next = baseBuildRoad(state, action);
  const adj = next.board.edges[action.edge]?.hexes ?? [];
  return revealAdjacentFog(next, adj, action.playerId);
}

export function handlePlaceInitialRoadWithFog(
  state: GameState,
  action: PlaceInitialRoadAction,
): GameState {
  const next = basePlaceInitialRoad(state, action);
  const adj = next.board.edges[action.edge]?.hexes ?? [];
  return revealAdjacentFog(next, adj, action.playerId);
}
