import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import type { Action, GameState, PlayerId, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { playGame } from './testSupport';
import {
  estimateHands, initialKnowledge, knowledgeFromHistory, observeTransition, type CatanKnowledge,
} from './knowledge';

const R = RESOURCES.length;
const handsOf = (s: GameState, k: CatanKnowledge) =>
  k.playerIds.flatMap((id) => RESOURCES.map((r) => s.players.find((p) => p.id === id)!.resources[r]));

describe('knowledge tracks what a card counter could know', () => {
  for (const players of [3, 4, 6]) {
    it(`never rules out the true hands, and matches every public hand size (${players}p)`, () => {
      let checked = 0;
      let branched = 0;
      for (const seed of [1, 2]) {
        playGame({ players, seed }, (_before, _action, after, knowledge) => {
          for (const k of Object.values(knowledge)) {
            expect(k.repairs).toBe(0);
            expect(k.dropped).toBe(0);
            const truth = handsOf(after, k).join(',');
            expect(k.hypotheses.some((h) => h.hands.join(',') === truth)).toBe(true);
            const total = k.hypotheses.reduce((s, h) => s + h.weight, 0);
            expect(total).toBeCloseTo(1, 9);
            for (const h of k.hypotheses) {
              k.playerIds.forEach((id, seat) => {
                const size = RESOURCES.reduce((s, r) => s + after.players.find((p) => p.id === id)!.resources[r], 0);
                expect(h.hands.slice(seat * R, seat * R + R).reduce((a, b) => a + b, 0)).toBe(size);
              });
            }
            if (k.hypotheses.length > 1) branched++;
            checked++;
          }
        });
      }
      expect(checked).toBeGreaterThan(500);
      // Guard against a vacuous pass: hidden steals really did leave doubt.
      expect(branched).toBeGreaterThan(0);
    });
  }

  it('the viewer\'s own hand is always exact, and a steal is hidden only from bystanders', () => {
    let steals = 0;
    let prev: Record<PlayerId, CatanKnowledge> | null = null;
    playGame({ players: 4, seed: 5 }, (_before, action, after, knowledge) => {
      for (const [id, k] of Object.entries(knowledge)) {
        const own = estimateHands(k)[k.playerIds.indexOf(id)]!;
        expect(own.certainty).toBeCloseTo(1, 9);
        RESOURCES.forEach((r, i) => expect(own.mean[i]).toBeCloseTo(after.players.find((p) => p.id === id)!.resources[r], 9));
      }
      if (prev && action.type === 'moveRobber' && action.stealFrom !== null) {
        steals++;
        for (const [id, k] of Object.entries(knowledge)) {
          const involved = id === action.playerId || id === action.stealFrom;
          expect(k.hiddenSteals).toBe(prev[id]!.hiddenSteals + (involved ? 0 : 1));
          if (involved) expect(k.hypotheses.length).toBeLessThanOrEqual(prev[id]!.hypotheses.length);
        }
      }
      prev = knowledge;
    });
    expect(steals).toBeGreaterThan(0);
  });

  it('replaying the log gives the same knowledge as folding it in step by step', () => {
    const actions: Action[] = [];
    let initial: GameState | null = null;
    const run = playGame({ players: 4, seed: 9 }, (before, action) => {
      initial ??= before;
      actions.push(action);
    });
    for (const id of Object.keys(run.knowledge)) {
      expect(knowledgeFromHistory(initial!, actions, id)).toEqual(run.knowledge[id]);
    }
  });

  it('refuses to start mid-game', () => {
    const run = playGame({ players: 3, seed: 3, maxSteps: 40 });
    expect(() => initialKnowledge(run.final, 'p0')).toThrow(/game creation/);
  });
});

describe('knowledge: a hidden steal and what collapses it', () => {
  // p0 watches p2 steal from p1, who holds 2 wood + 1 ore (known to all).
  const base = createGame({ playerNames: ['p0', 'p1', 'p2'], seed: 1, randomizeTurnOrder: false });
  const withHands = (s: GameState, hands: Record<PlayerId, Partial<ResourceBank>>): GameState => ({
    ...s,
    players: s.players.map((p) => ({ ...p, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, ...hands[p.id] } })),
  });
  const k0 = initialKnowledge(base, 'p0');
  const dealt = withHands(base, { p1: { wood: 2, ore: 1 } });
  const k1 = observeTransition(k0, base, { type: 'rollDice', playerId: 'p1', dice: [3, 4] }, dealt);
  const stoleWood = withHands(base, { p1: { wood: 1, ore: 1 }, p2: { wood: 1 } });
  const steal: Action = { type: 'moveRobber', playerId: 'p2', hex: base.board.hexIds[0]!, stealFrom: 'p1' };
  const k2 = observeTransition(k1, dealt, steal, stoleWood);
  const p2 = (k: CatanKnowledge) => estimateHands(k)[2]!;

  it('branches by what the victim could have lost, weighted by how many they held', () => {
    expect(k1.hypotheses).toHaveLength(1);
    expect(k2.hypotheses).toHaveLength(2);
    expect(k2.hiddenSteals).toBe(1);
    expect(p2(k2).mean[RESOURCES.indexOf('wood')]).toBeCloseTo(2 / 3, 9);
    expect(p2(k2).mean[RESOURCES.indexOf('ore')]).toBeCloseTo(1 / 3, 9);
    expect(p2(k2).certainty).toBeCloseTo(2 / 3, 9);
  });

  it('is exact for the thief and the victim', () => {
    for (const viewer of ['p1', 'p2']) {
      let k = initialKnowledge(base, viewer);
      k = observeTransition(k, base, { type: 'rollDice', playerId: 'p1', dice: [3, 4] }, dealt);
      k = observeTransition(k, dealt, steal, stoleWood);
      expect(k.hypotheses).toHaveLength(1);
      expect(k.hiddenSteals).toBe(0);
    }
  });

  it('a public spend the other branch can\'t afford collapses it', () => {
    const spent = withHands(base, { p1: { wood: 1, ore: 1 } });
    const k3 = observeTransition(k2, stoleWood, { type: 'bankTrade', playerId: 'p2', give: 'wood', receive: 'ore' }, spent);
    expect(k3.hypotheses).toHaveLength(1);
    expect(estimateHands(k3)[1]!.mean).toEqual([1, 0, 0, 0, 1]);
  });

  it('a trade offer shows the offerer holds what they offer', () => {
    const k3 = observeTransition(k2, stoleWood, { type: 'proposeTrade', playerId: 'p2', give: { wood: 1 }, receive: { ore: 1 } }, stoleWood);
    expect(k3.hypotheses).toHaveLength(1);
    expect(p2(k3).mean[RESOURCES.indexOf('wood')]).toBe(1);
  });

  it('a monopoly reveals every victim\'s exact count', () => {
    // p0 doubts whether p1 holds 2 wood or wood + ore. A wood monopoly takes
    // just 1 from p1 — fine for either guess on its own, but p1 must now
    // hold no wood, which only wood + ore leaves true.
    const doubt: CatanKnowledge = {
      ...k0,
      hypotheses: [
        { hands: [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0], weight: 0.5 },
        { hands: [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], weight: 0.5 },
      ],
    };
    const before = withHands(base, { p1: { wood: 1, ore: 1 } });
    const after = withHands(base, { p0: { wood: 1 }, p1: { ore: 1 } });
    const k3 = observeTransition(doubt, before, { type: 'playMonopoly', playerId: 'p0', resource: 'wood' }, after);
    expect(k3.hypotheses).toHaveLength(1);
    expect(estimateHands(k3)[1]!.mean).toEqual([0, 0, 0, 0, 1]);
    expect(k3.devPlayed[0]!.monopoly).toBe(1);
  });

  it('records rolls and dev-card buys and plays', () => {
    let s = base;
    let k = initialKnowledge(s, 'p0');
    const act = (a: Action, after: GameState) => {
      k = observeTransition(k, s, a, after);
      s = after;
    };
    act({ type: 'rollDice', playerId: 'p0', dice: [2, 3] }, { ...s, lastRoll: { dice: [2, 3], total: 5, player: 'p0' } });
    act({ type: 'buyDevCard', playerId: 'p1' }, s);
    act({ type: 'playKnight', playerId: 'p2' }, s);
    expect(k.rolls).toEqual([5]);
    expect(k.devBought).toEqual([0, 1, 0]);
    expect(k.devPlayed[2]!.knight).toBe(1);
  });
});
