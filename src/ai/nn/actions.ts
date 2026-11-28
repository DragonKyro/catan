// Catan learned agent — action space v3: a fixed slot list over the board plus
// a global block, the legality mask, and the decoder from slot to reducer
// action.
//
// Slots are board-relative, entities in board.ts order, so a graph network's
// per-entity logits line up with them directly:
//
//   [0, V)            vertex   setup settlement / build a settlement / upgrade own settlement to a city
//   [V, V+E)          edge     setup road / road / the next Road Building road
//   [V+E, V+E+H)      hex      move the robber here
//   [V+E+H, +G)       global   GLOBAL_SLOTS below
//
// At 4 players that is 54 + 72 + 19 + 388 = 533 slots.
//
// Multi-part answers are one decision per part, carried in a CatanDraft
// (never game state): a discard is one card at a time until the required
// count is chosen; the robber is its hex, then — if two or more seats could
// be robbed — the victim (one candidate is robbed automatically, as the rules
// require); Road Building is the card, then each road (finishing by itself
// when no second road fits).
//
// Player trades are offers from a fixed menu — 1:1, 2:1, 1:2 (v1) and 3:1,
// 1:3, 3:2, 2:3 (v2) between any two resources, and mixed ones (v3): two
// kinds for one (1+1 for 1, 2+1 for 1) and one for two kinds (1 for 1+1,
// 1 for 2+1). At most MAX_OFFERS_PER_TURN a turn, never the same offer twice
// in a turn, only when some opponent could hold what's asked, and never one
// the bank or a harbor already gives at the same or a better rate (the give
// side's cards, at the viewer's rates, would buy the whole ask). Counter-offers
// aren't in the space; an offer is answered accept / reject.
//
// Rules a policy plays by (PolicyRules, read from its file's meta.rules; off
// for policies trained before v3, which then play exactly as they did):
//   tradePick   when its own offer has a yes, it picks the partner (pick:k,
//               a seat offset) or walks away (pick:none); otherwise the
//               heuristic picks for it.
//   offerNeeds  an offer must also give some opponent that could pay a card
//               it's short of for a build it's close to — offers likely to
//               be taken, not spam.
//   counter     answering the turn player's offer, it may counter: the
//               `counter` slot (next to accept / reject, so a policy can learn
//               how often to counter on its own), then — a `counterOffer`
//               decision — an offer from the same menu (the offer slots, as a
//               counterTrade). At most MAX_COUNTERS_PER_TURN a turn (and
//               none once the AI seats together have made
//               MAX_AI_COUNTERS_PER_TURN, src/ai/counterLimits.ts), never one
//               that is just the offer accepted, one the bank or a harbor
//               gives as well, or one the offerer couldn't pay (or, with
//               offerNeeds, has no use for). The turn player's yes / no to a
//               counter is the ordinary counter answer (accept / reject).
//
// Bump ACTION_SPACE_VERSION whenever slots are added, removed or reordered.
// v2 and v3 only appended slots (v2 the new offers after `reject`, v3 the
// mixed offers and pick slots after those), so an older policy upgrades by
// growing its global head (training/catan/upgrade_policy.py).

import type { Action, EdgeId, Resource, ResourceBank } from '@/game/types';
import { COSTS, RESOURCES } from '@/game/types';
import { analyseBoard, type BoardFacts } from './encode';
import { AFFORD_COSTS } from './knowledge';
import type { CatanDraft, CatanObservation, ObservedPlayer } from './observation';
import { MAX_AI_COUNTERS_PER_SEAT, MAX_AI_COUNTERS_PER_TURN } from '../counterLimits';

export const ACTION_SPACE_VERSION = 3;

