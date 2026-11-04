import type {
  GameState,
  BuildSettlementAction,
  PlaceInitialSettlementAction,
  VertexId,
} from '../../../types';
import { handleBuildSettlement as baseBuildSettlement } from '../../../actions/build';
import {
  handlePlaceInitialSettlement as basePlaceInitialSettlement,
  startingResourcePhase,
} from '../../../actions/setup';
import { canPlaceInitialSettlement } from '../../../placement';
import { validateStartingIsland } from '../validation/setupPlacement';
import { afterSettlementPlaced } from '../hooks';
import { goldReturnPhase } from './fog';

export function handleBuildSettlementSeafarers(
  state: GameState,
  action: BuildSettlementAction,
): GameState {
  const next = baseBuildSettlement(state, action);
  return afterSettlementPlaced(next, action.playerId, action.vertex, { setup: false });
}

// Gold fields around a vertex that are on the table (fog that hasn't been
// explored yet pays nothing). Each one grants a resource of choice.
function goldPicksFor(state: GameState, vertexId: VertexId): number {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return 0;
  let n = 0;
  for (const hexId of vertex.hexes) {
    if (state.unrevealedFogHexes?.includes(hexId)) continue;
    if (state.board.hexes[hexId]?.terrain === 'gold') n++;
  }
  return n;
}

export function handlePlaceInitialSettlementSeafarers(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  validateStartingIsland(state, action.vertex);
  if (!canPlaceInitialSettlement(state, action.vertex)) {
    throw new Error('Starting settlement not allowed there');
  }
  const paysOut = state.phase === startingResourcePhase(state);
  let next = basePlaceInitialSettlement(state, action);
  next = afterSettlementPlaced(next, action.playerId, action.vertex, { setup: true });

  // The resource-paying starting settlement next to a gold field takes one
  // resource of choice per gold hex. Route through the chooseGoldResource
  // phase, then drop back into this setup round's road step.
  if (paysOut) {
    const picks = goldPicksFor(state, action.vertex);
    if (picks > 0) {
      const existing = next.goldChoiceState?.pending[action.playerId] ?? 0;
      next = {
        ...next,
        phase: 'chooseGoldResource',
        goldChoiceState: {
          pending: {
            ...(next.goldChoiceState?.pending ?? {}),
            [action.playerId]: existing + picks,
          },
          returnTo: goldReturnPhase(state.phase),
        },
      };
    }
  }
  return next;
}
