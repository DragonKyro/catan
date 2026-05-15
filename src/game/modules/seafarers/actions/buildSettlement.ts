import type {
  GameState,
  BuildSettlementAction,
  PlaceInitialSettlementAction,
} from '../../../types';
import { handleBuildSettlement as baseBuildSettlement } from '../../../actions/build';
import { handlePlaceInitialSettlement as basePlaceInitialSettlement } from '../../../actions/setup';

// After a settlement is placed, check whether it sits on an outer-island
// chip that hasn't been claimed yet. Award the chip to this player.
//
// A settlement vertex can be adjacent to multiple hexes from the same
// island; we award at most ONE chip per island per settlement. A vertex
// straddling two outer islands (very rare given how the board is built but
// possible at a sea-bridge corner) awards both unclaimed chips.
function claimIslandChips(state: GameState, playerId: string, vertexId: string): GameState {
  if (!state.islandChips || !state.board.islandOfHex) return state;
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return state;

  const islandIds = new Set<string>();
  for (const hexId of vertex.hexes) {
    const islandId = state.board.islandOfHex[hexId];
    if (islandId) islandIds.add(islandId);
  }

  let changed = false;
  const newChips = state.islandChips.map((chip) => {
    if (chip.firstSettler === null && islandIds.has(chip.islandId)) {
      changed = true;
      return { ...chip, firstSettler: playerId };
    }
    return chip;
  });
  return changed ? { ...state, islandChips: newChips } : state;
}

export function handleBuildSettlementWithChips(
  state: GameState,
  action: BuildSettlementAction,
): GameState {
  const next = baseBuildSettlement(state, action);
  return claimIslandChips(next, action.playerId, action.vertex);
}

export function handlePlaceInitialSettlementWithChips(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  const next = basePlaceInitialSettlement(state, action);
  return claimIslandChips(next, action.playerId, action.vertex);
}