/** How a policy plays the v3 additions (see the header). */
export interface PolicyRules {
  tradePick: boolean;
  offerNeeds: boolean;
  counter: boolean;
}
export const NO_RULES: PolicyRules = { tradePick: false, offerNeeds: false, counter: false };
export const V3_RULES: PolicyRules = { tradePick: true, offerNeeds: true, counter: true };
/** Counter-offers a seat may make per turn (counter rule); the heuristic's limit too. */
export const MAX_COUNTERS_PER_TURN = MAX_AI_COUNTERS_PER_SEAT;

/** A policy file's rules (meta.rules); anything missing is off. */
export function rulesFromMeta(meta: Record<string, unknown> | undefined): PolicyRules {
  const r = (meta?.rules ?? {}) as Partial<PolicyRules>;
  return { tradePick: r.tradePick === true, offerNeeds: r.offerNeeds === true, counter: r.counter === true };
}
export const MAX_OFFERS_PER_TURN = 2;
/** Victim slots name seat offsets 1..MAX_VICTIM_OFFSET (8 players max). */
const MAX_VICTIM_OFFSET = 7;

const PAIRS: Array<[Resource, Resource]> = [];
RESOURCES.forEach((a, i) => RESOURCES.slice(i).forEach((b) => PAIRS.push([a, b])));
const SWAPS: Array<[Resource, Resource]> = [];
for (const give of RESOURCES) for (const get of RESOURCES) if (give !== get) SWAPS.push([give, get]);

interface Offer {
  give: Partial<ResourceBank>;
  receive: Partial<ResourceBank>;
}
const offersOfShape = (shapes: ReadonlyArray<readonly [number, number]>): Offer[] =>
  shapes.flatMap(([n, m]) => SWAPS.map(([give, get]) => ({ give: { [give]: n }, receive: { [get]: m } })));
/** v1's menu, in its slot block in the middle of the globals. */
const OFFERS_V1 = offersOfShape([[1, 1], [2, 1], [1, 2]]);
/** Added in v2, appended after every v1 slot. */
const OFFERS_V2 = offersOfShape([[3, 1], [1, 3], [3, 2], [2, 3]]);
/** Added in v3: mixed offers — 1+1 for 1, 1 for 1+1, 2+1 for 1, 1 for 2+1 (all different resources). */
const OFFERS_V3: Offer[] = (() => {
  const out: Offer[] = [];
  const others = (...not: Resource[]) => RESOURCES.filter((r) => !not.includes(r));
  RESOURCES.forEach((a, i) => RESOURCES.slice(i + 1).forEach((b) => {
    for (const c of others(a, b)) out.push({ give: { [a]: 1, [b]: 1 }, receive: { [c]: 1 } });
  }));
  for (const a of RESOURCES) {
    const rest = others(a);
    rest.forEach((b, i) => rest.slice(i + 1).forEach((c) => out.push({ give: { [a]: 1 }, receive: { [b]: 1, [c]: 1 } })));
  }
  for (const a of RESOURCES) for (const b of others(a)) for (const c of others(a, b)) {
    out.push({ give: { [a]: 2, [b]: 1 }, receive: { [c]: 1 } });
  }
  for (const a of RESOURCES) for (const b of others(a)) for (const c of others(a, b)) {
    out.push({ give: { [a]: 1 }, receive: { [b]: 2, [c]: 1 } });
  }
  return out;
})();
const OFFERS: Offer[] = [...OFFERS_V1, ...OFFERS_V2, ...OFFERS_V3];
/** pick:k trades with the seat k after the viewer; pick:none walks away. */
const PICK_SLOTS = [...Array.from({ length: MAX_VICTIM_OFFSET }, (_, k) => `pick:${k + 1}`), 'pick:none'];
const offerName = (o: Offer) => {
  const side = (b: Partial<ResourceBank>) => RESOURCES.filter((r) => b[r]).map((r) => `${b[r]}${r}`).join('+');
  return `offer:${side(o.give)}>${side(o.receive)}`;
};

