import type {
  Action,
  Commodity,
  EdgeId,
  GameState,
  HexId,
  ImprovementTrack,
  KnightStrength,
  PlayProgressCardAction,
  PlayerId,
  ProgressCardKind,
  Resource,
  TradeGood,
  VertexId,
} from '@/game/types';
import { COMMODITIES, COSTS, IMPROVEMENT_TRACKS, RESOURCES, TRACK_COMMODITY } from '@/game/types';
import { ckBankTradeRate } from '@/game/modules/citiesAndKnights/trade';
import { applyAction } from '@/game/engine';
import { canAfford } from '@/game/resources';
import { canConnectRoad } from '@/game/placement';
import { merchantSites } from '@/game/modules/citiesAndKnights/actions/placeMerchant';
import { VP_PROGRESS_CARDS } from '@/game/modules/citiesAndKnights/progress/catalogue';
import {
  playerKnights,
  supplyAvailable,
} from '@/game/modules/citiesAndKnights/knights/state';
import { reachableEmptyVertices } from '@/game/modules/citiesAndKnights/knights/graph';
import {
  canPromoteKnightAt,
  legalIntrigueTargets,
} from '@/game/modules/citiesAndKnights/knights/legal';
import { vertexScore, RESOURCE_WEIGHT } from '../value';
import { chooseRobberMove } from '../robber';
import {
  commoditiesOf,
  commodityOfTerrain,
  firstLegal,
  handSizeCK,
  hexCorners,
  hexPips,
  isLegal,
  playerById,
  publicVp,
  touchesHex,
} from './common';
import { barbarianOutlook } from './barbarians';
import { bestCardsFrom, cheapestCards, ckReportNeeds, focusTrack, type CardKind } from './value';
import { craneTrack, wallSpot } from './improvements';
import { canPlaceAnyKnight } from './knights';
import { PROGRESS_CARD_HAND_LIMIT } from '@/game/modules/citiesAndKnights/constants';

// Progress cards for the Cities & Knights AI: one simple rule per card,
// plus the follow-up answers (picks, discards, Wedding, Commercial Harbor…).

export interface HeldCard {
  deck: ImprovementTrack;
  card: ProgressCardKind;
}

