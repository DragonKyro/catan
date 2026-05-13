import { describe, it, expect } from 'vitest';
import { createGame } from './createGame';
import { applyAction } from './engine';
import { runSetupPhase, giveResources } from './__testHelpers';
import { calculateVictoryPoints } from './scoring/points';

describe('engine integration', () => {
  it('runs setup through a roll, build, and end-turn cleanly', () => {
    let s = createGame({ playerNames: ['A', 'B'], seed: 42 });
    s = runSetupPhase(s);
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.currentPlayerIndex).toBe(0);

    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    expect(s.phase).toBe('main');

    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.currentPlayerIndex).toBe(1);

    s = applyAction(s, { type: 'rollDice', playerId: 'p1', dice: [4, 4] });
    expect(s.phase).toBe('main');
  });

  it('declares a winner when VP threshold is reached on a build', () => {
    // Use a low VP threshold so winning is easy
    let s = createGame({
      playerNames: ['A', 'B'],
      seed: 42,
      settings: { victoryPointsToWin: 4 },
    });
    s = runSetupPhase(s);
    // After setup, each player has 2 settlements = 2 VP.
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(2);

    // p0 rolls
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    // Give them resources to upgrade two settlements to cities (2 cities = 4 VP, threshold = 4)
    s = giveResources(s, 'p0', { wheat: 4, ore: 6 });
    const [v1, v2] = s.players[0]!.settlements;
    s = applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: v1! });
    // First city: 1 settlement + 1 city = 1 + 2 = 3 VP, no win yet
    expect(s.winner).toBeNull();
    s = applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: v2! });
    // Second city: 0 settlements + 2 cities = 0 + 4 = 4 VP, WIN
    expect(s.winner).toBe('p0');
    expect(s.phase).toBe('gameOver');
  });

  it('rejects actions once the game is over', () => {
    let s = createGame({
      playerNames: ['A', 'B'],
      seed: 42,
      settings: { victoryPointsToWin: 4 },
    });
    s = runSetupPhase(s);
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = giveResources(s, 'p0', { wheat: 4, ore: 6 });
    const [v1, v2] = s.players[0]!.settlements;
    s = applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: v1! });
    s = applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: v2! });
    expect(s.winner).toBe('p0');
    expect(() =>
      applyAction(s, { type: 'endTurn', playerId: 'p0' }),
    ).toThrow(/game is over/i);
  });
});