export const GLOBAL_SLOTS: readonly string[] = [
  'roll',
  'endTurn',
  'buyDev',
  'playKnight',
  'playRoadBuilding',
  ...PAIRS.map(([a, b]) => `yearOfPlenty:${a}+${b}`),
  ...RESOURCES.map((r) => `monopoly:${r}`),
  ...SWAPS.map(([give, get]) => `bank:${give}>${get}`),
  ...OFFERS_V1.map(offerName),
  ...RESOURCES.map((r) => `discard:${r}`),
  ...Array.from({ length: MAX_VICTIM_OFFSET }, (_, k) => `victim:${k + 1}`),
  'accept',
  'reject',
  ...OFFERS_V2.map(offerName),
  ...OFFERS_V3.map(offerName),
  ...PICK_SLOTS,
  'counter',
];
const GLOBAL_INDEX = new Map(GLOBAL_SLOTS.map((name, i) => [name, i]));
const globalSlot = (name: string) => {
  const i = GLOBAL_INDEX.get(name);
  if (i === undefined) throw new Error(`unknown global slot ${name}`);
  return i;
};
const PAIR_BASE = globalSlot(`yearOfPlenty:${RESOURCES[0]}+${RESOURCES[0]}`);
const MONOPOLY_BASE = globalSlot(`monopoly:${RESOURCES[0]}`);
const BANK_BASE = globalSlot(`bank:${SWAPS[0]![0]}>${SWAPS[0]![1]}`);
/** Global index of each offer in OFFERS (the two blocks), and back. */
const OFFER_SLOT = OFFERS.map((o) => globalSlot(offerName(o)));
const OFFER_AT = new Map(OFFER_SLOT.map((gi, i) => [gi, i]));
const DISCARD_BASE = globalSlot(`discard:${RESOURCES[0]}`);
const VICTIM_BASE = globalSlot('victim:1');
const PICK_BASE = globalSlot('pick:1');
const PICK_NONE = globalSlot('pick:none');
const COUNTER = globalSlot('counter');

export interface SlotLayout {
  vertices: number;
  edges: number;
  hexes: number;
  globals: number;
  total: number;
}

export function slotLayout(obs: Pick<CatanObservation, 'index'>): SlotLayout {
  const v = obs.index.vertexIds.length;
  const e = obs.index.edgeIds.length;
  const h = obs.index.hexIds.length;
  return { vertices: v, edges: e, hexes: h, globals: GLOBAL_SLOTS.length, total: v + e + h + GLOBAL_SLOTS.length };
}

/** Every slot's name, for logs and reports. */
export function slotNames(obs: Pick<CatanObservation, 'index'>): string[] {
  const { index } = obs;
  return [
    ...index.vertexIds.map((_, i) => `vertex:${i}`),
    ...index.edgeIds.map((_, i) => `edge:${i}`),
    ...index.hexIds.map((_, i) => `hex:${i}`),
    ...GLOBAL_SLOTS,
  ];
}

const covers = (hand: ResourceBank, cost: Partial<ResourceBank>) => RESOURCES.every((r) => hand[r] >= (cost[r] ?? 0));
const total = (b: Partial<ResourceBank>) => RESOURCES.reduce((s, r) => s + (b[r] ?? 0), 0);
const sameOffer = (a: Offer, b: Offer) => RESOURCES.every((r) => (a.give[r] ?? 0) === (b.give[r] ?? 0) && (a.receive[r] ?? 0) === (b.receive[r] ?? 0));

export function bankRate(p: ObservedPlayer, give: Resource): number {
  return p.ports.includes(give) ? 2 : p.ports.includes('generic') ? 3 : 4;
}


// Build costs in RESOURCES order (knowledge.ts AFFORD_COSTS: road, settlement, city, dev card).
const [ROAD_COST, SETTLEMENT_COST, CITY_COST, DEV_COST] = AFFORD_COSTS as [number[], number[], number[], number[]];

