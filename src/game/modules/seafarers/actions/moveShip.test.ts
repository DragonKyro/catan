import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { runSetupPhase } from '../../../__testHelpers';
import { isShipMovable } from './moveShip';

describe('moveShip', () => {
  function setup() {
    return runSetupPhase(
      createGame({
        playerNames: ['A', 'B', 'C'],
        seed: 1,
        settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores' },
        randomizeTurnOrder: false,
      }),
    );
  }

  it('isShipMovable returns false when there are no ships', () => {
    const s = setup();
    for (const eid of s.board.edgeIds) {
      expect(isShipMovable(s, 'p0', eid)).toBe(false);
    }
  });

  it('rejects moveShip when player has no ships', () => {
    const s = setup();
    const someEdge = s.board.edgeIds[0]!;
    expect(() =>
      applyAction(s, {
        type: 'moveShip',
        playerId: 'p0',
        from: someEdge,
        to: s.board.edgeIds[1]!,
      }),
    ).toThrow();
  });

  it('rejects moveShip when player already moved a ship this turn', () => {
    let s = setup();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    // God-mode: give p0 a ship and mark movedShipThisTurn.
    const e1 = s.board.edgeIds[0]!;
    const e2 = s.board.edgeIds[1]!;
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, ships: [e1], movedShipThisTurn: true } : p,
      ),
    };
    expect(() =>
      applyAction(s, { type: 'moveShip', playerId: 'p0', from: e1, to: e2 }),
    ).toThrow(/Already moved/);
  });
});
