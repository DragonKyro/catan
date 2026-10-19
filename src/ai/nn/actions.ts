// Catan learned agent — action space v1: a fixed slot list over the board plus
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
// At 4 players that is 54 + 72 + 19 + 119 = 264 slots.
//
// Multi-part answers are one decision per part, carried in a CatanDraft
// (never game state): a discard is one card at a time until the required
// count is chosen; the robber is its hex, then — if two or more seats could
// be robbed — the victim (one candidate is robbed automatically, as the rules
// require); Road Building is the card, then each road (finishing by itself
// when no second road fits).
//
// Player trades are offers from a fixed menu — 1:1, 2:1 and 1:2 between any
// two resources — at most MAX_OFFERS_PER_TURN a turn, never the same offer
// twice in a turn, and only when some opponent could hold what's asked.
// Counter-offers aren't in the space; an offer is answered accept / reject.
//
// Bump ACTION_SPACE_VERSION whenever slots are added, removed or reordered.

import type { Action, EdgeId, Resource, ResourceBank } from '@/game/types';
import { COSTS, RESOURCES } from '@/game/types';
import { analyseBoard, type BoardFacts } from './encode';
import type { CatanDraft, CatanObservation, ObservedPlayer } from './observation';

export const ACTION_SPACE_VERSION = 1;
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
const OFFERS: Offer[] = [];
for (const [n, m] of [[1, 1], [2, 1], [1, 2]] as const) {
  for (const [give, get] of SWAPS) OFFERS.push({ give: { [give]: n }, receive: { [get]: m } });
}
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
  ...OFFERS.map(offerName),
  ...RESOURCES.map((r) => `discard:${r}`),
  ...Array.from({ length: MAX_VICTIM_OFFSET }, (_, k) => `victim:${k + 1}`),
  'accept',
  'reject',
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
const OFFER_BASE = globalSlot(offerName(OFFERS[0]!));
const DISCARD_BASE = globalSlot(`discard:${RESOURCES[0]}`);
const VICTIM_BASE = globalSlot('victim:1');

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

/** Seats (offsets) the robber could steal from on `hex`. */
function victimsOn(obs: CatanObservation, hex: string): number[] {
  const corners = obs.board.hexes[hex]!.corners;
  return obs.players
    .filter((p) => p.offset !== 0 && p.handSize > 0 && corners.some((v) => p.settlements.includes(v) || p.cities.includes(v)))
    .map((p) => p.offset);
}

/** 1 = legal, one entry per slot. All zeros when the viewer has nothing to decide.
 *  `facts` — analyseBoard(obs), if the caller already has it (the encoder needs it too). */
export function legalMask(obs: CatanObservation, facts?: BoardFacts): Uint8Array {
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
      obs.index.hexIds.forEach((id, h) => { if (id !== obs.board.robberHex) mask[H0 + h] = 1; });
      break;
    case 'robberVictim':
      for (const off of d.candidates) if (off <= MAX_VICTIM_OFFSET) mask[G0 + VICTIM_BASE + off - 1] = 1;
      break;
    case 'tradeResponse':
      if (covers(hand, d.give)) g('accept');
      g('reject');
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
        OFFERS.forEach((o, i) => {
          if (!covers(hand, o.give)) return;
          if (obs.offeredThisTurn.some((t) => sameOffer(t, o))) return;
          const r = RESOURCES.findIndex((x) => (o.receive[x] ?? 0) > 0);
          const want = o.receive[RESOURCES[r]!]!;
          if (!opps.some((p) => (want >= 2 ? p.estimate.atLeast2[r]! : p.estimate.atLeast1[r]!) > 0)) return;
          mask[G0 + OFFER_BASE + i] = 1;
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
    const victims = victimsOn(obs, hex);
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
      return act({ type: 'acceptTrade', playerId });
    case 'reject':
      return act(d.type === 'tradeResponse' && d.counter ? { type: 'cancelTrade', playerId } : { type: 'rejectTrade', playerId });
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
  if (gi >= OFFER_BASE && gi < OFFER_BASE + OFFERS.length) {
    const o = OFFERS[gi - OFFER_BASE]!;
    return act({ type: 'proposeTrade', playerId, give: { ...o.give }, receive: { ...o.receive } });
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
    case 'proposeTrade':
      return at(G0 + OFFER_BASE, OFFERS.findIndex((o) => sameOffer(o, action)));
    case 'acceptTrade':
      return G0 + globalSlot('accept');
    case 'rejectTrade':
    case 'cancelTrade':
      return G0 + globalSlot('reject');
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
