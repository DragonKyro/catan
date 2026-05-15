import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase } from '../__testHelpers';

function setupGame() {
  return runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42, randomizeTurnOrder: false }));
}

describe('rollDice', () => {
  it('rejects rolling outside rollOrPlayKnight phase', () => {
    let s = setupGame();
    // Roll non-7 so we land in main phase
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    expect(s.phase).toBe('main');
    expect(() =>
      applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] }),
    ).toThrow();
  });

  it('rejects invalid dice values', () => {
    const s = setupGame();
    expect(() =>
      applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [0, 4] }),
    ).toThrow();
    expect(() =>
      applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 7] }),
    ).toThrow();
  });

  it('distributes resources from matching hexes on non-7 roll', () => {
    let s = setupGame();
    // Find any non-desert hex on the board and force its number as the roll.
    // We do this by simulating until we find a roll that produces resources.
    const beforeTotal = s.players.reduce(
      (acc, p) => acc + Object.values(p.resources).reduce((a, b) => a + b, 0),
      0,
    );
    // Try rolls 2..12 (except 7) until one produces resources.
    let produced = false;
    for (const total of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12]) {
      const d1 = Math.max(1, total - 6);
      const d2 = total - d1;
      if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) continue;
      const next = applyAction(s, {
        type: 'rollDice',
        playerId: 'p0',
        dice: [d1, d2] as [number, number],
      });
      const afterTotal = next.players.reduce(
        (acc, p) => acc + Object.values(p.resources).reduce((a, b) => a + b, 0),
        0,
      );
      if (afterTotal > beforeTotal) {
        produced = true;
        expect(next.lastRoll?.total).toBe(total);
        expect(next.phase).toBe('main');
        break;
      }
    }
    expect(produced).toBe(true);
  });

  it('on a 7 with no over-7 hands, goes straight to moveRobber', () => {
    let s = setupGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    // Total is 7
    expect(s.phase).toBe('moveRobber');
    expect(s.pendingRobberMove?.reason).toBe('sevenRoll');
  });

  it('on a 7 with over-7 hands, enters discard phase', () => {
    let s = setupGame();
    // Give p1 enough resources to need to discard
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? {
              ...p,
              resources: { wood: 3, brick: 2, sheep: 1, wheat: 1, ore: 1 }, // 8 cards
            }
          : p,
      ),
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('discard');
    expect(s.discardState?.required['p1']).toBe(4);
  });

  it('records last roll on the state', () => {
    let s = setupGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [2, 4] });
    expect(s.lastRoll?.dice).toEqual([2, 4]);
    expect(s.lastRoll?.total).toBe(6);
    expect(s.lastRoll?.player).toBe('p0');
  });
});