export function heldProgressCards(state: GameState, playerId: PlayerId): HeldCard[] {
  const p = playerById(state, playerId);
  const out: HeldCard[] = [];
  for (const deck of IMPROVEMENT_TRACKS) {
    for (const card of p.progressCards?.[deck] ?? []) {
      if (!VP_PROGRESS_CARDS.has(card)) out.push({ deck, card });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Card values (discard order, Espionage pick)
// ---------------------------------------------------------------------------

const BASE_VALUE: Record<ProgressCardKind, number> = {
  alchemy: 2.5,
  crane: 2.2,
  engineering: 1.4,
  invention: 1.6,
  irrigation: 2.0,
  medicine: 3.0,
  mining: 2.0,
  progressRoadBuilding: 2.2,
  smithing: 2.0,
  printing: 10,
  commercialHarborCard: 1.6,
  guildDues: 2.0,
  merchantCard: 3.0,
  merchantFleet: 1.5,
  resourceMonopoly: 2.8,
  tradeMonopoly: 2.0,
  diplomacy: 1.2,
  encouragement: 1.8,
  espionage: 1.6,
  intrigue: 1.5,
  sabotage: 2.0,
  taxation: 1.8,
  treason: 2.0,
  constitution: 10,
  wedding: 2.4,
};

function fieldCount(state: GameState, playerId: PlayerId, terrain: 'wheat' | 'ore'): number {
  let n = 0;
  for (const hexId of state.board.hexIds) {
    if (state.board.hexes[hexId]!.terrain !== terrain) continue;
    if (touchesHex(state, playerId, hexId)) n++;
  }
  return n;
}

export function progressCardValue(state: GameState, playerId: PlayerId, card: ProgressCardKind): number {
  const p = playerById(state, playerId);
  const knights = playerKnights(state, playerId).length;
  switch (card) {
    case 'medicine':
      return p.settlements.length > 0 && p.cities.length < 4 ? 3.0 : 0.5;
    case 'smithing':
    case 'encouragement':
      return knights > 0 ? BASE_VALUE[card] : 0.6;
    case 'irrigation':
      return 0.6 + 0.9 * fieldCount(state, playerId, 'wheat');
    case 'mining':
      return 0.6 + 0.9 * fieldCount(state, playerId, 'ore');
    case 'taxation':
      return state.robberActive ? BASE_VALUE.taxation : 0.8;
    case 'engineering':
      return wallSpot(state, playerId) ? BASE_VALUE.engineering : 0.4;
    default:
      return BASE_VALUE[card];
  }
}

// ---------------------------------------------------------------------------
// Alchemy (before the roll)
// ---------------------------------------------------------------------------

// What a production roll of `total` is worth to `playerId`.
function rollYield(state: GameState, playerId: PlayerId, total: number): number {
  const p = playerById(state, playerId);
  let v = 0;
  for (const hexId of state.board.hexIds) {
    const hex = state.board.hexes[hexId]!;
    if (hex.numberToken !== total || hexId === state.board.robberHex) continue;
    const commodity = commodityOfTerrain(hex.terrain);
    const res = hex.terrain as Resource;
    if (!(RESOURCES as readonly string[]).includes(res)) continue;
    for (const vid of hexCorners(state, hexId)) {
      if (p.settlements.includes(vid)) v += RESOURCE_WEIGHT[res];
      else if (p.cities.includes(vid)) v += RESOURCE_WEIGHT[res] + (commodity ? 1.25 : RESOURCE_WEIGHT[res]);
    }
  }
  return v;
}

// Alchemy: set the production dice. Worth playing when the best roll pays
// us clearly more than the others; the red die also picks progress draws,
// so keep it within our improvement levels.
export function chooseAlchemy(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (!(p.progressCards?.science ?? []).includes('alchemy')) return null;
  const levels = p.improvements ?? { science: 0, trade: 0, politics: 0 };
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (let red = 1; red <= 6; red++) {
    for (let yellow = 1; yellow <= 6; yellow++) {
      const total = red + yellow;
      if (total === 7) continue;
      let score = rollYield(state, playerId, total);
      for (const opp of state.players) {
        if (opp.id !== playerId) score -= 0.35 * rollYield(state, opp.id, total);
      }
      for (const t of IMPROVEMENT_TRACKS) if (red <= levels[t]) score += 0.35;
      if (score > bestScore) {
        bestScore = score;
        best = [red, yellow];
      }
    }
  }
  if (!best || bestScore < 2.4) return null;
  return firstLegal(state, [{ type: 'playProgressCard', playerId, card: 'alchemy', dice: best }]);
}

// ---------------------------------------------------------------------------
// Card plays during the Action phase
// ---------------------------------------------------------------------------

function play(playerId: PlayerId, card: ProgressCardKind, extra: Partial<PlayProgressCardAction> = {}): PlayProgressCardAction {
  return { type: 'playProgressCard', playerId, card, ...extra };
}

// Opponent production share of a resource (public: their buildings).
function productionShare(state: GameState, oppId: PlayerId): Record<Resource, number> {
  const p = playerById(state, oppId);
  const pips: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  let total = 0;
  for (const [vids, mult] of [[p.settlements, 1], [p.cities, 2]] as const) {
    for (const vid of vids) {
      for (const hexId of state.board.vertices[vid]?.hexes ?? []) {
        const t = state.board.hexes[hexId]!.terrain as Resource;
        if (!(RESOURCES as readonly string[]).includes(t)) continue;
        const n = hexPips(state, hexId) * mult;
        pips[t] += n;
        total += n;
      }
    }
  }
  const out: Record<Resource, number> = { wood: 0.2, brick: 0.2, sheep: 0.2, wheat: 0.2, ore: 0.2 };
  if (total > 0) for (const r of RESOURCES) out[r] = pips[r] / total;
  return out;
}

// Expected Resource Monopoly haul per resource, from what opponents
// produce and how many cards they hold (both public).
function monopolyHaul(state: GameState, playerId: PlayerId): Array<{ r: Resource; haul: number }> {
  const out: Array<{ r: Resource; haul: number }> = [];
  for (const r of RESOURCES) {
    let haul = 0;
    for (const opp of state.players) {
      if (opp.id === playerId) continue;
      const share = productionShare(state, opp.id)[r];
      haul += Math.min(2, handSizeCK(opp) * share * 0.85);
    }
    out.push({ r, haul });
  }
  return out;
}

function hasCityOn(state: GameState, playerId: PlayerId, commodity: Commodity): boolean {
  const p = playerById(state, playerId);
  return p.cities.some((v) =>
    (state.board.vertices[v]?.hexes ?? []).some(
      (h) => commodityOfTerrain(state.board.hexes[h]!.terrain) === commodity && hexPips(state, h) > 0,
    ),
  );
}

function bestInvention(state: GameState, playerId: PlayerId): { fromHex: HexId; toHex: HexId; gain: number } | null {
  const forbidden = new Set([2, 6, 8, 12]);
  const myVp = publicVp(state, playerId);
  const weight = new Map<PlayerId, number>();
  for (const p of state.players) {
    weight.set(p.id, p.id === playerId ? 1 : publicVp(state, p.id) > myVp ? -0.7 : -0.4);
  }
  // Building multiplier per hex per player.
  const mult = (hexId: HexId): number => {
    let v = 0;
    for (const vid of hexCorners(state, hexId)) {
      for (const p of state.players) {
        const m = p.cities.includes(vid) ? 2 : p.settlements.includes(vid) ? 1 : 0;
        if (m) v += m * weight.get(p.id)!;
      }
    }
    return v;
  };
  const hexes = state.board.hexIds.filter((h) => {
    const t = state.board.hexes[h]!.numberToken;
    return t != null && !forbidden.has(t);
  });
  let best: { fromHex: HexId; toHex: HexId; gain: number } | null = null;
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      const a = hexes[i]!;
      const b = hexes[j]!;
      const ta = state.board.hexes[a]!.numberToken!;
      const tb = state.board.hexes[b]!.numberToken!;
      if (ta === tb) continue;
      const pa = 6 - Math.abs(7 - ta);
      const pb = 6 - Math.abs(7 - tb);
      const gain = (pb - pa) * mult(a) + (pa - pb) * mult(b);
      if (!best || gain > best.gain) best = { fromHex: a, toHex: b, gain };
    }
  }
  return best;
}

// Two free roads, scored like the base AI scores a road's new endpoint.
function roadBuildingEdges(state: GameState, playerId: PlayerId): EdgeId[] {
  const pick = (s: GameState): EdgeId | null => {
    let best: EdgeId | null = null;
    let bestScore = 1.5;
    for (const eid of s.board.edgeIds) {
      if (!canConnectRoad(s, playerId, eid)) continue;
      const edge = s.board.edges[eid]!;
      for (const v of edge.vertices) {
        const occupied = s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v));
        if (occupied) continue;
        const sc = vertexScore(s, v, playerId);
        if (sc > bestScore) {
          bestScore = sc;
          best = eid;
        }
      }
    }
    return best;
  };
  const p = playerById(state, playerId);
  if (p.roads.length >= 15) return [];
  const first = pick(state);
  if (!first) return [];
  const withFirst: GameState = {
    ...state,
    players: state.players.map((pl) => (pl.id === playerId ? { ...pl, roads: [...pl.roads, first] } : pl)),
  };
  const second = p.roads.length < 14 ? pick(withFirst) : null;
  return second ? [first, second] : [first];
}

