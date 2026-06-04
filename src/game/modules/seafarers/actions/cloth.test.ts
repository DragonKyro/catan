import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { calculateVictoryPoints, calculateClothVp } from '../../../scoring/points';
import type { GameState } from '../../../types';

// Cloth for Catan diverts production from designated hexes: instead of
// granting the hex's listed terrain resource, rolling its number gives
// each adjacent player cloth tokens (1 per settlement, 2 per city).
describe('Cloth for Catan: cloth production', () => {
  function fresh(): GameState {
    return createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 21,
      settings: { expansions: ['seafarers'], scenarioId: 'clothForCatan' },
      randomizeTurnOrder: false,
    });
  }

  it('seeds clothHexes from the scenario', () => {
    const s = fresh();
    expect(s.clothHexes).toBeDefined();
    expect(s.clothHexes!.length).toBeGreaterThan(0);
  });

  it('rolling a cloth hex grants cloth, not the listed terrain', () => {
    let s = fresh();
    // Plant p0's settlement on a corner of a cloth hex, then roll its number.
    const clothHexId = s.clothHexes![0]!;
    const cornerVid = s.board.vertexIds.find((vid) =>
      s.board.vertices[vid]!.hexes.includes(clothHexId),
    )!;
    const hex = s.board.hexes[clothHexId]!;
    const token = hex.numberToken!;
    s = {
      ...s,
      phase: 'rollOrPlayKnight',
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, settlements: [...p.settlements, cornerVid] } : p,
      ),
    };
    const d1 = Math.min(6, Math.max(1, token - 1));
    const d2 = token - d1;
    const before = s.players[0]!.cloth ?? 0;
    const resBefore = { ...s.players[0]!.resources };
    s = applyAction(s, {
      type: 'rollDice',
      playerId: s.playerOrder[0]!,
      dice: [d1 as 1, d2 as 1],
    });
    expect((s.players[0]!.cloth ?? 0)).toBe(before + 1);
    // No resource change from this hex (terrain is sheep but cloth diverts).
    // Other hexes with this token might still produce normally; just verify
    // cloth was incremented.
    expect(s.players[0]!.resources).toEqual(
      expect.objectContaining(resBefore),
    );
  });

  it('cities yield 2 cloth on a cloth hex', () => {
    let s = fresh();
    const clothHexId = s.clothHexes![0]!;
    const cornerVid = s.board.vertexIds.find((vid) =>
      s.board.vertices[vid]!.hexes.includes(clothHexId),
    )!;
    const hex = s.board.hexes[clothHexId]!;
    const token = hex.numberToken!;
    s = {
      ...s,
      phase: 'rollOrPlayKnight',
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, cities: [...p.cities, cornerVid] } : p,
      ),
    };
    const d1 = Math.min(6, Math.max(1, token - 1));
    const d2 = token - d1;
    const before = s.players[0]!.cloth ?? 0;
    s = applyAction(s, {
      type: 'rollDice',
      playerId: s.playerOrder[0]!,
      dice: [d1 as 1, d2 as 1],
    });
    expect((s.players[0]!.cloth ?? 0)).toBe(before + 2);
  });

  it('cloth converts to VP at 2:1 (floor)', () => {
    let s = fresh();
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, cloth: 5 } : p,
      ),
    };
    expect(calculateClothVp(s, 'p0')).toBe(2); // floor(5/2)
    // 4 cloth → 2 VP
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, cloth: 4 } : p,
      ),
    };
    expect(calculateClothVp(s, 'p0')).toBe(2);
    // 1 cloth → 0 VP
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, cloth: 1 } : p,
      ),
    };
    expect(calculateClothVp(s, 'p0')).toBe(0);
  });

  it('cloth VP shows up in total VP', () => {
    let s = fresh();
    const baseVp = calculateVictoryPoints(s, 'p0', false);
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, cloth: 6 } : p,
      ),
    };
    expect(calculateVictoryPoints(s, 'p0', false) - baseVp).toBe(3);
  });
});
