import { describe, it, expect } from 'vitest';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { canConnectRoad, canPlaceSettlement } from '@/game/placement';
import { canAfford } from '@/game/resources';
import { nextRng } from '@/game/rng';
import type { Action, GameState, PlayerId } from '@/game/types';
import { COSTS, RESOURCES } from '@/game/types';
import { boardIndex } from './board';
import { sampleGames, type Sample } from './testSupport';
import { observe, type CatanDraft } from './observation';
import { ACTION_SPACE_VERSION, GLOBAL_SLOTS, decodeSlot, legalMask, slotForAction, slotLayout, slotNames } from './actions';
import { actWithPolicy } from './agent';
import { observeTransition, type CatanKnowledge } from './knowledge';

const SAMPLES: Sample[] = [
  ...sampleGames({ players: 4, games: 2, seed: 61, every: 4, maxSteps: 1500 }),
  ...sampleGames({ players: 3, games: 1, seed: 62, every: 5, maxSteps: 1500 }),
  ...sampleGames({ players: 6, games: 1, seed: 63, every: 6, maxSteps: 1500 }),
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    const [u, next] = nextRng(s);
    s = next;
    return u;
  };
}

/** Seats with something to decide in `state`. */
const deciders = (s: Sample) => s.state.players.filter((p) => observe(s.state, p.id, s.knowledge[p.id]!).decision !== null);

/** Follow drafts with random legal slots until an action comes out. */
function finish(state: GameState, id: PlayerId, k: CatanKnowledge, draft: CatanDraft, u: () => number): Action {
  for (;;) {
    const obs = observe(state, id, k, { draft });
    const mask = legalMask(obs);
    const legal = [...mask.keys()].filter((i) => mask[i]);
    expect(legal.length).toBeGreaterThan(0);
    const d = decodeSlot(obs, legal[Math.floor(u() * legal.length)]!);
    if (d.kind === 'action') return d.action;
    draft = d.draft;
  }
}