function smithingTargets(state: GameState, playerId: PlayerId): VertexId[] {
  const supply: Record<KnightStrength, number> = {
    1: supplyAvailable(state, playerId, 1),
    2: supplyAvailable(state, playerId, 2),
    3: supplyAvailable(state, playerId, 3),
  };
  const ranked = playerKnights(state, playerId).sort((a, b) => {
    if (a.knight.active !== b.knight.active) return a.knight.active ? -1 : 1;
    return b.knight.strength - a.knight.strength;
  });
  const out: VertexId[] = [];
  for (const k of ranked) {
    if (out.length >= 2) break;
    const s = k.knight.strength;
    if (!canPromoteKnightAt(state, playerId, k.vertex)) continue;
    const next = (s + 1) as KnightStrength;
    if (supply[next] <= 0) continue;
    supply[next]--;
    supply[s]++;
    out.push(k.vertex);
  }
  return out;
}

// Opponent knight to Intrigue: one on a corner of our network (the
// engine's rule). Best when it has nowhere to go — it then goes back to its
// owner's supply — and when its owner leads.
function intrigueTarget(state: GameState, playerId: PlayerId): VertexId | null {
  const myVp = publicVp(state, playerId);
  let best: VertexId | null = null;
  let bestScore = 0;
  for (const vid of legalIntrigueTargets(state, playerId)) {
    const k = state.knights?.[vid];
    if (!k) continue;
    const without: GameState = { ...state, knights: { ...state.knights } };
    delete without.knights![vid];
    const stranded = reachableEmptyVertices(without, k.playerId, vid).size === 0;
    let score = 1 + k.strength * 0.3 + (stranded ? 1 + k.strength : 0);
    if (publicVp(state, k.playerId) > myVp) score += 0.7;
    if (score > bestScore) {
      bestScore = score;
      best = vid;
    }
  }
  return best;
}