/** What opponent `p` is short of for a build it's close to (≤ 2 cards off), else for any build it could make. */
function wantedBy(obs: CatanObservation, b: BoardFacts, p: ObservedPlayer): boolean[] {
  const mean = p.estimate.mean;
  const builds: number[][] = [];
  if (p.roads.length < 15) builds.push(ROAD_COST);
  const dist = b.dist[p.offset]!;
  if (p.settlements.length < 5 && b.open.some((o, v) => o === 1 && dist[v]! <= 1)) builds.push(SETTLEMENT_COST);
  if (p.settlements.length > 0 && p.cities.length < 4) builds.push(CITY_COST);
  if (obs.devDeckSize > 0) builds.push(DEV_COST);
  const short = (c: number[]) => c.reduce((s, x, r) => s + Math.max(0, x - mean[r]!), 0);
  const close = builds.filter((c) => short(c) <= 2);
  const use = close.length > 0 ? close : builds;
  return RESOURCES.map((_, r) => use.some((c) => c[r]! > mean[r]! + 1e-9));
}

/** The bank or a harbor already does this at the same or a better rate: the
 *  give side, at the viewer's rates, would buy the whole ask. */
function bankDoesIt(obs: CatanObservation, me: ObservedPlayer, o: Offer): boolean {
  const asked = total(o.receive);
  const bought = RESOURCES.reduce((s, x) => s + Math.floor((o.give[x] ?? 0) / bankRate(me, x)), 0);
  return bought >= asked && RESOURCES.every((x) => obs.bank[x] >= (o.receive[x] ?? 0));
}

/** `p` could hold what offer `o` asks for (the card counter's view). */
function canPay(p: ObservedPlayer, o: Offer): boolean {
  return RESOURCES.every((x, r) => {
    const want = o.receive[x] ?? 0;
    return want === 0 || (want >= 2 ? p.estimate.atLeast2[r]! : p.estimate.atLeast1[r]!) > 0;
  });
}

/** Indices (into OFFERS) of the counters the viewer may make to the offer it's answering. */
function counterOffers(
  obs: CatanObservation,
  d: { proposerOffset: number; give: ResourceBank; get: ResourceBank },
  facts: BoardFacts | undefined,
  rules: PolicyRules,
): number[] {
  const countered = obs.turnOffers.filter((o) => o.proposerOffset === 0).length;
  if (obs.currentOffset === 0 || countered >= MAX_COUNTERS_PER_TURN || obs.aiCountersThisTurn >= MAX_AI_COUNTERS_PER_TURN) return [];
  const me = obs.players[0]!;
  const hand = me.hand!;
  const proposer = obs.players[d.proposerOffset]!;
  const wants = rules.offerNeeds ? wantedBy(obs, facts ?? analyseBoard(obs), proposer) : null;
  const out: number[] = [];
  OFFERS.forEach((o, i) => {
    if (!covers(hand, o.give)) return;
    // Just the offer itself, accepted.
    if (RESOURCES.every((x) => (o.give[x] ?? 0) === d.give[x] && (o.receive[x] ?? 0) === d.get[x])) return;
    if (bankDoesIt(obs, me, o)) return;
    if (!canPay(proposer, o)) return;
    if (wants && !RESOURCES.some((x, r) => (o.give[x] ?? 0) > 0 && wants[r]!)) return;
    out.push(i);
  });
  return out;
}

/** 1 = legal, one entry per slot. All zeros when the viewer has nothing to decide.
 *  `facts` — analyseBoard(obs), if the caller already has it (the encoder needs it too).
 *  `rules` — the policy's (see the header); the default is the pre-v3 behaviour. */
