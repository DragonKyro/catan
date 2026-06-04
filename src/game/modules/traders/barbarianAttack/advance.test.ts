import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { advanceBarbarians } from './advance';

function newGame() {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'barbarianAttack',
    },
    randomizeTurnOrder: false,
  });
}

describe('advanceBarbarians', () => {
  it('advances every barbarian by one hex', () => {
    const s = newGame();
    const next = advanceBarbarians(s);
    expect(next.castles).toHaveLength(3);
    for (const c of next.castles!) {
      expect(c.barbarianPosition).toBe(1);
    }
  });

  it('clamps at the castle hex (path length - 1)', () => {
    let s = newGame();
    // 4 advances: 0→1→2→3 then 3 (clamp).
    for (let i = 0; i < 5; i++) s = advanceBarbarians(s);
    for (const c of s.castles!) {
      expect(c.barbarianPosition).toBe(c.barbarianPath.length - 1);
    }
  });

  it('is a no-op when castles state is absent', () => {
    const s = newGame();
    const stripped = { ...s, castles: undefined };
    expect(advanceBarbarians(stripped)).toBe(stripped);
  });
});
