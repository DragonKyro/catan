import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase, giveResources } from '../__testHelpers';
import { calculateVictoryPoints } from '../scoring/points';

function setup5pGame() {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C', 'D', 'E'],
      seed: 42,
      randomizeTurnOrder: false,
    }),
  );
}

function setup3pGame() {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 42,
      randomizeTurnOrder: false,
    }),
  );
}

describe('endTurn', () => {
  it('3-player game: ending main turn advances to next player directly (no SBP)', () => {
    let s = setup3pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    expect(s.phase).toBe('main');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.turnHolderIndex).toBe(1);
    expect(s.sbpQueue).toBeUndefined();
  });

  it('5-player game: ending main turn drops into Special Build Phase', () => {
    let s = setup5pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    expect(s.phase).toBe('main');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('specialBuildPhase');
    // turn holder stays pinned to p0; sbp queue has the other 4 in order.
    expect(s.turnHolderIndex).toBe(0);
    expect(s.sbpQueue).toEqual(['p1', 'p2', 'p3', 'p4']);
    // currentPlayerIndex now points to p1 (the first SBP player).
    expect(s.currentPlayerIndex).toBe(1);
  });

  it('5-player game: each SBP "endTurn" pops the queue; final advances to next real turn', () => {
    let s = setup5pGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('specialBuildPhase');
    // p1 ends SBP
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.phase).toBe('specialBuildPhase');
    expect(s.sbpQueue).toEqual(['p2', 'p3', 'p4']);
    expect(s.currentPlayerIndex).toBe(2);
    // p2, p3, p4 each end SBP
    s = applyAction(s, { type: 'endTurn', playerId: 'p2' });
    s = applyAction(s, { type: 'endTurn', playerId: 'p3' });
    s = applyAction(s, { type: 'endTurn', playerId: 'p4' });
    // Now we should be back at the next real turn for p1.
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.turnHolderIndex).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.sbpQueue).toBeUndefined();
    expect(s.hasRolledThisTurn).toBe(false);
  });

  it('SBP-builder cannot win mid-SBP even after reaching the VP threshold', () => {
    // Set up a 5-player game where p1 is one VP away from winning. Roll p0's
    // turn so SBP triggers; p1 (the SBP-builder) buys a settlement that
    // would push them over the VP threshold. The win-check must not fire.
    let s = setup5pGame();
    // Force p1's VP-to-win to 1 so any settlement gives them the win — except
    // mid-SBP it shouldn't.
    s = {
      ...s,
      settings: { ...s.settings, victoryPointsToWin: 3 },
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('specialBuildPhase');
    expect(s.currentPlayerIndex).toBe(1);

    // p1 already has settlements from setup (2 VPs). Give them resources to
    // upgrade to a city, which adds 1 VP (city replaces settlement: +2 for city,
    // -1 for losing the settlement net = +1, bringing them to 3 VP exactly).
    const p1 = s.players[1]!;
    expect(p1.settlements.length).toBeGreaterThan(0);
    s = giveResources(s, 'p1', { wheat: 2, ore: 3 });
    const settlementToUpgrade = p1.settlements[0]!;
    s = applyAction(s, {
      type: 'buildCity',
      playerId: 'p1',
      vertex: settlementToUpgrade,
    });

    // p1 has reached the VP-to-win threshold but the game should NOT be over,
    // because they're in SBP, not their own turn.
    const vp = calculateVictoryPoints(s, 'p1', true);
    expect(vp).toBeGreaterThanOrEqual(3);
    expect(s.phase).toBe('specialBuildPhase');
    expect(s.winner).toBeNull();
  });
});