export function legalMask(obs: CatanObservation, facts?: BoardFacts, rules: PolicyRules = NO_RULES): Uint8Array {
  const L = slotLayout(obs);
  const mask = new Uint8Array(L.total);
  const d = obs.decision;
  if (!d) return mask;
  const E0 = L.vertices;
  const H0 = E0 + L.edges;
  const G0 = H0 + L.hexes;
  const me = obs.players[0]!;
  const hand = me.hand!;
  const g = (name: string) => { mask[G0 + globalSlot(name)] = 1; };

  switch (d.type) {
    case 'setupSettlement': {
      const b = facts ?? analyseBoard(obs);
      for (let v = 0; v < L.vertices; v++) mask[v] = b.canSettle[v]!;
      break;
    }
    case 'setupRoad':
    case 'roadBuilding': {
      const b = facts ?? analyseBoard(obs);
      for (let e = 0; e < L.edges; e++) mask[E0 + e] = b.canRoad[e]!;
      break;
    }
    case 'roll':
      g('roll');
      if (d.canKnight) g('playKnight');
      break;
    case 'discard':
      RESOURCES.forEach((r, i) => { if (hand[r] - d.chosen[r] > 0) mask[G0 + DISCARD_BASE + i] = 1; });
      break;
    case 'robberHex':
      for (const t of d.targets) mask[H0 + obs.index.hexIndex.get(t.hex)!] = 1;
      break;
    case 'robberVictim':
      for (const off of d.candidates) if (off <= MAX_VICTIM_OFFSET) mask[G0 + VICTIM_BASE + off - 1] = 1;
      break;
    case 'tradeResponse':
      if (covers(hand, d.give)) g('accept');
      g('reject');
      if (rules.counter && !d.counter && counterOffers(obs, d, facts, rules).length > 0) mask[G0 + COUNTER] = 1;
      break;
    case 'counterOffer':
      for (const i of counterOffers(obs, d, facts, rules)) mask[G0 + OFFER_SLOT[i]!] = 1;
      break;
    case 'tradePick':
      for (const off of d.acceptors) if (off >= 1 && off <= MAX_VICTIM_OFFSET) mask[G0 + PICK_BASE + off - 1] = 1;
      mask[G0 + PICK_NONE] = 1;
      break;
    case 'main': {
      const b = facts ?? analyseBoard(obs);
      if (covers(hand, COSTS.settlement)) for (let v = 0; v < L.vertices; v++) if (b.canSettle[v]) mask[v] = 1;
      if (covers(hand, COSTS.city)) for (let v = 0; v < L.vertices; v++) if (b.canCity[v]) mask[v] = 1;
      const anyRoad = b.canRoad.some((x) => x === 1);
      if (covers(hand, COSTS.road)) for (let e = 0; e < L.edges; e++) if (b.canRoad[e]) mask[E0 + e] = 1;
      if (covers(hand, COSTS.devCard) && obs.devDeckSize > 0) g('buyDev');
      const dev = me.devCards!.playable;
      if (d.canPlayDev) {
        if (dev.knight > 0) g('playKnight');
        if (dev.roadBuilding > 0 && anyRoad) g('playRoadBuilding');
        if (dev.yearOfPlenty > 0) {
          PAIRS.forEach(([a, c], i) => {
            if (a === c ? obs.bank[a] >= 2 : obs.bank[a] >= 1 && obs.bank[c] >= 1) mask[G0 + PAIR_BASE + i] = 1;
          });
        }
        if (dev.monopoly > 0) RESOURCES.forEach((_, i) => { mask[G0 + MONOPOLY_BASE + i] = 1; });
      }
      SWAPS.forEach(([give, get], i) => {
        if (hand[give] >= bankRate(me, give) && obs.bank[get] >= 1) mask[G0 + BANK_BASE + i] = 1;
      });
      if (d.playerTrades && obs.tradesProposedThisTurn < MAX_OFFERS_PER_TURN && obs.playerCount > 1) {
        const opps = obs.players.slice(1);
        const wants = rules.offerNeeds ? opps.map((p) => wantedBy(obs, b, p)) : null;
        OFFERS.forEach((o, i) => {
          if (!covers(hand, o.give)) return;
          if (obs.offeredThisTurn.some((t) => sameOffer(t, o))) return;
          if (bankDoesIt(obs, me, o)) return;
          // Someone who could pay (and, with offerNeeds, who'd want what's given).
          const keen = (j: number) => !wants || RESOURCES.some((x, r) => (o.give[x] ?? 0) > 0 && wants[j]![r]!);
          if (!opps.some((p, j) => canPay(p, o) && keen(j))) return;
          mask[G0 + OFFER_SLOT[i]!] = 1;
        });
      }
      g('endTurn');
      break;
    }
  }
  return mask;
}

