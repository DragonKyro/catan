import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase, giveResources } from '../__testHelpers';
import { calculateVictoryPoints } from '../scoring/points';

function setupNpGame(n: number) {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].slice(0, n);
  return runSetupPhase(
    createGame({ playerNames: names, seed: 42, randomizeTurnOrder: false }),
  );
}

const setup3pGame = () => setupNpGame(3);
const setup5pGame = () => setupNpGame(5);
const setup6pGame = () => setupNpGame(6);
const setup8pGame = () => setupNpGame(8);

describe('endTurn', () => {
  it('3-player game: ending main turn advances to next seat directly (no paired-player rule)', () => {
    let s = setup3pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    expect(s.phase).toBe('main');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.turnHolderIndex).toBe(1);
  });

  it('5-player game: Player 1 endTurn hands the paired turn to Player 2 (P1 + 3)', () => {
    let s = setup5pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    expect(s.phase).toBe('main');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    // Still in 'main' — P2 acts in the same phase, just with restricted rights.
    expect(s.phase).toBe('main');
    expect(s.turnHolderIndex).toBe(0); // P1 stays pinned
    expect(s.currentPlayerIndex).toBe(3); // P2 = (0 + 3) % 5
    // hasRolledThisTurn stays true — P2 inherits P1's roll, doesn't re-roll.
    expect(s.hasRolledThisTurn).toBe(true);
  });

  it('5-player game: Player 2 endTurn advances both markers and resets for the next paired turn', () => {
    let s = setup5pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.currentPlayerIndex).toBe(3);
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    // New paired turn: P1 is the next seat (p1), P2 is (1 + 3) % 5 = p4.
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.turnHolderIndex).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.hasRolledThisTurn).toBe(false);
  });

  it('6-player game: paired-player offset of 3 wraps correctly', () => {
    let s = setup6pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    // P2 = (0 + 3) % 6 = p3
    expect(s.currentPlayerIndex).toBe(3);
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    // Next paired turn: P1 = p1, P2 = p4
    expect(s.turnHolderIndex).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
    s = applyAction(s, { type: 'rollDice', playerId: 'p1', dice: [2, 2] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.currentPlayerIndex).toBe(4); // (1 + 3) % 6
  });

  it('8-player game: paired-player rule still applies (7-8p inherits from 5-6p)', () => {
    let s = setup8pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.currentPlayerIndex).toBe(3); // (0 + 3) % 8 = p3
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    expect(s.turnHolderIndex).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
  });

  it('5p: Player 2 may bank-trade but may NOT propose a player trade', () => {
    let s = setup5pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    // p3 is now acting as Player 2.
    s = giveResources(s, 'p3', { wood: 4 });
    s = applyAction(s, {
      type: 'bankTrade',
      playerId: 'p3',
      give: 'wood',
      receive: 'ore',
    });
    expect(s.players[3]!.resources.ore).toBe(1);
    // Player trade should throw.
    expect(() =>
      applyAction(s, {
        type: 'proposeTrade',
        playerId: 'p3',
        give: { wood: 1 },
        receive: { ore: 1 },
      }),
    ).toThrow(/Player 2/);
  });

  it('5p: Player 2 may build, buy a dev card, and win the game during their part', () => {
    let s = setup5pGame();
    s = { ...s, settings: { ...s.settings, victoryPointsToWin: 3 } };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.currentPlayerIndex).toBe(3);
    // p3 has 2 VP from setup settlements. Upgrade one to a city: city +2,
    // settlement -1 → net +1, total 3 VP, hits the win threshold.
    s = giveResources(s, 'p3', { wheat: 2, ore: 3 });
    const settlementToUpgrade = s.players[3]!.settlements[0]!;
    s = applyAction(s, {
      type: 'buildCity',
      playerId: 'p3',
      vertex: settlementToUpgrade,
    });
    expect(calculateVictoryPoints(s, 'p3', true)).toBeGreaterThanOrEqual(3);
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p3');
  });

  it('5p: simultaneous-10 — Player 1 wins because they act first', () => {
    let s = setup5pGame();
    s = { ...s, settings: { ...s.settings, victoryPointsToWin: 3 } };
    // Both p0 (P1) and p3 (P2) are at 2 VP from setup. Give P1 a city upgrade
    // to push them to 3 first; the game ends as 'gameOver' before P2 acts.
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = giveResources(s, 'p0', { wheat: 2, ore: 3 });
    const p0Settlement = s.players[0]!.settlements[0]!;
    s = applyAction(s, {
      type: 'buildCity',
      playerId: 'p0',
      vertex: p0Settlement,
    });
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p0');
  });
});