describe('catan action space', () => {
  it('has the versioned slot list (bump ACTION_SPACE_VERSION when it changes)', () => {
    const obs = observe(SAMPLES[0]!.state, 'p0', SAMPLES[0]!.knowledge.p0!);
    expect({ version: ACTION_SPACE_VERSION, globals: GLOBAL_SLOTS.length, total: slotLayout(obs).total })
      .toEqual({ version: 3, globals: 388, total: 533 });
    expect(new Set(slotNames(obs)).size).toBe(533);
  });

  it('v2 and v3 only appended slots: every older global keeps its index (upgrade_policy.py relies on it)', () => {
    // v1's 119 globals end at `reject`; the v2 offers follow, in shape order.
    expect(GLOBAL_SLOTS.indexOf('reject')).toBe(118);
    expect(GLOBAL_SLOTS.slice(0, 5)).toEqual(['roll', 'endTurn', 'buyDev', 'playKnight', 'playRoadBuilding']);
    expect(GLOBAL_SLOTS[45]).toBe('offer:1wood>1brick');
    expect(GLOBAL_SLOTS[104]).toBe('offer:1ore>2wheat');
    expect(GLOBAL_SLOTS[119]).toBe('offer:3wood>1brick');
    const v2 = GLOBAL_SLOTS.slice(119, 199);
    expect(v2.every((n) => /^offer:[1-3][a-z]+>[1-3][a-z]+$/.test(n))).toBe(true);
    expect(v2.map((n) => n.replace(/(\d)[a-z]+/g, '$1'))).toEqual(
      ['offer:3>1', 'offer:1>3', 'offer:3>2', 'offer:2>3'].flatMap((s) => Array(20).fill(s)),
    );
    // v3: the mixed offers (cards:kinds per side), then the partner picks.
    const shape = (n: string) => n.slice(6).split('>').map((side) => {
      const counts = [...side.matchAll(/(\d)[a-z]+/g)].map((m) => Number(m[1]));
      return `${counts.reduce((a, b) => a + b, 0)}:${counts.length}`;
    }).join('>');
    const v3 = GLOBAL_SLOTS.slice(199);
    expect(v3.slice(0, 180).map(shape)).toEqual([
      ...Array(30).fill('2:2>1:1'), ...Array(30).fill('1:1>2:2'), ...Array(60).fill('3:2>1:1'), ...Array(60).fill('1:1>3:2'),
    ]);
    expect(v3.slice(180)).toEqual(['pick:1', 'pick:2', 'pick:3', 'pick:4', 'pick:5', 'pick:6', 'pick:7', 'pick:none', 'counter']);
  });

  it('a policy that picks its own partner: pick:k trades with that acceptor, pick:none walks away', () => {
    const base = sampleGames({ players: 4, games: 1, seed: 71, every: 1, maxSteps: 400 })
      .find((s) => s.state.phase === 'main' && s.state.hasRolledThisTurn && !s.state.pendingTrade)!;
    let s = base.state;
    const me = s.playerOrder[s.currentPlayerIndex]!;
    const others = s.playerOrder.filter((id) => id !== me);
    // Stock the hands so the offer is payable both ways.
    s = { ...s, players: s.players.map((p) => ({ ...p, resources: { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 2 } })) };
    s = applyAction(s, { type: 'proposeTrade', playerId: me, give: { wood: 1 }, receive: { ore: 1 } });
    s = applyAction(s, { type: 'acceptTrade', playerId: others[1]! });
    const k = base.knowledge[me]!;
    expect(observe(s, me, k).decision).toBeNull(); // pre-v3 rules: the heuristic picks
    const obs = observe(s, me, k, { tradePick: true });
    expect(obs.decision?.type).toBe('tradePick');
    const mask = legalMask(obs, undefined, { tradePick: true, offerNeeds: false, counter: false });
    const G0 = slotLayout(obs).total - GLOBAL_SLOTS.length;
    const off = obs.players.find((p) => p.id === others[1])!.offset;
    expect([...mask.keys()].filter((i) => mask[i]).map((i) => GLOBAL_SLOTS[i - G0])).toEqual([`pick:${off}`, 'pick:none']);
    const pick = decodeSlot(obs, G0 + GLOBAL_SLOTS.indexOf(`pick:${off}`), undefined, mask);
    expect(pick).toEqual({ kind: 'action', action: { type: 'confirmTrade', playerId: me, with: others[1] } });
    expect(applyAction(s, (pick as { action: Action }).action).pendingTrade).toBeUndefined();
    expect(decodeSlot(obs, G0 + GLOBAL_SLOTS.indexOf('pick:none'), undefined, mask))
      .toEqual({ kind: 'action', action: { type: 'cancelTrade', playerId: me } });
    expect(slotForAction(obs, { type: 'confirmTrade', playerId: me, with: others[1]! })).toBe(G0 + GLOBAL_SLOTS.indexOf(`pick:${off}`));
    expect(slotForAction(obs, { type: 'cancelTrade', playerId: me })).toBe(G0 + GLOBAL_SLOTS.indexOf('pick:none'));
  });

  it('a policy that counters: the counter slot, then an offer slot as the counterTrade, once a turn', () => {
    const base = sampleGames({ players: 4, games: 1, seed: 72, every: 1, maxSteps: 400 })
      .find((s) => s.state.phase === 'main' && s.state.hasRolledThisTurn && !s.state.pendingTrade)!;
    let s: GameState = { ...base.state, players: base.state.players.map((p) => ({ ...p, resources: { wood: 3, brick: 3, sheep: 3, wheat: 3, ore: 3 } })) };
    const turn = s.playerOrder[s.currentPlayerIndex]!;
    const me = s.playerOrder.find((id) => id !== turn)!;
    let k: CatanKnowledge = { ...base.knowledge[me]!, hypotheses: [{ hands: s.players.flatMap(() => [3, 3, 3, 3, 3]), weight: 1 }] };
    const step = (action: Action) => {
      const next = applyAction(s, action);
      k = observeTransition(k, s, action, next);
      s = next;
    };
    const rules = { tradePick: false, offerNeeds: false, counter: true };
    const legal = (draft?: CatanDraft) => {
      const obs = observe(s, me, k, { draft });
      const mask = legalMask(obs, undefined, rules);
      const G0 = slotLayout(obs).total - GLOBAL_SLOTS.length;
      return { obs, mask, G0, names: [...mask.keys()].filter((i) => mask[i]).map((i) => GLOBAL_SLOTS[i - G0] ?? `board:${i}`) };
    };
    step({ type: 'proposeTrade', playerId: turn, give: { wood: 1 }, receive: { ore: 1 } });
    const plain = observe(s, me, k);
    const G = slotLayout(plain).total - GLOBAL_SLOTS.length;
    expect([...legalMask(plain).keys()].filter((i) => legalMask(plain)[i]).map((i) => GLOBAL_SLOTS[i - G])).toEqual(['accept', 'reject']); // pre-v3
    const answer = legal();
    expect(answer.names).toEqual(['accept', 'reject', 'counter']);
    const chose = decodeSlot(answer.obs, answer.G0 + GLOBAL_SLOTS.indexOf('counter'), undefined, answer.mask);
    expect(chose).toEqual({ kind: 'draft', draft: { counter: true } });
    const pick = legal({ counter: true });
    expect(pick.obs.decision?.type).toBe('counterOffer');
    expect(pick.names.length).toBeGreaterThan(0);
    expect(pick.names.every((n) => n.startsWith('offer:'))).toBe(true);
    expect(pick.names).not.toContain('offer:1ore>1wood'); // accepting as offered isn't a counter
    const first = pick.G0 + GLOBAL_SLOTS.indexOf(pick.names[0]!);
    const d = decodeSlot(pick.obs, first, undefined, pick.mask);
    expect(d.kind === 'action' && d.action.type).toBe('counterTrade');
    const counter = (d as { action: Action }).action;
    expect(slotForAction(answer.obs, counter)).toBe(answer.G0 + GLOBAL_SLOTS.indexOf('counter'));
    expect(slotForAction(pick.obs, counter)).toBe(first);
    step(counter);
    expect(s.pendingTrade?.proposerId).toBe(me);
    // The turn player walks away; a second offer this turn can't be countered again.
    step({ type: 'cancelTrade', playerId: turn });
    step({ type: 'proposeTrade', playerId: turn, give: { brick: 1 }, receive: { sheep: 1 } });
    expect(legal().names).toEqual(['accept', 'reject']);
  });

  it('offerNeeds only removes offers (never adds one) and keeps every non-offer slot', () => {
    let removed = 0;
    for (const s of SAMPLES) {
      for (const p of deciders(s)) {
        const obs = observe(s.state, p.id, s.knowledge[p.id]!);
        if (obs.decision?.type !== 'main') continue;
        const plain = legalMask(obs);
        const keen = legalMask(obs, undefined, { tradePick: false, offerNeeds: true, counter: false });
        const G0 = slotLayout(obs).total - GLOBAL_SLOTS.length;
        keen.forEach((on, i) => {
          if (on) expect(plain[i]).toBe(1);
          if (plain[i] && !on) {
            expect(GLOBAL_SLOTS[i - G0]).toMatch(/^offer:/);
            removed++;
          }
        });
      }
    }
    expect(removed).toBeGreaterThan(0);
  });

  it('offers no player trade the bank or a harbor gives at the same or a better rate', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      const state = s.state;
      if (state.phase !== 'main' || state.pendingTrade || !state.hasRolledThisTurn) continue;
      const id = getActingPlayerId(state);
      const obs = observe(state, id, s.knowledge[id]!);
      if (!obs.decision || obs.decision.type !== 'main' || !obs.decision.playerTrades) continue;
      // Every opponent might hold anything; give the viewer plenty, a 2:1 wood
      // harbor and the generic 3:1 one, so only the bank rule can mask offers.
      const me = obs.players[0]!;
      me.hand = { wood: 4, brick: 4, sheep: 4, wheat: 4, ore: 4 };
      me.ports = ['wood', 'generic'];
      for (const p of obs.players.slice(1)) p.estimate = { ...p.estimate, atLeast1: [1, 1, 1, 1, 1], atLeast2: [1, 1, 1, 1, 1] };
      obs.bank = { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 };
      obs.tradesProposedThisTurn = 0;
      obs.offeredThisTurn = [];
      const mask = legalMask(obs);
      const G0 = slotLayout(obs).total - GLOBAL_SLOTS.length;
      const on = (name: string) => mask[G0 + GLOBAL_SLOTS.indexOf(name)];
      expect(on('offer:1wood>1brick')).toBe(1);
      expect(on('offer:2wood>1brick')).toBe(0); // the wood harbor does 2:1
      expect(on('offer:3wood>1brick')).toBe(0);
      expect(on('offer:3wood>2brick')).toBe(1); // the harbor would want 4 wood for 2 brick
      expect(on('offer:2brick>1wood')).toBe(1); // brick goes at 3:1
      expect(on('offer:3brick>1wood')).toBe(0); // ... which the 3:1 harbor does
      expect(on('offer:1brick>3wood')).toBe(1);
      expect(on('offer:2brick>3wood')).toBe(1);
      checked++;
      if (checked >= 5) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('every legal slot decodes to something the engine accepts', () => {
    const u = rng(5);
    let tried = 0;
    const kinds = new Set<string>();
    for (const s of SAMPLES) {
      for (const p of deciders(s)) {
        const k = s.knowledge[p.id]!;
        const obs = observe(s.state, p.id, k);
        const mask = legalMask(obs);
        for (let slot = 0; slot < mask.length; slot++) {
          if (!mask[slot]) continue;
          const d = decodeSlot(obs, slot);
          const action = d.kind === 'action' ? d.action : finish(s.state, p.id, k, d.draft, u);
          expect(() => applyAction(s.state, action), `${obs.decision!.type} → ${JSON.stringify(action)}`).not.toThrow();
          kinds.add(action.type);
          tried++;
        }
      }
    }
    expect(tried).toBeGreaterThan(2000);
    for (const t of ['placeInitialSettlement', 'placeInitialRoad', 'rollDice', 'buildRoad', 'buildSettlement', 'bankTrade',
      'endTurn', 'discard', 'moveRobber', 'proposeTrade', 'acceptTrade', 'rejectTrade']) {
      expect(kinds).toContain(t);
    }
  });

  it('slotForAction inverts decodeSlot', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      for (const p of deciders(s)) {
        const obs = observe(s.state, p.id, s.knowledge[p.id]!);
        const mask = legalMask(obs);
        for (let slot = 0; slot < mask.length; slot++) {
          if (!mask[slot]) continue;
          const d = decodeSlot(obs, slot);
          if (d.kind !== 'action') continue;
          expect(slotForAction(obs, d.action), JSON.stringify(d.action)).toBe(slot);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it('masks in every build, bank trade and year of plenty the engine allows', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      const state = s.state;
      if (state.phase !== 'main' || state.pendingTrade) continue;
      const id = getActingPlayerId(state);
      const me = state.players.find((p) => p.id === id)!;
      const obs = observe(state, id, s.knowledge[id]!);
      const mask = legalMask(obs);
      const L = slotLayout(obs);
      const idx = boardIndex(state.board);
      const ok = (a: Action) => { try { applyAction(state, a); return true; } catch { return false; } };
      idx.vertexIds.forEach((v, i) => {
        const settle = canAfford(me.resources, COSTS.settlement) && me.settlements.length < 5 && canPlaceSettlement(state, id, v);
        const city = canAfford(me.resources, COSTS.city) && me.cities.length < 4 && me.settlements.includes(v);
        expect(mask[i]).toBe(settle || city ? 1 : 0);
      });
      idx.edgeIds.forEach((e, i) => {
        const road = canAfford(me.resources, COSTS.road) && me.roads.length < 15 && canConnectRoad(state, id, e);
        expect(mask[L.vertices + i]).toBe(road ? 1 : 0);
      });
      const G0 = L.vertices + L.edges + L.hexes;
      GLOBAL_SLOTS.forEach((name, i) => {
        let action: Action | null = null;
        if (name.startsWith('bank:')) {
          const [give, receive] = name.slice(5).split('>') as [never, never];
          action = { type: 'bankTrade', playerId: id, give, receive };
        } else if (name.startsWith('yearOfPlenty:')) {
          action = { type: 'playYearOfPlenty', playerId: id, resources: name.slice(13).split('+') as [never, never] };
        } else if (name === 'buyDev') action = { type: 'buyDevCard', playerId: id };
        else if (name === 'endTurn') action = { type: 'endTurn', playerId: id };
        if (action) expect(mask[G0 + i], name).toBe(ok(action) ? 1 : 0);
      });
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('a discard is one card at a time and comes out at exactly the required count', () => {
    const u = rng(9);
    let checked = 0;
    for (const s of SAMPLES.filter((x) => x.state.phase === 'discard')) {
      for (const id of Object.keys(s.state.discardState!.required)) {
        const k = s.knowledge[id]!;
        const obs = observe(s.state, id, k);
        expect(obs.decision?.type).toBe('discard');
        const mask = legalMask(obs);
        const hand = s.state.players.find((p) => p.id === id)!.resources;
        for (const r of RESOURCES) {
          expect(mask[mask.length - GLOBAL_SLOTS.length + GLOBAL_SLOTS.indexOf(`discard:${r}`)]).toBe(hand[r] > 0 ? 1 : 0);
        }
        const action = finish(s.state, id, k, {}, u);
        expect(action.type).toBe('discard');
        if (action.type === 'discard') {
          expect(RESOURCES.reduce((n, r) => n + (action.resources[r] ?? 0), 0)).toBe(s.state.discardState!.required[id]);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('a random policy plays whole turns through actWithPolicy', () => {
    const u = rng(21);
    const random = (_f: unknown, mask: Uint8Array) => {
      const legal = [...mask.keys()].filter((i) => mask[i]);
      return legal[Math.floor(u() * legal.length)]!;
    };
    let acted = 0;
    for (const s of SAMPLES.slice(0, 80)) {
      for (const p of deciders(s)) {
        const action = actWithPolicy(s.state, p.id, s.knowledge[p.id]!, random);
        expect(action).not.toBeNull();
        expect(() => applyAction(s.state, action!)).not.toThrow();
        acted++;
      }
    }
    expect(acted).toBeGreaterThan(60);
  });
});