export type Decoded = { kind: 'action'; action: Action } | { kind: 'draft'; draft: CatanDraft };

export const randomDice = (): [number, number] => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];

/** What slot `slot` means for the viewer's current decision: a reducer action,
 *  or the next draft of a multi-part answer. Throws on an illegal slot.
 *  `mask` — legalMask(obs), if the caller already has it. */
/** The counter-offers decided on before `offset`'s (they come in the pending trade's order). */
function declinedSoFar(obs: CatanObservation, offset: number): number[] {
  const order = (obs.pendingTrade?.counters ?? []).map((c) => c.byOffset);
  const at = order.indexOf(offset);
  return at < 0 ? [] : order.slice(0, at);
}

export function decodeSlot(
  obs: CatanObservation,
  slot: number,
  rollDice: () => [number, number] = randomDice,
  mask?: Uint8Array,
): Decoded {
  const d = obs.decision;
  if (!d) throw new Error('decodeSlot: the viewer has no decision');
  if (!(mask ?? legalMask(obs))[slot]) throw new Error(`decodeSlot: slot ${slotNames(obs)[slot] ?? slot} is not legal for ${d.type}`);
  const L = slotLayout(obs);
  const playerId = obs.viewerId;
  const act = (action: Action): Decoded => ({ kind: 'action', action });
  const idx = obs.index;

  if (slot < L.vertices) {
    const vertex = idx.vertexIds[slot]!;
    if (d.type === 'setupSettlement') return act({ type: 'placeInitialSettlement', playerId, vertex });
    return act(obs.players[0]!.settlements.includes(vertex)
      ? { type: 'buildCity', playerId, vertex }
      : { type: 'buildSettlement', playerId, vertex });
  }
  if (slot < L.vertices + L.edges) {
    const edge = idx.edgeIds[slot - L.vertices]!;
    if (d.type === 'setupRoad') return act({ type: 'placeInitialRoad', playerId, edge });
    if (d.type === 'roadBuilding') return roadBuildingStep(obs, [...d.placed, edge]);
    return act({ type: 'buildRoad', playerId, edge });
  }
  if (slot < L.vertices + L.edges + L.hexes) {
    const hex = idx.hexIds[slot - L.vertices - L.edges]!;
    const d = obs.decision;
    const victims = (d?.type === 'robberHex' ? d.targets.find((t) => t.hex === hex)?.victims : undefined) ?? [];
    if (victims.length >= 2) return { kind: 'draft', draft: { robberHex: hex } };
    return act({ type: 'moveRobber', playerId, hex, stealFrom: victims.length === 1 ? obs.players[victims[0]!]!.id : null });
  }

  const gi = slot - L.vertices - L.edges - L.hexes;
  const name = GLOBAL_SLOTS[gi]!;
  switch (name) {
    case 'roll':
      return act({ type: 'rollDice', playerId, dice: rollDice() });
    case 'endTurn':
      return act({ type: 'endTurn', playerId });
    case 'buyDev':
      return act({ type: 'buyDevCard', playerId });
    case 'playKnight':
      return act({ type: 'playKnight', playerId });
    case 'playRoadBuilding':
      return { kind: 'draft', draft: { roadBuilding: [] } };
    case 'accept':
      // A counter-offer to its own offer: take it.
      if (d.type === 'tradeResponse' && d.counter) {
        return act({ type: 'confirmTrade', playerId, with: obs.players[d.proposerOffset]!.id, counter: true });
      }
      return act({ type: 'acceptTrade', playerId });
    case 'reject':
      if (d.type === 'tradeResponse' && d.counter) {
        // Turn this counter down: the next one, or (none left) walk away.
        if ((d.rest ?? 0) > 0) {
          const declined = [...declinedSoFar(obs, d.proposerOffset), d.proposerOffset];
          return { kind: 'draft', draft: { pickedNone: true, declined } };
        }
        return act({ type: 'cancelTrade', playerId });
      }
      return act({ type: 'rejectTrade', playerId });
    case 'pick:none':
      // Passing on every yes: the counter-offers next, if any.
      if (d.type === 'tradePick' && (d.counters ?? 0) > 0) return { kind: 'draft', draft: { pickedNone: true } };
      return act({ type: 'cancelTrade', playerId });
    case 'counter':
      return { kind: 'draft', draft: { counter: true } };
  }
  if (gi >= PICK_BASE && gi < PICK_BASE + MAX_VICTIM_OFFSET && d.type === 'tradePick') {
    return act({ type: 'confirmTrade', playerId, with: obs.players[gi - PICK_BASE + 1]!.id });
  }
  if (gi >= PAIR_BASE && gi < PAIR_BASE + PAIRS.length) {
    return act({ type: 'playYearOfPlenty', playerId, resources: PAIRS[gi - PAIR_BASE]! });
  }
  if (gi >= MONOPOLY_BASE && gi < MONOPOLY_BASE + RESOURCES.length) {
    return act({ type: 'playMonopoly', playerId, resource: RESOURCES[gi - MONOPOLY_BASE]! });
  }
  if (gi >= BANK_BASE && gi < BANK_BASE + SWAPS.length) {
    const [give, receive] = SWAPS[gi - BANK_BASE]!;
    return act({ type: 'bankTrade', playerId, give, receive });
  }
  const offer = OFFER_AT.get(gi);
  if (offer !== undefined) {
    const o = OFFERS[offer]!;
    // Having chosen to counter, an offer slot is the counter-offer (the counter rule).
    const type = d.type === 'counterOffer' ? 'counterTrade' : 'proposeTrade';
    return act({ type, playerId, give: { ...o.give }, receive: { ...o.receive } });
  }
  if (gi >= DISCARD_BASE && gi < DISCARD_BASE + RESOURCES.length && d.type === 'discard') {
    const chosen = { ...d.chosen, [RESOURCES[gi - DISCARD_BASE]!]: d.chosen[RESOURCES[gi - DISCARD_BASE]!] + 1 };
    if (total(chosen) >= d.required) return act({ type: 'discard', playerId, resources: chosen });
    return { kind: 'draft', draft: { discard: chosen } };
  }
  if (gi >= VICTIM_BASE && gi < VICTIM_BASE + MAX_VICTIM_OFFSET && d.type === 'robberVictim') {
    return act({ type: 'moveRobber', playerId, hex: d.hex, stealFrom: obs.players[gi - VICTIM_BASE + 1]!.id });
  }
  throw new Error(`decodeSlot: no meaning for ${name} in ${d.type}`);
}

