import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { canStartOnIsland } from './setupPlacement';

// These tests pin down the main-island rule from the Seafarers rulebook:
// scenarios default to `mainIslandOnly` for starting placements, with Four
// Islands explicitly opting into `anyIsland`.
describe('Seafarers starting-island rule', () => {
  it('rejects round-1 settlements on outer islands by default', () => {
    const s = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 99,
      settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores' },
      randomizeTurnOrder: false,
    });
    // Pick the first vertex that belongs ONLY to an outer-island hex.
    const outerIslandIds = new Set(s.islandChips!.map((c) => c.islandId));
    const outerVertex = s.board.vertexIds.find((vid) => {
      const v = s.board.vertices[vid]!;
      const landIslands = v.hexes
        .map((h) => s.board.islandOfHex![h])
        .filter((id): id is string => Boolean(id));
      if (landIslands.length === 0) return false;
      return landIslands.every((id) => outerIslandIds.has(id));
    });
    expect(outerVertex).toBeTruthy();

    expect(canStartOnIsland(s, outerVertex!)).toBe(false);
    expect(() =>
      applyAction(s, {
        type: 'placeInitialSettlement',
        playerId: 'p0',
        vertex: outerVertex!,
      }),
    ).toThrow(/main island/i);
  });

  it('allows starting on any island in Four Islands', () => {
    const s = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 99,
      settings: { expansions: ['seafarers'], scenarioId: 'fourIslands' },
      randomizeTurnOrder: false,
    });
    const outerIslandIds = new Set(s.islandChips!.map((c) => c.islandId));
    const outerVertex = s.board.vertexIds.find((vid) => {
      const v = s.board.vertices[vid]!;
      const landIslands = v.hexes
        .map((h) => s.board.islandOfHex![h])
        .filter((id): id is string => Boolean(id));
      if (landIslands.length === 0) return false;
      return landIslands.every((id) => outerIslandIds.has(id));
    });
    expect(outerVertex).toBeTruthy();
    expect(canStartOnIsland(s, outerVertex!)).toBe(true);
  });

  it('is a no-op for non-Seafarers games', () => {
    const s = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      randomizeTurnOrder: false,
    });
    // Any vertex is a valid starting island when no scenario is set.
    const first = s.board.vertexIds[0]!;
    expect(canStartOnIsland(s, first)).toBe(true);
  });
});
