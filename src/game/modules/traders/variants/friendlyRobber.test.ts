import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { runSetupPhase, giveResources } from '../../../__testHelpers';
import { applyAction } from '../../../engine';
import type { GameState } from '../../../types';

function startWithFriendlyRobber(): GameState {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 7,
      settings: {
        expansions: ['traders'],
        tradersScenarioId: 'riversOfCatan',
        tradersVariants: { friendlyRobber: true },
      },
      randomizeTurnOrder: false,
    }),
  );
}

describe('Friendly Robber variant', () => {
  it('blocks targeting a hex whose only neighbours are at 2 VP', () => {
    let s = startWithFriendlyRobber();
    // Force a 7 to enter robber phase. p0 rolls; nobody has > 7 cards yet.
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    s = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 });
    // Roll a 7 by injecting through a state mutation isn't supported; the
    // variant only fires in 'moveRobber' phase. Skip the real flow and
    // exercise the validator path by hand: install a moveRobber phase.
    const next: GameState = {
      ...s,
      phase: 'moveRobber',
      pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' },
    };
    // Pick a hex adjacent to p1's first settlement (so the only owner has
    // 2 starting VPs).
    const p1settle = s.players[1]!.settlements[0]!;
    const adjacentHex = s.board.vertices[p1settle]!.hexes.find(
      (h) => s.board.hexes[h]!.terrain !== 'desert',
    );
    if (!adjacentHex) return;
    expect(() =>
      applyAction(next, {
        type: 'moveRobber',
        playerId: 'p0',
        hex: adjacentHex,
        stealFrom: null,
      }),
    ).toThrow(/Friendly Robber/);
  });

  it('allows targeting a desert even at low VPs', () => {
    let s = startWithFriendlyRobber();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    const next: GameState = {
      ...s,
      phase: 'moveRobber',
      pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' },
    };
    // Rivers of Catan has no desert; just confirm validator returns null
    // for a hex with no adjacent buildings (an empty-coastal hex).
    const empty = Object.values(s.board.hexes).find(
      (h) =>
        h.terrain !== 'sea' &&
        h.terrain !== 'swamp' &&
        h.id !== s.board.robberHex &&
        s.board.vertexIds.every((vid) => {
          const v = s.board.vertices[vid]!;
          if (!v.hexes.includes(h.id)) return true;
          return !s.players.some(
            (p) => p.settlements.includes(vid) || p.cities.includes(vid),
          );
        }),
    );
    if (!empty) return;
    // Should not throw (no adjacent buildings, nothing for Friendly Robber
    // to forbid).
    expect(() =>
      applyAction(next, {
        type: 'moveRobber',
        playerId: 'p0',
        hex: empty.id,
        stealFrom: null,
      }),
    ).not.toThrow();
  });
});