// Treason target: they lose their weakest knight (their choice), and we may
// put one of ours of up to that strength on the board. Worth it on its own
// (a knight off a rival's defence); better when we can place the knight.
function treasonTarget(state: GameState, playerId: PlayerId): PlayerId | null {
  const canPlace = canPlaceAnyKnight(state, playerId);
  let best: PlayerId | null = null;
  let bestScore = -Infinity;
  for (const opp of state.players) {
    if (opp.id === playerId) continue;
    const ks = playerKnights(state, opp.id);
    if (ks.length === 0) continue;
    const weakest = Math.min(...ks.map((k) => k.knight.strength)) as KnightStrength;
    const canMatch =
      canPlace &&
      ([1, 2, 3] as KnightStrength[]).some((s) => s <= weakest && supplyAvailable(state, playerId, s) > 0);
    const score = weakest * (canMatch ? 2 : 1) + publicVp(state, opp.id) * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = opp.id;
    }
  }
  return best;
}

// Merchant Fleet: name a card we hold a pile of, when 2:1 beats our usual
// rate and the bank has something our next build (or improvement) needs.
function merchantFleetGood(state: GameState, playerId: PlayerId, forced: boolean): TradeGood | null {
  if (state.merchantFleetActive) return null;
  const p = playerById(state, playerId);
  const needs = ckReportNeeds(state, playerId);
  const track = focusTrack(state, playerId);
  const focus = TRACK_COMMODITY[track];
  const level = p.improvements?.[track] ?? 0;
  const focusShort = p.cities.length > 0 && level < 5 ? level + 1 - commoditiesOf(p)[focus] : 0;
  const wantsSomething =
    RESOURCES.some((r) => needs.byResource[r] > 0 && state.bank[r] > 0) || (focusShort >= 1 && focusShort <= 3);
  if (!wantsSomething) return null;
  const have: Record<TradeGood, number> = { ...p.resources, ...commoditiesOf(p) };
  let best: TradeGood | null = null;
  let bestExtra = 0;
  for (const g of [...RESOURCES, ...COMMODITIES] as TradeGood[]) {
    if (g === focus) continue;
    if ((RESOURCES as readonly string[]).includes(g) && needs.byResource[g as Resource] > 0) continue;
    const rate = ckBankTradeRate(state, playerId, g);
    if (rate <= 2) continue;
    const extra = Math.floor(have[g] / 2) - Math.floor(have[g] / rate);
    if (extra > bestExtra) {
      bestExtra = extra;
      best = g;
    }
  }
  if (!best || (bestExtra < 2 && !(forced && bestExtra >= 1))) return null;
  return best;
}

