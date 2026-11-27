import { describe, it, expect } from 'vitest';
import { applyAction } from '@/game/engine';
import type { GameState } from '@/game/types';
import { analyseBoard } from './encode';
import { observeTransition } from './knowledge';
import { observe } from './observation';
import { createGame } from '@/game/createGame';
import { initialKnowledge } from './knowledge';
import {
  DIST_FAR, NEAR_TURNS, NEVER, PLAN_OPTIONS, buildGains, cornerRaces, openingOutlook, opponentTargets, seatPlans, trueLeader,
} from './plan';
import { sampleGames, type Sample } from './testSupport';

const SAMPLES: Sample[] = [
  ...sampleGames({ players: 4, games: 2, seed: 81, every: 6, maxSteps: 1500 }),
  ...sampleGames({ players: 3, games: 1, seed: 82, every: 8, maxSteps: 1500 }),
];

describe('seat plans (how close each seat is to winning)', () => {
  it('stay in range for every sampled state and seat', () => {
    for (const s of SAMPLES) {
      for (const p of s.state.players) {
        const obs = observe(s.state, p.id, s.knowledge[p.id]!);
        const b = analyseBoard(obs);
        const plans = seatPlans(obs, b);
        expect(plans).toHaveLength(obs.playerCount);
        plans.forEach((plan, k) => {
          expect(plan.options).toHaveLength(PLAN_OPTIONS.length);
          for (const o of plan.options) {
            expect(o).toBeGreaterThanOrEqual(plan.delay - 1e-9);
            expect(o).toBeLessThanOrEqual(NEVER);
          }
          expect(plan.eta).toBeGreaterThanOrEqual(plan.delay - 1e-9);
          expect(plan.eta).toBeLessThanOrEqual(40);
          expect(plan.soon).toBeGreaterThanOrEqual(0);
          expect(plan.soon).toBeLessThanOrEqual(1 + 1e-9);
          expect(plan.permVp).toBe(obs.players[k]!.settlements.length + 2 * obs.players[k]!.cities.length);
          if (k > 0) expect(plan.expVp).toBeGreaterThanOrEqual(obs.players[k]!.publicVp - 1e-9);
        });
        const leader = trueLeader(plans);
        expect(leader === -1 || (leader >= 1 && leader < plans.length)).toBe(true);
        const races = cornerRaces(b, plans);
        races.forEach((m, v) => { if (!Number.isNaN(m)) expect(b.open[v]).toBe(1); });
      }
    }
  });

  it('a city in hand on its own turn is no turns away, and a nearer target means a lower eta', () => {
    const s0 = SAMPLES.find((s) => s.state.phase === 'main' && s.state.hasRolledThisTurn
      && s.state.players.find((p) => p.id === s.state.playerOrder[s.state.currentPlayerIndex])!.settlements.length > 0)!;
    const me = s0.state.playerOrder[s0.state.currentPlayerIndex]!;
    const k = s0.knowledge[me]!;
    const withHand = (st: GameState, hand: Record<string, number>): GameState => ({
      ...st,
      players: st.players.map((p) => (p.id === me ? { ...p, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, ...hand } } : p)),
    });
    const plan = (st: GameState) => {
      const obs = observe(st, me, k);
      return seatPlans(obs, analyseBoard(obs))[0]!;
    };
    const rich = plan(withHand(s0.state, { wheat: 2, ore: 3 }));
    const broke = plan(withHand(s0.state, {}));
    expect(rich.options[PLAN_OPTIONS.indexOf('city')]).toBe(0);
    expect(broke.options[PLAN_OPTIONS.indexOf('city')]).toBeGreaterThan(0);
    expect(rich.eta).toBeLessThanOrEqual(broke.eta);
    const near = plan({ ...withHand(s0.state, {}), settings: { ...s0.state.settings, victoryPointsToWin: 6 } });
    const far = plan({ ...withHand(s0.state, {}), settings: { ...s0.state.settings, victoryPointsToWin: 14 } });
    expect(near.eta).toBeLessThan(far.eta);
  });
});

