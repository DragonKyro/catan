import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import type { GameState, PlayerId } from '@/game/types';
import { DEFAULT_REWARD_WEIGHTS, finalStandings, terminalRewards, vpPotential } from './reward';

/** A finished game with these true VP totals (held as VP cards). */
function finished(vps: number[], winner: number | null): GameState {
  const s = createGame({ playerNames: vps.map((_, i) => `p${i}`), seed: 1, randomizeTurnOrder: false });
  return {
    ...s,
    phase: winner === null ? 'main' : 'gameOver',
    winner: winner === null ? null : `p${winner}`,
    players: s.players.map((p, i) => ({ ...p, devCards: { ...p.devCards, victoryPoints: vps[i]! } })),
  };
}

const list = (r: Record<PlayerId, number>, n: number) => Array.from({ length: n }, (_, i) => r[`p${i}`]!);

describe('terminal reward', () => {
  it('ranks winner first, then by VP, sharing tied places', () => {
    expect(finalStandings(finished([10, 8, 8, 4], 0)).map((s) => s.rank)).toEqual([1, 2.5, 2.5, 4]);
    // The winner leads the standings even if another seat sits on as many VP.
    expect(finalStandings(finished([9, 10, 3], 0)).map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it('pays the winner most, then each place in order, and sums to zero', () => {
    const r = list(terminalRewards(finished([10, 8, 6, 4], 0)), 4);
    expect(r[0]).toBeCloseTo(1.15, 2);
    expect(r[1]).toBeCloseTo(-0.117, 2);
    expect(r[2]).toBeCloseTo(-0.383, 2);
    expect(r[3]).toBeCloseTo(-0.65, 2);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9);
  });

  it('rewards VP within a place, and a higher place over more VP', () => {
    const close = list(terminalRewards(finished([10, 9, 2, 2], 0)), 4);
    const far = list(terminalRewards(finished([10, 5, 2, 2], 0)), 4);
    expect(close[1]! - close[2]!).toBeGreaterThan(far[1]! - far[2]!);
    // Second with 5 VP beats third with 5 VP.
    const r = list(terminalRewards(finished([10, 5, 5, 2], 0)), 4);
    expect(r[1]).toBeCloseTo(r[2]!, 9); // tied on VP → tied place
    const s = list(terminalRewards(finished([10, 6, 5, 2], 0)), 4);
    expect(s[1]).toBeGreaterThan(s[2]!);
  });

  it('no finish behind the winner is worth as much as winning, at any table size', () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const vps = Array.from({ length: n }, (_, i) => (i === 0 ? 10 : 9));
      const r = list(terminalRewards(finished(vps, 0)), n);
      for (let i = 1; i < n; i++) expect(r[0]! - r[i]!).toBeGreaterThan(DEFAULT_REWARD_WEIGHTS.win * 0.9);
    }
  });

  it('a step-capped match has no winner and costs every seat the truncation penalty', () => {
    const capped = list(terminalRewards(finished([8, 6, 6, 4], null)), 4);
    const open = list(terminalRewards(finished([8, 6, 6, 4], null), { ...DEFAULT_REWARD_WEIGHTS, truncation: 0 }), 4);
    capped.forEach((v, i) => expect(v).toBeCloseTo(open[i]! - DEFAULT_REWARD_WEIGHTS.truncation, 9));
    const won = list(terminalRewards(finished([10, 6, 6, 4], 0)), 4);
    expect(Math.max(...capped)).toBeLessThan(won[0]!);
  });

  it('the shaping potential is own true VP over the target', () => {
    expect(vpPotential(finished([7, 0, 0], null), 'p0', 0.2)).toBeCloseTo(0.14, 9);
  });
});
