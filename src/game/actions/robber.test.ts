import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase } from '../__testHelpers';

function setupGame() {
  return runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42 }));
}

describe('discard + robber', () => {
  it('requires half (rounded down) when over 7 cards on a 7-roll', () => {
    let s = setupGame();
    // Give p1 8 cards
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? { ...p, resources: { wood: 3, brick: 2, sheep: 1, wheat: 1, ore: 1 } }
          : p,
      ),
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('discard');
    expect(s.discardState?.required['p1']).toBe(4);
  });

  it('completes discard then moves to moveRobber', () => {
    let s = setupGame();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? { ...p, resources: { wood: 3, brick: 2, sheep: 1, wheat: 1, ore: 1 } }
          : p,
      ),
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    s = applyAction(s, {
      type: 'discard',
      playerId: 'p1',
      resources: { wood: 3, brick: 1 },
    });
    expect(s.phase).toBe('moveRobber');
    expect(s.players[1]!.resources.wood).toBe(0);
    expect(s.players[1]!.resources.brick).toBe(1);
  });

  it('rejects moving the robber to the same hex', () => {
    let s = setupGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('moveRobber');
    expect(() =>
      applyAction(s, {
        type: 'moveRobber',
        playerId: 'p0',
        hex: s.board.robberHex,
        stealFrom: null,
      }),
    ).toThrow(/different hex/i);
  });

  it('moves the robber to a new hex and returns to main', () => {
    let s = setupGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    // Find a hex with no adjacent settlements/cities (so no steal needed)
    const occupied = new Set<string>();
    for (const p of s.players) {
      for (const v of [...p.settlements, ...p.cities]) occupied.add(v);
    }
    const emptyHex = s.board.hexIds.find((h) => {
      if (h === s.board.robberHex) return false;
      const corners = Object.values(s.board.vertices).filter((v) => v.hexes.includes(h));
      return corners.every((v) => !occupied.has(v.id));
    });
    // Some boards may not have such a hex; in that case skip.
    if (!emptyHex) return;
    s = applyAction(s, {
      type: 'moveRobber',
      playerId: 'p0',
      hex: emptyHex,
      stealFrom: null,
    });
    expect(s.board.robberHex).toBe(emptyHex);
    expect(s.phase).toBe('main');
  });
});
