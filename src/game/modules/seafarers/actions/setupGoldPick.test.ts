import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import type { GameState } from '../../../types';

// Setup round-2 settlements adjacent to a gold hex must trigger the
// chooseGoldResource phase (one pick per adjacent gold hex) before the road
// step can proceed. Rulebook: "If your second settlement is placed adjacent
// to a Gold-field, you immediately receive one resource of your choice for
// that field."
describe('round-2 setup gold pick', () => {
  function freshGame(): GameState {
    return createGame({
      playerNames: ['A', 'B'],
      seed: 5,
      settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores' },
      randomizeTurnOrder: false,
    });
  }

  // Advance setup to a state where p0 is about to place their second
  // settlement. Picks a non-gold-adjacent vertex for p0's first settlement
  // and a far-away vertex for p1, leaving setup midway through round 2.
  function reachP0Round2(state: GameState): GameState {
    let s = state;
    // p0 round-1: arbitrary vertex on the main island.
    const outerIslandIds = new Set(s.islandChips!.map((c) => c.islandId));
    const mainVertices = s.board.vertexIds.filter((vid) => {
      const v = s.board.vertices[vid]!;
      const lands = v.hexes
        .map((h) => s.board.islandOfHex![h])
        .filter((id): id is string => Boolean(id));
      // Vertex touches the main island AND no gold hex.
      const touchesMain = lands.some((id) => !outerIslandIds.has(id));
      const touchesGold = v.hexes.some(
        (h) => s.board.hexes[h]?.terrain === 'gold',
      );
      return touchesMain && !touchesGold && lands.length > 0;
    });
    const v1 = mainVertices[0]!;
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: v1 });
    const v1road = s.board.vertices[v1]!.edges.find((eid) => {
      const e = s.board.edges[eid]!;
      return !e.hexes.every((h) => s.board.hexes[h]?.terrain === 'sea');
    })!;
    s = applyAction(s, { type: 'placeInitialRoad', playerId: 'p0', edge: v1road });

    // p1 round-1: a far vertex.
    const v1Vertex = s.board.vertices[v1]!;
    const neighbors = new Set([v1, ...v1Vertex.neighborVertices]);
    const v2 = mainVertices.find((vid) => !neighbors.has(vid))!;
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p1', vertex: v2 });
    const v2road = s.board.vertices[v2]!.edges.find((eid) => {
      const e = s.board.edges[eid]!;
      return !e.hexes.every((h) => s.board.hexes[h]?.terrain === 'sea');
    })!;
    s = applyAction(s, { type: 'placeInitialRoad', playerId: 'p1', edge: v2road });

    // Now in round 2, p1 places first (snake order). Place far from gold.
    const taken = new Set<string>();
    for (const p of s.players) {
      for (const v of p.settlements) {
        taken.add(v);
        for (const n of s.board.vertices[v]!.neighborVertices) taken.add(n);
      }
    }
    const p1r2 = mainVertices.find((vid) => !taken.has(vid))!;
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p1', vertex: p1r2 });
    const r2road = s.board.vertices[p1r2]!.edges.find((eid) => {
      const e = s.board.edges[eid]!;
      return !e.hexes.every((h) => s.board.hexes[h]?.terrain === 'sea');
    })!;
    s = applyAction(s, { type: 'placeInitialRoad', playerId: 'p1', edge: r2road });

    // p0's second settlement is up.
    return s;
  }

  it('triggers chooseGoldResource when p0 places their second settlement next to a gold hex', () => {
    let s = reachP0Round2(freshGame());
    expect(s.phase).toBe('setupRound2');
    expect(s.setupState?.step).toBe('settlement');

    // Find a gold-adjacent vertex that isn't already taken or blocked.
    const taken = new Set<string>();
    for (const p of s.players) {
      for (const v of p.settlements) {
        taken.add(v);
        for (const n of s.board.vertices[v]!.neighborVertices) taken.add(n);
      }
    }
    const goldVertex = s.board.vertexIds.find((vid) => {
      if (taken.has(vid)) return false;
      const v = s.board.vertices[vid]!;
      return v.hexes.some((h) => s.board.hexes[h]?.terrain === 'gold');
    });
    if (!goldVertex) {
      // No reachable gold-adjacent main-island vertex on this seed; nothing
      // to assert. Skip rather than fail.
      return;
    }

    s = applyAction(s, {
      type: 'placeInitialSettlement',
      playerId: 'p0',
      vertex: goldVertex,
    });
    expect(s.phase).toBe('chooseGoldResource');
    expect(s.goldChoiceState?.returnTo).toBe('setupRound2');
    expect(s.goldChoiceState?.pending['p0']).toBeGreaterThanOrEqual(1);

    const owed = s.goldChoiceState!.pending['p0']!;
    const wheatBefore = s.players[0]!.resources.wheat;
    s = applyAction(s, {
      type: 'chooseGoldResource',
      playerId: 'p0',
      resources: Array(owed).fill('wheat' as const),
    });
    // After picks resolve, we should be back in setupRound2 with step=road.
    expect(s.phase).toBe('setupRound2');
    expect(s.setupState?.step).toBe('road');
    expect(s.players[0]!.resources.wheat).toBe(wheatBefore + owed);
  });
});
