// Heuristic AI personas: the all-rounder (the hand-written AI as it always
// played) plus ten styles, used as varied opponents when training the
// network. Each persona is the all-rounder with ONE dimension bent:
//
//   placement (setup only, plus the early-game follow-through for the port
//   and grief styles): which corners to start on.
//   play (the Action phase): what to build / buy and trade for first.
//
// A style only steers while its objective is unmet (e.g. Largest Army held
// by a 2-knight margin); after that the persona plays as the all-rounder,
// so every persona keeps playing to win.
//
// The persona is set for the length of one decision with `withPersona`
// (chooseAction / shouldAcceptTrade / tryCounterTrade take it as an optional
// argument) and read with `activePersona()`, so the shared scoring code
// (vertexScore, reportNeeds, the priority tree) needs no extra parameter.
// JavaScript is single-threaded and every call is synchronous, so the scope
// is exact. With no persona every hook below is a no-op: the all-rounder is
// unchanged. Personas are tuned for the base game; expansions pass through.

import type { EdgeId, GameState, PlayerId, Resource, VertexId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { getPortAtVertex } from '@/game/board/adjacency';
import { calculateRouteLength } from '@/game/engine';
import { canConnectRoad, canPlaceInitialSettlement, canPlaceSettlement } from '@/game/placement';
import { isSetupPhase } from '@/game/actions/setup';

export type PlacementStyle =
  | 'balanced'
  | 'oreWheatSheep'
  | 'woodBrick'
  | 'allFive'
  | 'highPips'
  | 'portStack'
  | 'grief';

export type PlayStyle = 'balanced' | 'longestRoad' | 'largestArmy' | 'citiesFirst' | 'expansion';

export interface HeuristicPersona {
  id: PersonaId;
  label: string;
  placement: PlacementStyle;
  play: PlayStyle;
}

export const PERSONA_IDS = [
  'allRounder',
  'oreWheatSheep',
  'woodBrick',
  'allFive',
  'highPips',
  'portStack',
  'griefer',
  'longestRoad',
  'largestArmy',
  'citiesFirst',
  'expansion',
] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

export const PERSONAS: Record<PersonaId, HeuristicPersona> = {
  allRounder: { id: 'allRounder', label: 'All-rounder', placement: 'balanced', play: 'balanced' },
  oreWheatSheep: { id: 'oreWheatSheep', label: 'Ore / wheat / sheep start', placement: 'oreWheatSheep', play: 'balanced' },
  woodBrick: { id: 'woodBrick', label: 'Wood / brick start', placement: 'woodBrick', play: 'balanced' },
  allFive: { id: 'allFive', label: 'All five resources start', placement: 'allFive', play: 'balanced' },
  highPips: { id: 'highPips', label: 'Highest pips start', placement: 'highPips', play: 'balanced' },
  portStack: { id: 'portStack', label: 'Stack a resource + its 2:1 harbor', placement: 'portStack', play: 'balanced' },
  griefer: { id: 'griefer', label: 'Griefer (crowd and cut off a rival)', placement: 'grief', play: 'balanced' },
  longestRoad: { id: 'longestRoad', label: 'Longest Road', placement: 'balanced', play: 'longestRoad' },
  largestArmy: { id: 'largestArmy', label: 'Largest Army', placement: 'balanced', play: 'largestArmy' },
  citiesFirst: { id: 'citiesFirst', label: 'Cities first', placement: 'balanced', play: 'citiesFirst' },
  expansion: { id: 'expansion', label: 'Expansion / settlements first', placement: 'balanced', play: 'expansion' },
};

export const ALL_ROUNDER = PERSONAS.allRounder;

export function isPersonaId(id: string): id is PersonaId {
  return (PERSONA_IDS as readonly string[]).includes(id);
}

let active: HeuristicPersona = ALL_ROUNDER;

/** The persona deciding right now (the all-rounder outside `withPersona`). */
export function activePersona(): HeuristicPersona {
  return active;
}

/**
 * Run `fn` as `persona`, restoring the previous one after. `undefined` keeps
 * the current persona, so internal calls (e.g. the priority tree asking
 * shouldAcceptTrade) inherit it; at the top level that is the all-rounder.
 */
export function withPersona<T>(persona: HeuristicPersona | PersonaId | undefined, fn: () => T): T {
  const prev = active;
  if (persona !== undefined) active = typeof persona === 'string' ? PERSONAS[persona] : persona;
  try {
    return fn();
  } finally {
    active = prev;
  }
}

// ---- objectives (when a play style stops steering) -------------------------

function player(state: GameState, id: PlayerId) {
  return state.players.find((p) => p.id === id)!;
}

/** Holding Longest Road with a 2-road lead (or the scenario has none). */
export function longestRoadSecured(state: GameState, id: PlayerId): boolean {
  if (state.noLongestRoad) return true;
  if (state.longestRoad?.holder !== id) return false;
  const mine = calculateRouteLength(state, id);
  const best = Math.max(0, ...state.players.filter((p) => p.id !== id).map((p) => calculateRouteLength(state, p.id)));
  return mine >= best + 2;
}

/** Holding Largest Army with a 2-knight lead (or the scenario has none). */
export function largestArmySecured(state: GameState, id: PlayerId): boolean {
  if (state.noLargestArmy) return true;
  if (state.largestArmy?.holder !== id) return false;
  const mine = player(state, id).devCards.playedKnights;
  const best = Math.max(0, ...state.players.filter((p) => p.id !== id).map((p) => p.devCards.playedKnights));
  return mine >= best + 2;
}

/** All four cities built. */
export function citiesDone(state: GameState, id: PlayerId): boolean {
  return player(state, id).cities.length >= 4;
}

/** Six buildings on the board (the two starters + four expansions) or no settlement piece left. */
export function expansionDone(state: GameState, id: PlayerId): boolean {
  const p = player(state, id);
  return p.settlements.length + p.cities.length >= 6 || p.settlements.length >= 5;
}

// ---- which VP sources are still open ------------------------------------

export interface VpSources {
  /** A city it can build on its current settlements (piece left, settlement to upgrade). */
  cityNow: boolean;
  /** A settlement spot open on its network now (piece left). */
  settleNow: boolean;
  /** Roads to the nearest free spot (0 = open now; Infinity = none within reach / no piece). */
  spotRoads: number;
  /** A settlement still possible: open now or a free spot within reach of its roads. */
  settlement: boolean;
  /** A city still possible: piece left and a settlement to upgrade, now or after a new one. */
  city: boolean;
  /** Longest Road not yet held by a margin, and still catchable. */
  longestRoad: boolean;
  /** Largest Army not yet held by a margin, and still catchable. */
  largestArmy: boolean;
  /** Roads needed to beat the best rival route (Infinity = can't). */
  roadGap: number;
  /** Knights still to play to take / keep Largest Army (Infinity = can't). */
  knightGap: number;
  /** Knights in its hand (playable for free toward knightGap). */
  knightsInHand: number;
}

const sourcesCache = new WeakMap<GameState, Map<PlayerId, VpSources>>();

/** What `id` can still score from, from public information only. Cached per state. */
export function vpSources(state: GameState, id: PlayerId): VpSources {
  let perState = sourcesCache.get(state);
  if (!perState) {
    perState = new Map();
    sourcesCache.set(state, perState);
  }
  const hit = perState.get(id);
  if (hit) return hit;
  const p = player(state, id);
  const roadsLeft = 15 - p.roads.length;
  const piece = p.settlements.length < 5;
  const settleNow = piece && state.board.vertexIds.some((v) => canPlaceSettlement(state, id, v));
  const spotRoads = !piece ? Infinity : settleNow ? 0 : roadsToFreeSpot(state, id, Math.min(2, roadsLeft));
  const settlement = spotRoads !== Infinity;
  const cityNow = p.cities.length < 4 && p.settlements.length > 0;
  const city = p.cities.length < 4 && (p.settlements.length > 0 || settlement);

  // Longest Road: roads needed to pass the best rival (each road adds at most 1).
  let roadGap = Infinity;
  if (!state.noLongestRoad && roadsLeft > 0 && state.board.edgeIds.some((e) => canConnectRoad(state, id, e))) {
    const mine = calculateRouteLength(state, id);
    const best = Math.max(0, ...state.players.filter((q) => q.id !== id).map((q) => calculateRouteLength(state, q.id)));
    const gap = Math.max(5, best + 1) - mine;
    roadGap = gap > roadsLeft || gap > 4 ? Infinity : Math.max(0, gap);
  }
  // Largest Army: knights needed vs knights it could still get (its own
  // unplayed ones + every knight it hasn't seen played or drawn).
  const knightsInHand = [...p.devCards.unplayed, ...p.devCards.boughtThisTurn].filter((c) => c === 'knight').length;
  let knightGap = Infinity;
  if (!state.noLargestArmy) {
    const totalKnights = state.players.length >= 5 ? 20 : 14;
    const played = state.players.reduce((n, q) => n + q.devCards.playedKnights, 0);
    const unseen = state.devCardDeck.length > 0 ? Math.max(0, totalKnights - played - knightsInHand) : 0;
    const best = Math.max(0, ...state.players.filter((q) => q.id !== id).map((q) => q.devCards.playedKnights));
    const gap = Math.max(3, best + 1) - p.devCards.playedKnights;
    knightGap = gap > knightsInHand + unseen || gap - knightsInHand > 4 ? Infinity : Math.max(0, gap);
  }
  const out: VpSources = {
    cityNow,
    settleNow,
    spotRoads,
    settlement,
    city,
    longestRoad: !longestRoadSecured(state, id) && roadGap !== Infinity,
    largestArmy: !largestArmySecured(state, id) && knightGap !== Infinity,
    roadGap,
    knightGap,
    knightsInHand,
  };
  perState.set(id, out);
  return out;
}

/** Can `id` build a city or a settlement on its current network (cards aside)? */
export function canBuildNow(state: GameState, id: PlayerId): boolean {
  const s = vpSources(state, id);
  return s.cityNow || s.settleNow;
}

/**
 * The play style steering `id` right now. A persona's own style steers
 * while its objective is open (not yet secured, still reachable); after
 * that it plays as the all-rounder. Any AI — the all-rounder included —
 * with nothing to build a city or settlement on (every settlement
 * upgraded, no open spot) pivots to the cheapest VP still open, priced in
 * cards per VP: roading out to a free spot (2 a road + 4 for the
 * settlement, which is also a future city), Longest Road (2 a road, for
 * 2 VP) or Largest Army (~5.4 a knight it doesn't hold yet, for 2 VP);
 * failing all of them it buys dev cards for their VP cards (as the army
 * style does).
 */
export function playStyleActive(state: GameState, id: PlayerId): PlayStyle {
  const style = active.play;
  const p = player(state, id);
  // Fast path (every reportNeeds call): the all-rounder with a settlement to upgrade.
  if (style === 'balanced' && p.cities.length < 4 && p.settlements.length > 0) return 'balanced';
  const src = vpSources(state, id);
  if (style === 'longestRoad' && src.longestRoad) return style;
  if (style === 'largestArmy' && src.largestArmy) return style;
  if (style === 'expansion' && src.settlement && !expansionDone(state, id)) return style;
  if (style === 'citiesFirst' && src.cityNow && !citiesDone(state, id)) return style;
  if (src.cityNow || src.settleNow) return 'balanced';
  // Nothing to build on: chase the cheapest VP left.
  const perVp: Array<[PlayStyle, number]> = [
    ['expansion', src.settlement ? (2 * src.spotRoads + 4) / 2 : Infinity],
    ['longestRoad', src.longestRoad ? src.roadGap : Infinity],
    ['largestArmy', src.largestArmy ? (5.4 * Math.max(0, src.knightGap - src.knightsInHand)) / 2 : Infinity],
  ];
  perVp.sort((a, b) => a[1] - b[1]);
  if (perVp[0]![1] !== Infinity) return perVp[0]![0];
  return state.devCardDeck.length > 0 ? 'largestArmy' : 'balanced';
}

/** Roads to the nearest corner free by the distance rule, within `roads` of its network (Infinity if none). */
function roadsToFreeSpot(state: GameState, id: PlayerId, roads: number): number {
  const p = player(state, id);
  const theirRoads = new Set(state.players.filter((q) => q.id !== id).flatMap((q) => q.roads));
  const rivalBuildings = new Set(state.players.filter((q) => q.id !== id).flatMap((q) => [...q.settlements, ...q.cities]));
  let frontier = new Set<VertexId>([...p.settlements, ...p.cities]);
  for (const e of p.roads) for (const v of state.board.edges[e]!.vertices) frontier.add(v);
  const seen = new Set(frontier);
  for (let step = 1; step <= roads; step++) {
    const next = new Set<VertexId>();
    for (const v of frontier) {
      if (rivalBuildings.has(v)) continue; // can't road through a rival's building
      for (const e of state.board.vertices[v]?.edges ?? []) {
        if (theirRoads.has(e)) continue;
        const edge = state.board.edges[e]!;
        if (!edge.hexes.some((h) => state.board.hexes[h]!.terrain !== 'sea')) continue;
        for (const n of edge.vertices) {
          if (seen.has(n)) continue;
          seen.add(n);
          next.add(n);
        }
      }
    }
    for (const v of next) if (canPlaceInitialSettlement(state, v)) return step;
    frontier = next;
  }
  return Infinity;
}

/** `id`'s longest route if it also had roads on `extra`. */
export function routeLengthWith(state: GameState, id: PlayerId, extra: readonly EdgeId[]): number {
  const withRoads: GameState = {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, roads: [...p.roads, ...extra] } : p)),
  };
  return calculateRouteLength(withRoads, id);
}

