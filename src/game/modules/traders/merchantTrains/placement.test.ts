import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { canPlaceWagon, wagonDegreeAtVertex } from './placement';
import type { GameState, TradeWagon, VertexId } from '../../../types';

function newMerchantGame(): GameState {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'merchantTrains',
    },
    randomizeTurnOrder: false,
  });
}

// Helper: find an edge of the watering hole hex.
function aWateringHoleEdge(state: GameState): string {
  const hex = state.board.hexes[state.wateringHoleHexId!]!;
  for (const eid of Object.keys(state.board.edges)) {
    const e = state.board.edges[eid]!;
    if (e.hexes.includes(hex.id)) return eid;
  }
  throw new Error('No edge on watering hole');
}

// Helper: find a non-watering-hole edge.
function aDistantEdge(state: GameState): string {
  const hexId = state.wateringHoleHexId!;
  for (const eid of Object.keys(state.board.edges)) {
    const e = state.board.edges[eid]!;
    if (!e.hexes.includes(hexId)) return eid;
  }
  throw new Error('No distant edge');
}

describe('canPlaceWagon', () => {
  it('allows placement on any edge of the watering hole', () => {
    const s = newMerchantGame();
    const e = aWateringHoleEdge(s);
    expect(canPlaceWagon(s, e)).toBe(true);
  });

  it('rejects distant edges when no wagons are placed yet', () => {
    const s = newMerchantGame();
    const e = aDistantEdge(s);
    expect(canPlaceWagon(s, e)).toBe(false);
  });

  it('allows placement at a train endpoint (degree-1 vertex)', () => {
    const s = newMerchantGame();
    const start = aWateringHoleEdge(s);
    // After placing a wagon on `start`, both of its vertex endpoints are
    // degree-1 wagon vertices, so extending from either side is legal.
    const withWagon: GameState = {
      ...s,
      wagons: [{ edge: start } as TradeWagon],
    };
    const v0 = s.board.edges[start]!.vertices[0]!;
    const next = s.board.vertices[v0]!.edges.find((eid) => eid !== start)!;
    expect(canPlaceWagon(withWagon, next)).toBe(true);
  });

  it('wagonDegreeAtVertex counts incident wagon edges', () => {
    const s = newMerchantGame();
    const e1 = aWateringHoleEdge(s);
    const v: VertexId = s.board.edges[e1]!.vertices[0]!;
    const e2 = s.board.vertices[v]!.edges.find((eid) => eid !== e1)!;
    const merged: GameState = {
      ...s,
      wagons: [{ edge: e1 }, { edge: e2 }] as TradeWagon[],
    };
    expect(wagonDegreeAtVertex(merged, v)).toBe(2);
  });

  it('rejects an edge that already has a wagon', () => {
    const s = newMerchantGame();
    const e = aWateringHoleEdge(s);
    const populated: GameState = {
      ...s,
      wagons: [{ edge: e } as TradeWagon],
    };
    expect(canPlaceWagon(populated, e)).toBe(false);
  });

  it('rejects placement when the supply is empty', () => {
    const s = newMerchantGame();
    const e = aWateringHoleEdge(s);
    const empty: GameState = { ...s, wagonSupply: 0 };
    expect(canPlaceWagon(empty, e)).toBe(false);
  });
});
