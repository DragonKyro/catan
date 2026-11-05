import type {
  CommodityGood,
  CommodityLocation,
  CommodityLocationId,
  EdgeId,
  GameState,
  PlayerId,
  TbEvent,
  TbWagon,
  TradersBarbariansState,
  VertexId,
} from '../../../types';
import {
  TB_FULL_UPGRADE_VP,
  TB_GOOD_DESTINATION,
  TB_MAX_WAGON_LEVEL,
  TB_MP_BARBARIAN,
  TB_MP_NO_ROAD,
  TB_MP_ROAD,
  TB_TOLL_GOLD,
  TB_WAGON_LEVELS,
  type TbWagonLevel,
} from './constants';

// Read helpers for the Traders & Barbarians scenario. The engine, the AI and
// the UI all go through these so they agree on costs and legality.

export type TradersBarbariansGame = GameState & { tradersBarbarians: TradersBarbariansState };

export function isTradersBarbarians(state: GameState): state is TradersBarbariansGame {
  return state.tradersBarbarians !== undefined;
}

export function patchTradersBarbarians(
  state: TradersBarbariansGame,
  fn: (tb: TradersBarbariansState) => TradersBarbariansState,
): TradersBarbariansGame {
  return { ...state, tradersBarbarians: fn(state.tradersBarbarians) };
}

// Record a batch of events for the log (see TradersBarbariansState.lastEvents).
export function pushTbEvents(state: TradersBarbariansGame, events: TbEvent[]): TradersBarbariansGame {
  if (events.length === 0) return state;
  const seq = (state.tradersBarbarians.lastEvents?.seq ?? 0) + 1;
  return patchTradersBarbarians(state, (tb) => ({ ...tb, lastEvents: { seq, events } }));
}

export function wagonOf(state: GameState, playerId: PlayerId): TbWagon | undefined {
  return state.tradersBarbarians?.wagons[playerId];
}

export function wagonLevelOf(state: GameState, playerId: PlayerId): number {
  return wagonOf(state, playerId)?.level ?? 1;
}

export function wagonLevelInfo(level: number): TbWagonLevel {
  const i = Math.min(Math.max(level, 1), TB_MAX_WAGON_LEVEL) - 1;
  return TB_WAGON_LEVELS[i]!;
}

export function locationById(
  state: GameState,
  id: CommodityLocationId,
): CommodityLocation | undefined {
  return state.tradersBarbarians?.locations.find((l) => l.id === id);
}

export function locationAtPlaza(state: GameState, vertex: VertexId): CommodityLocation | undefined {
  return state.tradersBarbarians?.locations.find((l) => l.plaza === vertex);
}

export function isPlaza(state: GameState, vertex: VertexId): boolean {
  return locationAtPlaza(state, vertex) !== undefined;
}

export function destinationOf(good: CommodityGood): CommodityLocationId {
  return TB_GOOD_DESTINATION[good];
}

// Index of the barbarian on `edge`, or -1.
export function barbarianOnEdge(state: GameState, edge: EdgeId): number {
  return state.tradersBarbarians?.barbarians.indexOf(edge) ?? -1;
}

export function roadOwner(state: GameState, edge: EdgeId): PlayerId | null {
  for (const p of state.players) if (p.roads.includes(edge)) return p.id;
  return null;
}

// The edge joining two intersections, if any.
export function edgeBetween(state: GameState, a: VertexId, b: VertexId): EdgeId | null {
  for (const eid of state.board.vertices[a]?.edges ?? []) {
    const e = state.board.edges[eid];
    if (e && e.vertices.includes(b)) return eid;
  }
  return null;
}

export interface WagonEdgeCost {
  mp: number;
  // The rival whose road this is: 1 gold goes to them.
  toll: PlayerId | null;
}

// "2 MP if the edge does not have a road. 1 MP if the edge has one of your
// roads. 1 MP + 1 gold if the edge has another player's road. +2 MP if the
// edge also has a barbarian." With Catan Event Cards, a road turned sideways
// by an Earthquake costs 2 MP (rulebook p. 24) — read as "like no road", so
// no toll is due on it.
export function wagonEdgeCost(state: GameState, playerId: PlayerId, edge: EdgeId): WagonEdgeCost {
  const owner = roadOwner(state, edge);
  const damaged = state.damagedRoads?.includes(edge) ?? false;
  let mp: number;
  let toll: PlayerId | null = null;
  if (!owner || damaged) mp = TB_MP_NO_ROAD;
  else {
    mp = TB_MP_ROAD;
    if (owner !== playerId) toll = owner;
  }
  if (barbarianOnEdge(state, edge) >= 0) mp += TB_MP_BARBARIAN;
  return { mp, toll };
}

