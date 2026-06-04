import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { calculateLongestRoad } from '../../../scoring/longestRoad';
import { calculateMerchantTrainsVp } from './merchantTrains';
import type { GameState, TradeWagon } from '../../../types';

function newMerchantSession(): GameState {
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

describe('Merchant Trains scoring', () => {
  it('longest road counts wagon-on-road edges as 2', () => {
    const s = newMerchantSession();
    // Build a synthetic 3-road chain for p0 and place a wagon on one of
    // the edges.
    const board = s.board;
    // Find any non-sea hex; take its first 3 corners and the edges between
    // them — that's a 2-edge linear chain on a hex perimeter. We'll add a
    // third edge through one corner to a neighbour.
    const hexId = board.hexIds.find(
      (id) => board.hexes[id]!.terrain !== 'sea' && board.hexes[id]!.terrain !== 'wateringHole',
    )!;
    const hex = board.hexes[hexId]!;
    const corners = hex.corners;
    function findEdge(va: string, vb: string): string {
      for (const eid of board.vertices[va]!.edges) {
        const e = board.edges[eid]!;
        if (
          (e.vertices[0] === va && e.vertices[1] === vb) ||
          (e.vertices[1] === va && e.vertices[0] === vb)
        ) {
          return eid;
        }
      }
      throw new Error('No edge between vertices');
    }
    const e1 = findEdge(corners[0]!, corners[1]!);
    const e2 = findEdge(corners[1]!, corners[2]!);
    const e3 = findEdge(corners[2]!, corners[3]!);
    const withRoads: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, roads: [e1, e2, e3] } : p,
      ),
    };
    // Without wagons: longest = 3.
    expect(calculateLongestRoad(withRoads, 'p0')).toBe(3);
    // With a wagon on e2: each crossing of e2 contributes 2, so a path
    // e1-e2-e3 has length 1 + 2 + 1 = 4.
    const withWagon: GameState = {
      ...withRoads,
      wagons: [{ edge: e2 } as TradeWagon],
    };
    expect(calculateLongestRoad(withWagon, 'p0')).toBe(4);
  });

  it('settlement between two wagons earns +1 VP', () => {
    const s = newMerchantSession();
    // Pick any non-watering-hole, non-sea hex.
    const board = s.board;
    const hexId = board.hexIds.find(
      (id) => board.hexes[id]!.terrain !== 'sea' && board.hexes[id]!.terrain !== 'wateringHole',
    )!;
    const hex = board.hexes[hexId]!;
    const corners = hex.corners;
    const v = corners[1]!;
    // Find two edges incident to `v`.
    const edges = board.vertices[v]!.edges;
    expect(edges.length).toBeGreaterThanOrEqual(2);
    const e1 = edges[0]!;
    const e2 = edges[1]!;
    const withSettle: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, settlements: [v] } : p,
      ),
      wagons: [{ edge: e1 }, { edge: e2 }] as TradeWagon[],
    };
    expect(calculateMerchantTrainsVp(withSettle, 'p0')).toBe(1);
  });

  it('no VP when only one wagon flanks the building', () => {
    const s = newMerchantSession();
    const board = s.board;
    const hexId = board.hexIds.find(
      (id) => board.hexes[id]!.terrain !== 'sea' && board.hexes[id]!.terrain !== 'wateringHole',
    )!;
    const v = board.hexes[hexId]!.corners[1]!;
    const edges = board.vertices[v]!.edges;
    const withSettle: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, settlements: [v] } : p,
      ),
      wagons: [{ edge: edges[0]! }] as TradeWagon[],
    };
    expect(calculateMerchantTrainsVp(withSettle, 'p0')).toBe(0);
  });
});