describe('win plans (every minimal way to the target)', () => {
  it('are consistent for every sampled state and seat', () => {
    for (const s of SAMPLES) {
      if (s.state.phase !== 'main') continue;
      for (const p of s.state.players) {
        const obs = observe(s.state, p.id, s.knowledge[p.id]!);
        seatPlans(obs, analyseBoard(obs)).forEach((plan, k) => {
          const wp = plan.plans;
          expect(wp.best).toBeLessThanOrEqual(wp.second);
          expect(wp.best).toBeLessThanOrEqual(NEVER);
          if (wp.best < NEVER) expect(wp.near).toBeGreaterThanOrEqual(1);
          for (const x of wp.share) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(1);
          }
          if (wp.best < NEVER && wp.best > plan.delay) {
            // The best plan's parts reach the target from the seat's points.
            const [sett, city, vp, lr, la] = wp.bestMix as [number, number, number, number, number];
            expect(sett + city + vp + 2 * lr + 2 * la).toBeGreaterThanOrEqual(Math.ceil(obs.vpToWin - plan.expVp - 1e-9));
            if (lr) expect(obs.players[k]!.hasLongestRoad).toBe(false);
            if (la) expect(obs.players[k]!.hasLargestArmy).toBe(false);
          }
        });
      }
    }
  });

  it('with nowhere left to settle, no plan builds settlements and cities carry it', () => {
    const s0 = SAMPLES.find((s) => s.state.phase === 'main' && s.state.hasRolledThisTurn
      && s.state.players.find((p) => p.id === s.state.playerOrder[s.state.currentPlayerIndex])!.settlements.length >= 2)!;
    const me = s0.state.playerOrder[s0.state.currentPlayerIndex]!;
    const obs = observe(s0.state, me, s0.knowledge[me]!);
    const b = analyseBoard(obs);
    const boxed = { ...b, open: new Uint8Array(b.open.length) }; // every corner taken
    const wp = seatPlans(obs, boxed)[0]!.plans;
    expect(wp.bestMix[0]).toBe(0);
    expect(wp.share[PLAN_OPTIONS.indexOf('settlement')]).toBe(0);
    if (wp.best < NEVER) expect(wp.share[PLAN_OPTIONS.indexOf('city')]).toBeGreaterThan(0);
    expect(NEAR_TURNS).toBeGreaterThan(0);
  });
});