export interface WagonStep {
  to: VertexId;
  edge: EdgeId;
  mp: number;
  toll: PlayerId | null;
}

// Every edge the wagon could take next from `from`, with its cost (no
// affordability check).
export function wagonStepsFrom(state: GameState, playerId: PlayerId, from: VertexId): WagonStep[] {
  const out: WagonStep[] = [];
  const v = state.board.vertices[from];
  if (!v) return out;
  for (const eid of v.edges) {
    const e = state.board.edges[eid];
    if (!e) continue;
    const to = e.vertices[0] === from ? e.vertices[1] : e.vertices[0];
    const cost = wagonEdgeCost(state, playerId, eid);
    out.push({ to, edge: eid, mp: cost.mp, toll: cost.toll });
  }
  return out;
}

// The legal next steps right now (phase 'wagonMoves'): affordable in MP
// and, on a rival's road, in gold.
export function legalWagonSteps(state: GameState, playerId: PlayerId): WagonStep[] {
  const tb = state.tradersBarbarians;
  const turn = tb?.wagonTurn;
  const wagon = tb?.wagons[playerId];
  if (!tb || !turn || !wagon || turn.ended) return [];
  if (state.phase !== 'wagonMoves') return [];
  const gold = state.players.find((p) => p.id === playerId)?.gold ?? 0;
  return wagonStepsFrom(state, playerId, wagon.vertex).filter(
    (s) => s.mp <= turn.mp && (s.toll === null || gold >= TB_TOLL_GOLD),
  );
}

// Barbarians the wagon may try to drive off now: on an edge touching the
// wagon's intersection, not tried this turn, and the wagon is upgraded.
export function driveOffTargets(state: GameState, playerId: PlayerId): number[] {
  const tb = state.tradersBarbarians;
  const turn = tb?.wagonTurn;
  const wagon = tb?.wagons[playerId];
  if (!tb || !turn || !wagon || turn.ended || state.phase !== 'wagonMoves') return [];
  if (wagonLevelInfo(wagon.level).driveOffMin === null) return [];
  const out: number[] = [];
  tb.barbarians.forEach((edge, i) => {
    if (turn.triedBarbarians.includes(i)) return;
    if (state.board.edges[edge]?.vertices.includes(wagon.vertex)) out.push(i);
  });
  return out;
}

// Edges a barbarian may be moved to: any edge on the island (coast, inner,
// interior paths, X edges) without a barbarian.
export function barbarianTargetEdges(state: GameState): EdgeId[] {
  const tb = state.tradersBarbarians;
  if (!tb) return [];
  const taken = new Set(tb.barbarians);
  return state.board.edgeIds.filter((eid) => {
    if (taken.has(eid)) return false;
    const e = state.board.edges[eid]!;
    return e.hexes.some((h) => state.board.hexes[h]?.terrain !== 'sea');
  });
}

// Swift Journey cards the player may play now.
export function swiftJourneysHeld(state: GameState, playerId: PlayerId): number {
  return state.tradersBarbarians?.swiftJourney[playerId]?.unplayed ?? 0;
}

// Every card the player holds in this scenario's deck (for counts shown to
// others): base-type cards plus Swift Journeys.
export function tbHiddenCardCount(state: GameState, playerId: PlayerId): number {
  const sj = state.tradersBarbarians?.swiftJourney[playerId];
  return (sj?.unplayed ?? 0) + (sj?.boughtThisTurn ?? 0);
}

// VP: 1 per delivered token, +1 for a fully upgraded wagon.
export function calculateTradersBarbariansVp(state: GameState, playerId: PlayerId): number {
  const wagon = wagonOf(state, playerId);
  if (!wagon) return 0;
  return wagon.delivered + (wagon.level >= TB_MAX_WAGON_LEVEL ? TB_FULL_UPGRADE_VP : 0);
}