/** The slot that plays `action` for the viewer's current decision — for a
 *  multi-part answer, the slot of its next part — or −1 if the action space
 *  can't express it (an offer outside the menu, a discard the draft has
 *  already left). The inverse of decodeSlot; legality isn't checked. */
export function slotForAction(obs: CatanObservation, action: Action): number {
  const L = slotLayout(obs);
  const E0 = L.vertices;
  const H0 = E0 + L.edges;
  const G0 = H0 + L.hexes;
  const idx = obs.index;
  const d = obs.decision;
  const at = (base: number, i: number | undefined) => (i === undefined || i < 0 ? -1 : base + i);
  switch (action.type) {
    case 'placeInitialSettlement':
    case 'buildSettlement':
    case 'buildCity':
      return at(0, idx.vertexIndex.get(action.vertex));
    case 'placeInitialRoad':
    case 'buildRoad':
      return at(E0, idx.edgeIndex.get(action.edge));
    case 'rollDice':
      return G0 + globalSlot('roll');
    case 'endTurn':
      return G0 + globalSlot('endTurn');
    case 'buyDevCard':
      return G0 + globalSlot('buyDev');
    case 'playKnight':
      return G0 + globalSlot('playKnight');
    case 'playRoadBuilding': {
      if (d?.type !== 'roadBuilding') return G0 + globalSlot('playRoadBuilding');
      if (d.placed.some((e, k) => action.edges[k] !== e)) return -1;
      const next = action.edges[d.placed.length];
      return next === undefined ? -1 : at(E0, idx.edgeIndex.get(next));
    }
    case 'playYearOfPlenty': {
      const [a, b] = action.resources;
      return at(G0 + PAIR_BASE, PAIRS.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a)));
    }
    case 'playMonopoly':
      return at(G0 + MONOPOLY_BASE, RESOURCES.indexOf(action.resource));
    case 'bankTrade':
      return at(G0 + BANK_BASE, SWAPS.findIndex(([give, get]) => give === action.give && get === action.receive));
    case 'counterTrade':
    case 'proposeTrade': {
      // A counter's first part is the choice to counter; the offer is the second.
      if (action.type === 'counterTrade' && d?.type === 'tradeResponse') return G0 + COUNTER;
      const i = OFFERS.findIndex((o) => sameOffer(o, action));
      return i < 0 ? -1 : G0 + OFFER_SLOT[i]!;
    }
    case 'acceptTrade':
      return G0 + globalSlot('accept');
    case 'rejectTrade':
      return G0 + globalSlot('reject');
    case 'cancelTrade':
      return G0 + (d?.type === 'tradePick' ? PICK_NONE : globalSlot('reject'));
    case 'confirmTrade': {
      // Taking a counter-offer is the accept of that counter's decision.
      if (action.counter) return d?.type === 'tradeResponse' && d.counter ? G0 + globalSlot('accept') : -1;
      if (d?.type !== 'tradePick') return -1;
      const off = obs.players.find((p) => p.id === action.with)?.offset;
      return off === undefined || off < 1 || off > MAX_VICTIM_OFFSET ? -1 : G0 + PICK_BASE + off - 1;
    }
    case 'discard': {
      if (d?.type !== 'discard') return -1;
      if (RESOURCES.some((r) => d.chosen[r] > (action.resources[r] ?? 0))) return -1;
      return at(G0 + DISCARD_BASE, RESOURCES.findIndex((r) => (action.resources[r] ?? 0) > d.chosen[r]));
    }
    case 'moveRobber': {
      if (d?.type !== 'robberVictim') return at(H0, idx.hexIndex.get(action.hex));
      if (action.hex !== d.hex || action.stealFrom === null) return -1;
      const off = obs.players.find((p) => p.id === action.stealFrom)?.offset;
      return off === undefined || off < 1 || off > MAX_VICTIM_OFFSET ? -1 : G0 + VICTIM_BASE + off - 1;
    }
    default:
      return -1;
  }
}

/** After choosing `placed`, finish the card if no further road fits (or two are down). */
function roadBuildingStep(obs: CatanObservation, placed: EdgeId[]): Decoded {
  const playerId = obs.viewerId;
  if (placed.length < 2) {
    const next = analyseBoard({ ...obs, decision: { type: 'roadBuilding', placed } });
    if (next.canRoad.some((x) => x === 1)) return { kind: 'draft', draft: { roadBuilding: placed } };
  }
  return { kind: 'action', action: { type: 'playRoadBuilding', playerId, edges: placed as [EdgeId] | [EdgeId, EdgeId] } };
}
