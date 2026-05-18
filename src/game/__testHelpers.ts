// Test-only helpers for scripting setup / state mutation in unit tests.
// Not imported by production code.

import type {
  GameState,
  VertexId,
  EdgeId,
  PlayerId,
  ResourceBank,
} from './types';
import { applyAction } from './engine';
import { addResources } from './resources';
import { canPlaceInitialSettlement } from './placement';

export function findValidSettlementSpot(state: GameState): VertexId {
  for (const vid of state.board.vertexIds) {
    if (canPlaceInitialSettlement(state, vid)) return vid;
  }
  throw new Error('No valid settlement spot found');
}

export function findValidRoadFromVertex(state: GameState, vid: VertexId): EdgeId {
  const v = state.board.vertices[vid]!;
  for (const eid of v.edges) {
    const edge = state.board.edges[eid]!;
    // Skip sea-only edges (those are ship-only).
    if (edge.hexes.every((h) => state.board.hexes[h]!.terrain === 'sea')) continue;
    let used = false;
    for (const p of state.players) {
      if (p.roads.includes(eid)) {
        used = true;
        break;
      }
    }
    if (!used) return eid;
  }
  throw new Error('No valid road edge from that vertex');
}

export function runSetupPhase(state: GameState): GameState {
  let s = state;
  let safetyCounter = 0;
  while (
    s.phase === 'setupRound1' ||
    s.phase === 'setupRound2' ||
    s.phase === 'chooseGoldResource'
  ) {
    if (++safetyCounter > 80) throw new Error('Setup phase did not terminate');
    // Seafarers: a gold-adjacent round-2 settlement opens a chooseGoldResource
    // interlude before the road step. Resolve it by picking arbitrary
    // resources from the bank so setup can proceed.
    if (s.phase === 'chooseGoldResource') {
      const pending = s.goldChoiceState!.pending;
      const pickerId = Object.keys(pending)[0]!;
      const picks = pending[pickerId]!;
      s = applyAction(s, {
        type: 'chooseGoldResource',
        playerId: pickerId,
        resources: Array(picks).fill('wheat' as const),
      });
      continue;
    }
    const currentId = s.playerOrder[s.currentPlayerIndex]!;
    if (s.setupState?.step === 'settlement') {
      const vid = findValidSettlementSpot(s);
      s = applyAction(s, {
        type: 'placeInitialSettlement',
        playerId: currentId,
        vertex: vid,
      });
    } else {
      const placedVid = s.setupState!.lastPlacedSettlement!;
      const eid = findValidRoadFromVertex(s, placedVid);
      s = applyAction(s, {
        type: 'placeInitialRoad',
        playerId: currentId,
        edge: eid,
      });
    }
  }
  return s;
}

// God-mode resource gift — used to set up specific scenarios for testing.
export function giveResources(
  state: GameState,
  playerId: PlayerId,
  resources: Partial<ResourceBank>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, resources: addResources(p.resources, resources) } : p,
    ),
  };
}