// Diplomacy is only safe to play when the engine will let us remove some
// road afterwards. Worth it against the Longest Road holder or a leader;
// `anyRoad` (over the hand limit) accepts any removable road.
function diplomacyWorth(state: GameState, playerId: PlayerId, anyRoad: boolean): boolean {
  let after: GameState;
  try {
    after = applyAction(state, play(playerId, 'diplomacy'));
  } catch {
    return false;
  }
  const myVp = publicVp(state, playerId);
  for (const owner of after.players) {
    const important =
      owner.id !== playerId &&
      (after.longestRoad?.holder === owner.id || publicVp(state, owner.id) >= myVp + 2);
    if (!important && !anyRoad) continue;
    for (const eid of owner.roads) {
      if (isLegal(after, { type: 'removeRoad', playerId, edge: eid })) return true;
    }
  }
  return false;
}

// The card play (with payload) we'd make now, if any. Over the 4-card
// limit the end of the turn would cost us cards, so we lower the bar and
// play whatever does some good. Build-enabler cards (Medicine, Crane,
// Engineering) are played by the build steps instead — unless we're over
// the limit.
export function tryPlayProgressCard(state: GameState, playerId: PlayerId): Action | null {
  if (state.phase !== 'main') return null;
  const held = heldProgressCards(state, playerId);
  if (held.length === 0) return null;
  const forced = held.length > PROGRESS_CARD_HAND_LIMIT;
  const has = (c: ProgressCardKind) => held.some((h) => h.card === c);
  const p = playerById(state, playerId);
  const myVp = publicVp(state, playerId);
  const needs = ckReportNeeds(state, playerId);
  const candidates: Action[] = [];

  // Straight resource gains.
  if (has('irrigation')) {
    const n = fieldCount(state, playerId, 'wheat');
    if (state.bank.wheat > 0 && (n >= 2 || (n >= 1 && (forced || needs.byResource.wheat > 0)))) {
      candidates.push(play(playerId, 'irrigation'));
    }
  }
  if (has('mining')) {
    const n = fieldCount(state, playerId, 'ore');
    if (state.bank.ore > 0 && (n >= 2 || (n >= 1 && (forced || needs.byResource.ore > 0)))) {
      candidates.push(play(playerId, 'mining'));
    }
  }
  if (has('resourceMonopoly')) {
    const best = monopolyHaul(state, playerId).sort(
      (a, b) => b.haul * RESOURCE_WEIGHT[b.r] - a.haul * RESOURCE_WEIGHT[a.r],
    )[0];
    if (best && (best.haul >= 2.5 || (forced && best.haul >= 1))) {
      candidates.push(play(playerId, 'resourceMonopoly', { resource: best.r }));
    }
  }
  if (has('tradeMonopoly')) {
    let bestC: Commodity | null = null;
    let bestN = 0;
    for (const c of COMMODITIES) {
      let n = 0;
      for (const opp of state.players) {
        if (opp.id === playerId) continue;
        if (hasCityOn(state, opp.id, c) && handSizeCK(opp) >= 2) n += 0.8;
        else if (handSizeCK(opp) >= 4) n += 0.2;
      }
      if (n > bestN) {
        bestN = n;
        bestC = c;
      }
    }
    if (bestC && (bestN >= 1.5 || (forced && bestN > 0))) {
      candidates.push(play(playerId, 'tradeMonopoly', { commodity: bestC }));
    }
  }
  if (has('wedding')) {
    let gifts = 0;
    for (const opp of state.players) {
      if (opp.id !== playerId && publicVp(state, opp.id) > myVp) gifts += Math.min(2, handSizeCK(opp));
    }
    if (gifts >= 2 || (forced && gifts > 0)) candidates.push(play(playerId, 'wedding'));
  }
  if (has('guildDues')) {
    const target = state.players
      .filter((o) => o.id !== playerId && publicVp(state, o.id) > myVp && handSizeCK(o) >= 2)
      .sort((a, b) => handSizeCK(b) - handSizeCK(a))[0];
    if (target) candidates.push(play(playerId, 'guildDues', { targetId: target.id }));
  }
  if (has('commercialHarborCard')) {
    const withCommodities = state.players.filter(
      (o) => o.id !== playerId && COMMODITIES.some((c) => commoditiesOf(o)[c] > 0),
    ).length;
    let resources = 0;
    for (const r of RESOURCES) resources += p.resources[r];
    if (resources >= withCommodities && (withCommodities >= 2 || (forced && withCommodities >= 1))) {
      candidates.push(play(playerId, 'commercialHarborCard'));
    }
  }
  if (has('merchantFleet')) {
    const good = merchantFleetGood(state, playerId, forced);
    if (good) {
      candidates.push(
        (COMMODITIES as readonly string[]).includes(good)
          ? play(playerId, 'merchantFleet', { commodity: good as Commodity })
          : play(playerId, 'merchantFleet', { resource: good as Resource }),
      );
    }
  }
  if (has('merchantCard')) {
    // 1 VP + a 2:1 rate; re-placing our own merchant only when forced.
    if (state.merchant?.ownerId !== playerId || forced) candidates.push(play(playerId, 'merchantCard'));
  }

  // Hurting the leaders.
  if (has('sabotage')) {
    let lost = 0;
    for (const opp of state.players) {
      if (opp.id !== playerId && publicVp(state, opp.id) >= myVp) lost += Math.floor(handSizeCK(opp) / 2);
    }
    if (lost >= 3 || (forced && lost >= 1)) candidates.push(play(playerId, 'sabotage'));
  }
  if (has('espionage')) {
    const target = state.players
      .filter((o) => o.id !== playerId && heldProgressCards(state, o.id).length > 0)
      .sort((a, b) => heldProgressCards(state, b.id).length - heldProgressCards(state, a.id).length)[0];
    if (target && (heldProgressCards(state, target.id).length >= 2 || forced)) {
      candidates.push(play(playerId, 'espionage', { targetId: target.id }));
    }
  }
  if (has('treason')) {
    const target = treasonTarget(state, playerId);
    if (target) candidates.push(play(playerId, 'treason', { targetId: target }));
  }
  if (has('intrigue')) {
    const vertex = intrigueTarget(state, playerId);
    if (vertex) candidates.push(play(playerId, 'intrigue', { vertex }));
  }
  if (has('taxation') && state.robberActive) {
    const move = chooseRobberMove(state, playerId);
    const robbed = touchesHex(state, playerId, state.board.robberHex);
    if (move.stealFrom || robbed || forced) candidates.push(play(playerId, 'taxation'));
  }
  if (has('diplomacy') && diplomacyWorth(state, playerId, forced)) {
    candidates.push(play(playerId, 'diplomacy'));
  }
  if (has('invention')) {
    const best = bestInvention(state, playerId);
    if (best && (best.gain >= 2 || (forced && best.gain > 0))) {
      candidates.push(play(playerId, 'invention', { fromHex: best.fromHex, toHex: best.toHex }));
    }
  }

  // Knights.
  if (has('smithing')) {
    const targets = smithingTargets(state, playerId);
    if (targets.length === 2 || (targets.length === 1 && forced)) {
      candidates.push(play(playerId, 'smithing', { knightVertices: targets }));
    }
  }
  if (has('encouragement')) {
    const inactive = playerKnights(state, playerId).filter((k) => !k.knight.active).length;
    const o = barbarianOutlook(state, playerId);
    if (inactive >= 2 || (inactive >= 1 && (o.near || forced)) ) {
      candidates.push(play(playerId, 'encouragement'));
    }
  }
  if (has('progressRoadBuilding')) {
    const edges = roadBuildingEdges(state, playerId);
    if (edges.length === 2 || (edges.length === 1 && forced)) {
      candidates.push(play(playerId, 'progressRoadBuilding', { edges }));
    }
  }

  // Build enablers, only to get under the limit (the build steps play
  // them otherwise).
  if (forced) {
    if (has('crane') && p.cities.length > 0) candidates.push(play(playerId, 'crane'));
    const wall = wallSpot(state, playerId);
    if (has('engineering') && wall) candidates.push(play(playerId, 'engineering', { vertex: wall }));
  }

  return firstLegal(state, candidates);
}

