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
import type { CatanKnowledge } from './knowledge';

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
      .toEqual({ version: 2, globals: 199, total: 344 });
    expect(new Set(slotNames(obs)).size).toBe(344);
  });

  it('v2 only appended slots: every v1 global keeps its index (upgrade_policy.py relies on it)', () => {
    // v1's 119 globals end at `reject`; the v2 offers follow, in shape order.
    expect(GLOBAL_SLOTS.indexOf('reject')).toBe(118);
    expect(GLOBAL_SLOTS.slice(0, 5)).toEqual(['roll', 'endTurn', 'buyDev', 'playKnight', 'playRoadBuilding']);
    expect(GLOBAL_SLOTS[45]).toBe('offer:1wood>1brick');
    expect(GLOBAL_SLOTS[104]).toBe('offer:1ore>2wheat');
    expect(GLOBAL_SLOTS[119]).toBe('offer:3wood>1brick');
    expect(GLOBAL_SLOTS.slice(119).every((n) => /^offer:[1-3][a-z]+>[1-3][a-z]+$/.test(n))).toBe(true);
    expect(GLOBAL_SLOTS.slice(119).map((n) => n.replace(/(\d)[a-z]+/g, '$1'))).toEqual(
      ['offer:3>1', 'offer:1>3', 'offer:3>2', 'offer:2>3'].flatMap((s) => Array(20).fill(s)),
    );
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
