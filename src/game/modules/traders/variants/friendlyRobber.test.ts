import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { runSetupPhase, giveResources } from '../../../__testHelpers';
import { applyAction, robberHexAllowed, robberStealCandidates } from '../../../engine';
import { calculateVictoryPoints } from '../../../scoring/points';
import { chooseRobberMove } from '@/ai/robber';
import type { GameState, HexId, PlayerId } from '../../../types';
import { friendlyRobberTargets } from './friendlyRobber';

// A base game (no T&B expansion: the variant works with any rule set) in
// the robber step, p0 to move.
function robberStep(): GameState {
  const s = runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 7,
      settings: { tradersVariants: { friendlyRobber: true } },
      randomizeTurnOrder: false,
    }),
  );
  return {
    ...applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] }),
    phase: 'moveRobber',
    pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' },
  };
}

function owners(s: GameState, hex: HexId): PlayerId[] {
  const corners = new Set(s.board.hexes[hex]!.corners);
  return s.players
    .filter((p) => [...p.settlements, ...p.cities].some((v) => corners.has(v)))
    .map((p) => p.id);
}

// Upgrade p1's first settlement to a city: 3 VP, no longer protected.
function p1AtThreeVp(s: GameState): GameState {
  const v = s.players[1]!.settlements[0]!;
  return {
    ...s,
    players: s.players.map((p) =>
      p.id === 'p1'
        ? { ...p, settlements: p.settlements.filter((x) => x !== v), cities: [v] }
        : p,
    ),
  };
}

describe('Friendly Robber variant', () => {
  it('is kept on a base game and needs no T&B expansion', () => {
    const s = robberStep();
    expect(s.settings.expansions).toEqual([]);
    expect(s.settings.tradersVariants?.friendlyRobber).toBe(true);
  });

  it('forbids every hex with a building of a player who has only 2 VPs', () => {
    const s = robberStep();
    for (const h of s.board.hexIds) {
      if (owners(s, h).length === 0) continue;
      expect(robberHexAllowed(s, h, 'p0')).toBe(false);
      expect(() =>
        applyAction(s, { type: 'moveRobber', playerId: 'p0', hex: h, stealFrom: null }),
      ).toThrow(/Friendly Robber|may not move/);
    }
    // Empty land hexes are fine.
    const empty = s.board.hexIds.find(
      (h) =>
        s.board.hexes[h]!.terrain !== 'sea' &&
        h !== s.board.robberHex &&
        owners(s, h).length === 0,
    )!;
    expect(robberHexAllowed(s, empty, 'p0')).toBe(true);
  });

  it('a 2-VP building forbids the hex even when a 3-VP player is there too', () => {
    const s = p1AtThreeVp(robberStep());
    expect(calculateVictoryPoints(s, 'p1', false)).toBe(3);
    const mixed = s.board.hexIds.find((h) => {
      const o = owners(s, h);
      return o.includes('p1') && o.some((id) => id !== 'p1');
    });
    if (mixed) expect(robberHexAllowed(s, mixed, 'p0')).toBe(false);
    const onlyP1 = s.board.hexIds.find((h) => {
      const o = owners(s, h);
      return o.length === 1 && o[0] === 'p1' && h !== s.board.robberHex;
    })!;
    expect(robberHexAllowed(s, onlyP1, 'p0')).toBe(true);
    const t = giveResources(s, 'p1', { wood: 1 });
    expect(robberStealCandidates(t, 'p0', onlyP1)).toEqual(['p1']);
  });

  it('with no valid hex the robber goes to the desert and robs only a 3+ VP neighbour', () => {
    let s = p1AtThreeVp(robberStep());
    const desert = s.board.hexIds.find((h) => s.board.hexes[h]!.terrain === 'desert')!;
    const [c0, , , c3] = s.board.hexes[desert]!.corners;
    // p1 keeps its city (3 VP with a settlement on the desert); p2 has just
    // one settlement, on the desert (1 VP).
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? { ...p, settlements: [c0!] }
          : p.id === 'p2'
            ? { ...p, settlements: [c3!], cities: [] }
            : p,
      ),
    };
    s = {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        resources: { wood: p.id === 'p1' ? 1 : 0, brick: 0, sheep: 0, wheat: 0, ore: p.id === 'p2' ? 1 : 0 },
      })),
    };
    // Every other land hex is off the table; the robber stands elsewhere.
    const other = s.board.hexIds.find((h) => h !== desert && s.board.hexes[h]!.terrain !== 'sea')!;
    s = {
      ...s,
      board: { ...s.board, robberHex: other },
      robberBlockedHexes: s.board.hexIds.filter((h) => h !== desert),
    };
    expect(calculateVictoryPoints(s, 'p2', false)).toBeLessThanOrEqual(2);
    expect(friendlyRobberTargets(s)).toEqual([desert]);
    expect(robberStealCandidates(s, 'p0', desert)).toEqual(['p1']);
    expect(() =>
      applyAction(s, { type: 'moveRobber', playerId: 'p0', hex: desert, stealFrom: 'p2' }),
    ).toThrow(/steal/);
    const after = applyAction(s, { type: 'moveRobber', playerId: 'p0', hex: desert, stealFrom: 'p1' });
    expect(after.board.robberHex).toBe(desert);
    expect(after.players[1]!.resources.wood).toBe(0);
  });

  it('the AI only picks legal hexes and victims', () => {
    for (const st of [robberStep(), p1AtThreeVp(robberStep())]) {
      const s = giveResources(st, 'p1', { wood: 2 });
      const choice = chooseRobberMove(s, 'p0');
      expect(friendlyRobberTargets(s)).toContain(choice.hex);
      if (choice.stealFrom) {
        expect(calculateVictoryPoints(s, choice.stealFrom, false)).toBeGreaterThan(2);
      }
      expect(() =>
        applyAction(s, {
          type: 'moveRobber',
          playerId: 'p0',
          hex: choice.hex,
          stealFrom: choice.stealFrom,
        }),
      ).not.toThrow();
    }
  });
});