describe('build speedups (turns each build saves the best win plan)', () => {
  it('exist only for the viewer\'s possible builds, on its own build decisions', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      for (const p of s.state.players) {
        const obs = observe(s.state, p.id, s.knowledge[p.id]!);
        const b = analyseBoard(obs);
        const g = buildGains(obs, b, seatPlans(obs, b));
        const type = obs.decision?.type;
        if (type !== 'main' && type !== 'roadBuilding') {
          expect(g.vertex.every(Number.isNaN)).toBe(true);
          expect(g.edge.every(Number.isNaN)).toBe(true);
          continue;
        }
        checked++;
        const mine = new Set(obs.players[0]!.settlements.map((id) => b.idx.vertexIndex.get(id)!));
        g.vertex.forEach((x, v) => {
          if (Number.isNaN(x)) return;
          expect(Number.isFinite(x)).toBe(true);
          expect((b.open[v] === 1 && b.dist[0]![v]! < DIST_FAR) || mine.has(v)).toBe(true);
          expect(Math.abs(x)).toBeLessThanOrEqual(40);
        });
        g.edge.forEach((x, e) => { if (!Number.isNaN(x)) expect(b.canRoad[e]).toBe(1); });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a city on a richer corner saves at least as much as on a poorer one', () => {
    let compared = 0;
    for (const s of SAMPLES) {
      if (s.state.phase !== 'main' || !s.state.hasRolledThisTurn) continue;
      const me = s.state.playerOrder[s.state.currentPlayerIndex]!;
      const obs = observe(s.state, me, s.knowledge[me]!);
      if (obs.decision?.type !== 'main' || obs.players[0]!.settlements.length < 2 || obs.players[0]!.cities.length >= 4) continue;
      const b = analyseBoard(obs);
      const g = buildGains(obs, b, seatPlans(obs, b));
      const robbed = (v: number) => [0, 1, 2].some((j) => b.idx.vertexHexes[v * 3 + j] === b.robberHex);
      // Same cost, more income afterwards: compare corners whose production dominates resource by resource.
      const sett = obs.players[0]!.settlements.map((id) => b.idx.vertexIndex.get(id)!).filter((v) => !robbed(v));
      const pipsAt = (v: number) => Array.from(b.vertexPips.subarray(v * 5, v * 5 + 5));
      for (const a of sett) {
        for (const c of sett) {
          const pa = pipsAt(a);
          const pc = pipsAt(c);
          if (a === c || !pa.every((x, r) => x >= pc[r]!)) continue;
          expect(g.vertex[a]!).toBeGreaterThanOrEqual(g.vertex[c]! - 1e-6);
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(0);
  });
});

describe('opponents\' next settlements', () => {
  it('are a chance on open corners, and nothing in the opening', () => {
    for (const s of SAMPLES) {
      const p = s.state.players[0]!;
      const obs = observe(s.state, p.id, s.knowledge[p.id]!);
      const b = analyseBoard(obs);
      const t = opponentTargets(obs, b, seatPlans(obs, b));
      const setup = obs.decision?.type === 'setupSettlement' || obs.decision?.type === 'setupRoad';
      t.chance.forEach((c, v) => {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1 + 1e-6);
        if (c > 0) {
          expect(setup).toBe(false);
          expect(b.open[v]).toBe(1);
          expect(t.turns[v]).toBeLessThan(NEVER);
        }
      });
    }
  });
});

describe('the opening outlook (second settlement)', () => {
  const fresh = (players: number) => createGame({
    playerNames: Array.from({ length: players }, (_, i) => `P${i}`),
    playerTypes: Array.from({ length: players }, () => 'ai' as const),
    seed: 5,
    randomizeTurnOrder: false,
  });
  const pipsOf = (b: ReturnType<typeof analyseBoard>, v: number) =>
    b.vertexPips.subarray(v * 5, v * 5 + 5).reduce((a, c) => a + c, 0);

  it('the first player expects fewer corners left than are open now, the best ones gone first', () => {
    const st = fresh(4);
    const me = st.playerOrder[0]!;
    const obs = observe(st, me, initialKnowledge(st, me));
    const b = analyseBoard(obs);
    const o = openingOutlook(obs, b)!;
    expect(o).not.toBeNull();
    let open = 0;
    let left = 0;
    o.secondOpen.forEach((a, v) => {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(b.open[v]! + 1e-6);
      open += b.open[v]!;
      left += a;
    });
    // Six opponent picks before its second, each taking a corner and blocking its neighbours.
    expect(left).toBeLessThan(open - 6);
    const vs = [...Array(b.open.length).keys()].filter((v) => b.open[v] === 1);
    const best = vs.reduce((a, c) => (pipsOf(b, c) > pipsOf(b, a) ? c : a));
    const worst = vs.reduce((a, c) => (pipsOf(b, c) < pipsOf(b, a) ? c : a));
    expect(o.secondOpen[best]!).toBeLessThan(o.secondOpen[worst]!);
    o.pairBest.forEach((x, v) => {
      if (b.open[v] === 1) expect(x).toBeGreaterThan(0);
      else expect(Number.isNaN(x)).toBe(true);
    });
  });

  it('the last player in round 1 places its second at once: everything open stays open', () => {
    let st = fresh(3);
    for (let i = 0; i < 2; i++) {
      const pid = st.playerOrder[i]!;
      const obs = observe(st, pid, initialKnowledge(st, pid));
      const b = analyseBoard(obs);
      const v = b.idx.vertexIds[[...b.canSettle.keys()].find((x) => b.canSettle[x] === 1)!]!;
      st = applyAction(st, { type: 'placeInitialSettlement', playerId: pid, vertex: v });
      const rb = analyseBoard(observe(st, pid, initialKnowledge(st, pid)));
      const e = rb.idx.edgeIds[[...rb.canRoad.keys()].find((x) => rb.canRoad[x] === 1)!]!;
      st = applyAction(st, { type: 'placeInitialRoad', playerId: pid, edge: e });
    }
    const me = st.playerOrder[2]!;
    const obs = observe(st, me, initialKnowledge(st, me));
    expect(obs.decision).toMatchObject({ type: 'setupSettlement', round: 1 });
    const b = analyseBoard(obs);
    const o = openingOutlook(obs, b)!;
    o.secondOpen.forEach((a, v) => expect(a).toBe(b.open[v]));
  });

  it('is null outside the opening', () => {
    const s = SAMPLES.find((x) => x.state.phase === 'main')!;
    const p = s.state.players[0]!;
    const obs = observe(s.state, p.id, s.knowledge[p.id]!);
    expect(openingOutlook(obs, analyseBoard(obs))).toBeNull();
  });
});

describe('this turn\'s offers', () => {
  it('records each offer and who said yes / no, and forgets them when the turn ends', () => {
    const s0 = SAMPLES.find((s) => s.state.phase === 'main' && s.state.hasRolledThisTurn && !s.state.pendingTrade)!;
    const me = s0.state.playerOrder[s0.state.currentPlayerIndex]!;
    const [a, b, c] = s0.state.playerOrder.filter((id) => id !== me);
    let s: GameState = { ...s0.state, players: s0.state.players.map((p) => ({ ...p, resources: { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 2 } })) };
    let k = s0.knowledge[me]!;
    // The knowledge must see the hands we just gave: fold a fresh history instead of patching hypotheses.
    const step = (action: Parameters<typeof applyAction>[1]) => {
      const next = applyAction(s, action);
      k = observeTransition(k, s, action, next);
      s = next;
    };
    k = { ...k, hypotheses: [{ hands: s.players.flatMap(() => [2, 2, 2, 2, 2]), weight: 1 }] };
    step({ type: 'proposeTrade', playerId: me, give: { wood: 1 }, receive: { ore: 1 } });
    step({ type: 'rejectTrade', playerId: a! });
    step({ type: 'acceptTrade', playerId: b! });
    if (c) step({ type: 'rejectTrade', playerId: c });
    step({ type: 'confirmTrade', playerId: me, with: b! });
    const obs = observe(s, me, k);
    const off = (id: string) => obs.players.find((p) => p.id === id)!.offset;
    expect(obs.turnOffers).toHaveLength(1);
    expect(obs.turnOffers[0]).toMatchObject({
      proposerOffset: 0, accepted: [off(b!)], tradedWithOffset: off(b!),
      give: { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 }, receive: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 1 },
    });
    expect(obs.turnOffers[0]!.rejected.sort()).toEqual([off(a!), ...(c ? [off(c)] : [])].sort());
    step({ type: 'endTurn', playerId: me });
    expect(k.turnOffers).toEqual([]);
  });
});
