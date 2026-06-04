import { describe, it, expect } from 'vitest';
import { createGame } from '../../../../createGame';

function newRiversGame() {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'riversOfCatan',
    },
    randomizeTurnOrder: false,
  });
}

describe('Rivers of Catan scenario', () => {
  it('generates exactly 2 swamp hexes', () => {
    const s = newRiversGame();
    const swamps = Object.values(s.board.hexes).filter(
      (h) => h.terrain === 'swamp',
    );
    expect(swamps.length).toBe(2);
  });

  it('swamps have no number tokens', () => {
    const s = newRiversGame();
    for (const h of Object.values(s.board.hexes)) {
      if (h.terrain === 'swamp') expect(h.numberToken).toBeNull();
    }
  });

  it('robber starts on one of the two swamps', () => {
    const s = newRiversGame();
    const robberHex = s.board.hexes[s.board.robberHex]!;
    expect(robberHex.terrain).toBe('swamp');
  });

  it('exposes river edges (bridge sites) as a non-empty list', () => {
    const s = newRiversGame();
    expect(s.riverEdges).toBeDefined();
    expect((s.riverEdges ?? []).length).toBeGreaterThan(0);
    // Every river-edge id must exist in the board's edge graph.
    for (const eid of s.riverEdges ?? []) {
      expect(s.board.edges[eid]).toBeDefined();
    }
  });

  it('seeds wealth tiles with everyone tied (no holder, no poor)', () => {
    const s = newRiversGame();
    expect(s.wealthTiles).toEqual({ wealthiest: null, poor: [] });
  });

  it('sets victory points to 10 (Rivers default)', () => {
    const s = newRiversGame();
    expect(s.settings.victoryPointsToWin).toBe(10);
  });

  it('bumps target VP by 1 with the Strongest Ports variant', () => {
    const s = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      settings: {
        expansions: ['traders'],
        tradersScenarioId: 'riversOfCatan',
        tradersVariants: { strongestPorts: true },
      },
      randomizeTurnOrder: false,
    });
    expect(s.settings.victoryPointsToWin).toBe(11);
    expect(s.strongestPorts).toEqual({ holder: null });
  });

  it('rejects 5+ player Rivers games (scope limit)', () => {
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C', 'D', 'E'],
        seed: 1,
        settings: {
          expansions: ['traders'],
          tradersScenarioId: 'riversOfCatan',
        },
        randomizeTurnOrder: false,
      }),
    ).toThrow(/3-4 players only/);
  });
});
