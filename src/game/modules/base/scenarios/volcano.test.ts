import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import type { VertexId } from '../../../types';

// Volcano scenario: setup blocks volcano-adjacent placement, and rolling the
// volcano's number destroys a random adjacent building.

function newVolcanoGame() {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 42,
    settings: { baseScenarioId: 'volcano', expansions: [] },
    randomizeTurnOrder: false,
  });
}

describe('Volcano scenario', () => {
  it('sets board.volcanoHex and pins its token to 6', () => {
    const game = newVolcanoGame();
    expect(game.board.volcanoHex).toBe('0,0');
    expect(game.board.hexes['0,0']!.numberToken).toBe(6);
    // Robber starts on the volcano (auto via robberStart hint).
    expect(game.board.robberHex).toBe('0,0');
  });

  it('rejects setup settlement on a vertex adjacent to the volcano', () => {
    const game = newVolcanoGame();
    const volcanoCorners = game.board.hexes['0,0']!.corners;
    expect(() =>
      applyAction(game, {
        type: 'placeInitialSettlement',
        playerId: 'p0',
        vertex: volcanoCorners[0]!,
      }),
    ).toThrow(/volcano/i);
  });

  it('erupts when the volcano number rolls: settlement destroyed', () => {
    const game = newVolcanoGame();
    const volcanoHex = game.board.hexes['0,0']!;
    const corners = volcanoHex.corners;

    // Manually place a settlement on a volcano corner — bypassing the setup
    // restriction by mutating state directly (the engine's setup validator
    // is exercised in the test above).
    const victim = corners[0]!;
    const seeded = {
      ...game,
      players: game.players.map((p, i) =>
        i === 0 ? { ...p, settlements: [...p.settlements, victim] } : p,
      ),
      phase: 'rollOrPlayKnight' as const,
      hasRolledThisTurn: false,
      hasPlayedDevCardThisTurn: false,
    };

    const afterRoll = applyAction(seeded, {
      type: 'rollDice',
      playerId: 'p0',
      // Roll a 6 (3+3) — matches the volcano's pinned token.
      dice: [3, 3] as [number, number],
    });

    // Settlement gone from the volcano corner.
    expect(afterRoll.players[0]!.settlements.includes(victim)).toBe(false);
  });

  it('erupts: city downgrades to settlement', () => {
    const game = newVolcanoGame();
    const corners = game.board.hexes['0,0']!.corners;
    const victim = corners[0]! as VertexId;
    const seeded = {
      ...game,
      players: game.players.map((p, i) =>
        i === 0 ? { ...p, cities: [...p.cities, victim] } : p,
      ),
      phase: 'rollOrPlayKnight' as const,
      hasRolledThisTurn: false,
      hasPlayedDevCardThisTurn: false,
    };
    const afterRoll = applyAction(seeded, {
      type: 'rollDice',
      playerId: 'p0',
      dice: [3, 3] as [number, number],
    });
    expect(afterRoll.players[0]!.cities.includes(victim)).toBe(false);
    expect(afterRoll.players[0]!.settlements.includes(victim)).toBe(true);
  });

  it('no-ops when no buildings sit on volcano corners', () => {
    const game = newVolcanoGame();
    const seeded = {
      ...game,
      phase: 'rollOrPlayKnight' as const,
      hasRolledThisTurn: false,
      hasPlayedDevCardThisTurn: false,
    };
    const afterRoll = applyAction(seeded, {
      type: 'rollDice',
      playerId: 'p0',
      dice: [3, 3] as [number, number],
    });
    // No state-shape change from the eruption branch — just standard
    // production phase progression.
    expect(afterRoll.phase).toBe('main');
  });
});