// ---- shared board facts for the placement styles ----------------------------

const pipsOf = (n: number | null) => (n === null ? 0 : 6 - Math.abs(7 - n));

/** Pips per resource at a corner (fog and non-producing hexes count 0). */
export function cornerPips(state: GameState, v: VertexId): Record<Resource, number> {
  const out: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const fog = new Set(state.unrevealedFogHexes ?? []);
  for (const h of state.board.vertices[v]?.hexes ?? []) {
    if (fog.has(h)) continue;
    const hex = state.board.hexes[h]!;
    if ((RESOURCES as readonly string[]).includes(hex.terrain)) out[hex.terrain as Resource] += pipsOf(hex.numberToken);
  }
  return out;
}

/** Every corner a 2:1 harbor of `r` touches. */
export function harborCorners(state: GameState, r: Resource): VertexId[] {
  const out: VertexId[] = [];
  for (const port of state.board.ports) {
    if (port.type !== r) continue;
    const e = state.board.edges[port.edge];
    if (e) out.push(...e.vertices);
  }
  return out;
}

/** Edges between two corners (0 = same corner), up to `max`, else Infinity. */
export function cornerDistance(state: GameState, from: VertexId, targets: VertexId[], max = 3): number {
  const goal = new Set(targets);
  if (goal.has(from)) return 0;
  let frontier = [from];
  const seen = new Set(frontier);
  for (let d = 1; d <= max; d++) {
    const next: VertexId[] = [];
    for (const v of frontier) {
      for (const n of state.board.vertices[v]?.neighborVertices ?? []) {
        if (seen.has(n)) continue;
        if (goal.has(n)) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/**
 * The port-stack persona's focus resource: the one it already produces most
 * that has a 2:1 harbor on the board (none yet: the 2:1 resource with the
 * richest free corners). Recomputed from the board each time — the AI keeps
 * no memory between decisions.
 */
export function portFocus(state: GameState, id: PlayerId): Resource | null {
  const withHarbor = RESOURCES.filter((r) => harborCorners(state, r).length > 0);
  if (withHarbor.length === 0) return null;
  const p = player(state, id);
  const produced: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  for (const v of [...p.settlements, ...p.cities]) {
    const pips = cornerPips(state, v);
    for (const r of RESOURCES) produced[r] += pips[r];
  }
  if (RESOURCES.some((r) => produced[r] > 0)) {
    return withHarbor.reduce((a, b) => (produced[b] > produced[a] ? b : a));
  }
  // Before any settlement: the 2:1 resource whose two best free corners
  // carry the most pips of it.
  const free = state.board.vertexIds.filter((v) => canPlaceInitialSettlement(state, v));
  let best: Resource | null = null;
  let bestValue = -1;
  for (const r of withHarbor) {
    const top = free.map((v) => cornerPips(state, v)[r]).sort((a, b) => b - a);
    const value = (top[0] ?? 0) + (top[1] ?? 0);
    if (value > bestValue) {
      bestValue = value;
      best = r;
    }
  }
  return best;
}

/** Does `id` already own a corner on a 2:1 harbor of `r`? */
export function ownsHarbor(state: GameState, id: PlayerId, r: Resource): boolean {
  const p = player(state, id);
  return [...p.settlements, ...p.cities].some((v) => getPortAtVertex(state.board, v) === r);
}

/**
 * Corners where an opponent could settle next: free by the distance rule and
 * on, or one road beyond, the edge of their network. Taking one (or a corner
 * next to it) shuts it for them — what the griefer goes for.
 */
export function rivalTargets(state: GameState, id: PlayerId): Set<VertexId> {
  const out = new Set<VertexId>();
  for (const op of state.players) {
    if (op.id === id) continue;
    const frontier = new Set<VertexId>([...op.settlements, ...op.cities]);
    for (const e of op.roads) for (const v of state.board.edges[e]!.vertices) frontier.add(v);
    for (const v of frontier) {
      for (const c of [v, ...(state.board.vertices[v]?.neighborVertices ?? [])]) {
        if (canPlaceInitialSettlement(state, c)) out.add(c);
      }
    }
  }
  return out;
}

/**
 * In-game nudge to vertexScore from the placement styles that follow
 * through after setup: the port stacker heads for its focus harbor until it
 * owns one; the griefer values corners that take a rival's next spot.
 */
export function personaVertexBonus(state: GameState, v: VertexId, id: PlayerId): number {
  if (isSetupPhase(state.phase)) return 0; // setup has its own scorers (setup.ts)
  const style = active.placement;
  if (style === 'portStack') {
    const r = portFocus(state, id);
    if (!r || ownsHarbor(state, id, r)) return 0;
    const d = cornerDistance(state, v, harborCorners(state, r), 2);
    return d === 0 ? 5 : d === 1 ? 2 : 0;
  }
  if (style === 'grief') {
    const targets = rivalTargets(state, id);
    if (targets.has(v)) return 3;
    return (state.board.vertices[v]?.neighborVertices ?? []).some((n) => targets.has(n)) ? 1.5 : 0;
  }
  return 0;
}