// Medicine right before a city upgrade we can afford at its price: the
// card upgrades our best settlement at once (1 wheat + 2 ore).
export function tryMedicine(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (state.medicineActive) return null;
  if (!(p.progressCards?.science ?? []).includes('medicine')) return null;
  if (p.settlements.length === 0 || p.cities.length >= 4) return null;
  if (!canAfford(p.resources, COSTS.cityMedicine)) return null;
  const best = [...p.settlements].sort(
    (a, b) => vertexScore(state, b, playerId) - vertexScore(state, a, playerId),
  );
  return firstLegal(state, [
    ...best.map((vertex) => play(playerId, 'medicine', { vertex })),
    play(playerId, 'medicine'),
  ]);
}

// Crane right before an improvement it makes affordable / cheaper.
export function tryCrane(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (!(p.progressCards?.science ?? []).includes('crane')) return null;
  if (!craneTrack(state, playerId)) return null;
  return firstLegal(state, [play(playerId, 'crane')]);
}

// Engineering when a city lacks a wall: a free wall on it at once.
export function tryEngineering(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  if (state.engineeringActive) return null;
  if (!(p.progressCards?.science ?? []).includes('engineering')) return null;
  const vertex = wallSpot(state, playerId);
  if (!vertex) return null;
  return firstLegal(state, [play(playerId, 'engineering', { vertex }), play(playerId, 'engineering')]);
}

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

