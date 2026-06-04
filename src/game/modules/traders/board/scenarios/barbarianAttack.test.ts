import { describe, it, expect } from 'vitest';
import { createGame } from '../../../../createGame';

function newGame(seed = 1) {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'barbarianAttack',
    },
    randomizeTurnOrder: false,
  });
}

describe('Barbarian Attack scenario', () => {
  it('places exactly three castle hexes', () => {
    const s = newGame();
    const castles = Object.values(s.board.hexes).filter(
      (h) => h.terrain === 'castle',
    );
    expect(castles).toHaveLength(3);
  });

  it('castle hexes have no number token (non-producing)', () => {
    const s = newGame();
    for (const c of s.castles ?? []) {
      const hex = s.board.hexes[c.hexId]!;
      expect(hex.terrain).toBe('castle');
      expect(hex.numberToken).toBeNull();
    }
  });

  it('records three castles with resolved barbarian paths of length 4', () => {
    const s = newGame();
    expect(s.castles).toHaveLength(3);
    for (const c of s.castles ?? []) {
      expect(c.barbarianPath).toHaveLength(4);
      expect(c.barbarianPath[3]).toBe(c.hexId); // ends at castle
      expect(c.barbarianPosition).toBe(0);
      expect(c.barbarianStrength).toBe(4);
      expect(c.defenderVp).toEqual({});
    }
  });

  it('seeds 18 defender knights in the shared supply', () => {
    const s = newGame();
    expect(s.barbarianKnightSupply).toBe(18);
  });

  it('sets the victory-point target to 12', () => {
    const s = newGame();
    expect(s.settings.victoryPointsToWin).toBe(12);
  });

  it('preserves a desert in the producing pool', () => {
    const s = newGame();
    const deserts = Object.values(s.board.hexes).filter(
      (h) => h.terrain === 'desert',
    );
    expect(deserts).toHaveLength(1);
  });

  it('each player has an empty defenderKnights array', () => {
    const s = newGame();
    for (const p of s.players) {
      expect(p.defenderKnights).toEqual([]);
    }
  });

  it('rejects 5+ player Barbarian Attack games', () => {
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C', 'D', 'E'],
        seed: 1,
        settings: {
          expansions: ['traders'],
          tradersScenarioId: 'barbarianAttack',
        },
        randomizeTurnOrder: false,
      }),
    ).toThrow(/3-4 players only/);
  });
});
