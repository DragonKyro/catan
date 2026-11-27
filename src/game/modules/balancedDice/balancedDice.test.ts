import { describe, it, expect } from 'vitest';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { runSetupPhase } from '../../__testHelpers';
import type { BalancedDiceState, GameState } from '../../types';
import { ckAfterSetup } from '../citiesAndKnights/testSupport';
import { balancedDiceOdds, balancedDiceWeights, drawBalancedDice, initialBalancedDice } from '.';

const WAYS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
const ids = ['p0', 'p1'];
const odds = (bd: BalancedDiceState, roller = 'p0') => {
  const w = balancedDiceWeights(bd, roller, ids);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
};
const withCounts = (pairs: Record<number, number>, extra: Partial<BalancedDiceState> = {}): BalancedDiceState => {
  const counts = new Array<number>(13).fill(0);
  for (const [t, c] of Object.entries(pairs)) counts[Number(t)] = c;
  return { ...initialBalancedDice(), counts, ...extra };
};

describe('balanced dice odds', () => {
  it('start at the plain two-dice odds', () => {
    const p = odds(initialBalancedDice());
    for (let t = 2; t <= 12; t++) expect(p[t]).toBeCloseTo(WAYS[t]! / 36, 10);
  });

  it('make a number that came up too often rarer and an overdue one commoner', () => {
    // 12 rolls, roughly the expected mix but four 8s (1.7 expected) and no 6 (1.7 expected).
    const bd = withCounts({ 3: 1, 4: 1, 5: 1, 7: 2, 8: 4, 9: 1, 10: 1, 11: 1 });
    const p = odds(bd);
    expect(p[8]!).toBeLessThan(WAYS[8]! / 36);
    expect(p[6]!).toBeGreaterThan(WAYS[6]! / 36);
    // Never impossible.
    const flooded = odds(withCounts({ 12: 10 }));
    expect(flooded[12]!).toBeGreaterThan(0);
  });

  it('make a 7 rarer right after a 7, and rarer still after two', () => {
    const none = odds(withCounts({ 7: 2, 8: 2 }, { recent: [8, 8] }))[7]!;
    const one = odds(withCounts({ 7: 2, 8: 2 }, { recent: [8, 7] }))[7]!;
    const two = odds(withCounts({ 7: 2, 8: 2 }, { recent: [7, 7] }))[7]!;
    expect(one).toBeLessThan(none);
    expect(two).toBeLessThan(one);
  });

  it('give fewer 7s to the player who has rolled more of them', () => {
    const bd = withCounts({ 7: 4, 6: 2, 8: 2 }, { sevens: { p0: 3, p1: 1 } });
    expect(odds(bd, 'p0')[7]!).toBeLessThan(odds(bd, 'p1')[7]!);
  });

  it('keep a long run of rolls much closer to the expected counts than plain dice would', () => {
    let s = { ...createGame({ playerNames: ['A', 'B'], seed: 3, settings: { balancedDice: true } }) } as GameState;
    const n = 360;
    for (let i = 0; i < n; i++) {
      const d = drawBalancedDice(s, ids[i % 2]!);
      expect(d.dice[0]).toBeGreaterThanOrEqual(1);
      expect(d.dice[1]).toBeLessThanOrEqual(6);
      s = { ...s, rngState: d.rngState, balancedDice: d.balancedDice };
    }
    const counts = s.balancedDice!.counts;
    expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
    // Plain dice: a 7's count after 360 rolls has a standard deviation of ~7.
    for (let t = 2; t <= 12; t++) expect(Math.abs(counts[t]! - (n * WAYS[t]!) / 36)).toBeLessThan(5);
    // And the two players' 7s stay close.
    const sev = s.balancedDice!.sevens;
    expect(Math.abs((sev.p0 ?? 0) - (sev.p1 ?? 0))).toBeLessThanOrEqual(3);
  });
});

describe('balanced dice in the engine', () => {
  const game = () => runSetupPhase(createGame({
    playerNames: ['A', 'B', 'C'], seed: 9, randomizeTurnOrder: false, settings: { balancedDice: true },
  }));

  it('draws the roll from the game, ignoring the dice in the action, the same on every device', () => {
    const s = game();
    const a = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [1, 1] });
    const b = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [6, 6] });
    expect(a.lastRoll).toEqual(b.lastRoll);
    expect(a.rngState).toBe(b.rngState);
    const total = a.lastRoll!.total;
    expect(a.lastRoll!.dice[0] + a.lastRoll!.dice[1]).toBe(total);
    expect(a.balancedDice!.counts[total]).toBe(1);
    expect(a.balancedDice!.recent).toEqual([total]);
    if (total === 7) expect(a.balancedDice!.sevens.p0).toBe(1);
    // The odds a UI could show follow the history.
    expect(balancedDiceOdds(a, 'p1').reduce((x, y) => x + y, 0)).toBeCloseTo(1, 10);
  });

  it('leaves a refused roll untouched', () => {
    const s = game();
    expect(() => applyAction(s, { type: 'rollDice', playerId: 'p1', dice: [3, 4] })).toThrow();
    expect(s.balancedDice!.counts.every((c) => c === 0)).toBe(true);
  });

  it('works under Cities & Knights, and Alchemy\'s chosen dice pass through uncounted', () => {
    const base = ckAfterSetup(3, 11);
    const s: GameState = { ...base, settings: { ...base.settings, balancedDice: true }, balancedDice: initialBalancedDice() };
    const pid = s.playerOrder[s.currentPlayerIndex]!;
    const rolled = applyAction(s, { type: 'rollDice', playerId: pid, dice: [1, 1] });
    expect(rolled.balancedDice!.counts.reduce((a, b) => a + b, 0)).toBe(1);
    const alchemy = applyAction({ ...s, pendingAlchemy: [2, 3] }, { type: 'rollDice', playerId: pid, dice: [6, 6] });
    expect(alchemy.lastRoll!.dice).toEqual([2, 3]);
    expect(alchemy.balancedDice!.counts.every((c) => c === 0)).toBe(true);
  });

  it("can't be combined with Catan Event Cards (they replace the dice)", () => {
    expect(() => createGame({
      playerNames: ['A', 'B', 'C'], seed: 1, settings: { balancedDice: true, tradersVariants: { eventCards: true } },
    })).toThrow(/Event Cards/);
  });
});

describe('two players: a 7 only cuts hands of 10 or more', () => {
  it('9 cards are safe, 10 discard 5', () => {
    let s = runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42, randomizeTurnOrder: false }));
    s = {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        resources: p.id === 'p0' ? { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 1 } : { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 2 },
      })),
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('discard');
    expect(s.discardState!.required).toEqual({ p1: 5 });
  });
});