// Over the hand limit: drop the least useful card.
export function chooseProgressDiscard(state: GameState, playerId: PlayerId): Action | null {
  const held = heldProgressCards(state, playerId).sort(
    (a, b) => progressCardValue(state, playerId, a.card) - progressCardValue(state, playerId, b.card),
  );
  return firstLegal(
    state,
    held.map((h) => ({ type: 'discardProgressCard' as const, playerId, card: h.card, deck: h.deck })),
  );
}

// Defender-of-Catan tie: which deck to draw from. Trade has the most VP
// (Merchants), science the best economy cards; politics last.
export function chooseDefenderTieDraw(state: GameState, playerId: PlayerId): Action | null {
  const order: ImprovementTrack[] = ['trade', 'science', 'politics'];
  const decks = order.filter((d) => (state.progressDecks?.[d]?.length ?? 0) > 0);
  const list = decks.length > 0 ? decks : order;
  return firstLegal(
    state,
    list.map((deck) => ({ type: 'defenderTieDraw' as const, playerId, deck })),
  );
}

// Espionage / Guild Dues pick.
export function chooseProgressPick(state: GameState, playerId: PlayerId): Action | null {
  const ctx = state.progressPickState;
  if (!ctx || ctx.picker !== playerId) return null;
  const target = playerById(state, ctx.targetId);
  if (ctx.kind === 'espionage') {
    const cards = heldProgressCards(state, target.id).sort(
      (a, b) => progressCardValue(state, playerId, b.card) - progressCardValue(state, playerId, a.card),
    );
    return firstLegal(state, [
      ...cards.map((h) => ({ type: 'chooseProgressCardPick' as const, playerId, deck: h.deck, card: h.card })),
      { type: 'chooseProgressCardPick' as const, playerId },
    ]);
  }
  const pool: Record<CardKind, number> = { ...target.resources, ...commoditiesOf(target) };
  const take = Math.min(ctx.remaining, handSizeCK(target));
  const pick = bestCardsFrom(state, playerId, pool, take);
  return firstLegal(state, [
    { type: 'chooseProgressCardPick', playerId, resources: pick.resources, commodities: pick.commodities },
  ]);
}

// Merchant: on the hex of the resource we have most of to sell at 2:1
// (ties: the better number).
export function chooseMerchantHex(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  const options: Array<{ hex: HexId; score: number }> = [];
  for (const hexId of merchantSites(state, playerId)) {
    const t = state.board.hexes[hexId]!.terrain;
    // A non-resource hex (desert) still scores the VP, but no 2:1 rate.
    const held = (RESOURCES as readonly string[]).includes(t) ? p.resources[t as Resource] : -2;
    options.push({ hex: hexId, score: held * 1.0 + hexPips(state, hexId) * 0.4 });
  }
  options.sort((a, b) => b.score - a.score);
  return firstLegal(
    state,
    options.map((o) => ({ type: 'placeMerchant' as const, playerId, hex: o.hex })),
  );
}

// Diplomacy: remove the Longest Road holder's / leader's open road; if no
// opposing road can go, fall back to any legal removal (ours last).
export function chooseRemoveRoad(state: GameState, playerId: PlayerId): Action | null {
  const myVp = publicVp(state, playerId);
  const ranked: Array<{ edge: EdgeId; score: number }> = [];
  for (const opp of state.players) {
    for (const edge of opp.roads) {
      let score = opp.id === playerId ? -5 : 0;
      if (opp.id !== playerId) {
        if (state.longestRoad?.holder === opp.id) score += 3;
        score += (publicVp(state, opp.id) - myVp) * 0.5;
      }
      ranked.push({ edge, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return firstLegal(
    state,
    ranked.map((r) => ({ type: 'removeRoad' as const, playerId, edge: r.edge })),
  );
}

// Commercial Harbor (our card): offer each opponent, once, the resource we
// value least. An opponent without commodities just hands it back, so
// offering costs nothing.
export function tryCommercialHarborPropose(state: GameState, playerId: PlayerId): Action | null {
  const ch = state.commercialHarbor;
  if (!ch || ch.offererId !== playerId) return null;
  const p = playerById(state, playerId);
  let resources = 0;
  for (const r of RESOURCES) resources += p.resources[r];
  if (resources === 0) return null;
  const onlyResources: GameState = {
    ...state,
    players: state.players.map((pl) =>
      pl.id === playerId ? { ...pl, commodities: { paper: 0, cloth: 0, coin: 0 } } : pl,
    ),
  };
  const give = cheapestCards(onlyResources, playerId, 1).resources;
  const resource = RESOURCES.find((r) => (give[r] ?? 0) > 0);
  if (!resource) return null;
  const candidates: Action[] = [];
  for (const opp of state.players) {
    if (opp.id === playerId || ch.offeredTo.includes(opp.id)) continue;
    candidates.push({ type: 'commercialHarborPropose', playerId, targetId: opp.id, resource });
  }
  return firstLegal(state, candidates);
}

// Commercial Harbor (someone else's card): we must hand the offerer a
// commodity of our choice — the one we value least. Null only with none.
export function chooseCommercialHarborReply(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  const have = commoditiesOf(p);
  if (COMMODITIES.every((c) => have[c] === 0)) {
    return firstLegal(state, [{ type: 'commercialHarborOffer', playerId, commodity: null }]);
  }
  const onlyCommodities: GameState = {
    ...state,
    players: state.players.map((pl) =>
      pl.id === playerId ? { ...pl, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } } : pl,
    ),
  };
  const give = cheapestCards(onlyCommodities, playerId, 1).commodities;
  const first = COMMODITIES.find((x) => (give[x] ?? 0) > 0);
  const order: Commodity[] = [];
  if (first) order.push(first);
  for (const c of COMMODITIES) if (c !== first && have[c] > 0) order.push(c);
  return firstLegal(
    state,
    order.map((commodity) => ({ type: 'commercialHarborOffer' as const, playerId, commodity })),
  );
}

// Wedding: give the two cards we value least.
export function chooseWeddingGive(state: GameState, playerId: PlayerId): Action | null {
  const p = playerById(state, playerId);
  const n = Math.min(2, handSizeCK(p));
  const give = cheapestCards(state, playerId, n);
  return firstLegal(state, [
    { type: 'weddingGive', playerId, resources: give.resources, commodities: give.commodities },
  ]);
}

