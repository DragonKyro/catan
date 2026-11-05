import type { Action, EdgeId, EpLocation, EpShip, GameState, PlayerId, Resource, ResourceBank, VertexId } from '@/game/types';
import { COSTS, RESOURCES } from '@/game/types';
import { canAfford } from '@/game/resources';
import { canConnectRoad } from '@/game/placement';
import { getBankTradeRate } from '@/game/actions/trade';
import { GOLD_PER_RESOURCE, MAX_GOLD_SPENDS_PER_TURN } from '@/game/modules/traders/constants';
import { EP_COSTS, EP_TRIBUTE_GOLD } from '@/game/modules/explorersPirates/constants';
import {
  buildableShipEdges,
  canFoundAt,
  epSupply,
  farmCount,
  harborUpgradeSpots,
  harborsAtShip,
  harborsOf,
  hasRoomFor,
  hiddenHexesAtEdge,
  isUnexplored,
  pieceSpots,
  settlersOnBoard,
  shipById,
  shipsOf,
} from '@/game/modules/explorersPirates/state';
import { shouldAcceptTrade, tryProposeFavorableTrade, tryProposeTrade } from '../trade';
import { tryBankTrade } from '../main';
import { firstLegal, goldOf, handSize, leavesReserve, playerOf, sumShort } from './common';
import { EP_GOAL_COST, epNeeds, roadSettlementSpots, type EpGoal } from './needs';
import { EP_WEIGHT, crewDemand, epVertexValue, exploreValue } from './value';
import { crewsInTransit, foundTargets, planShip } from './ships';
import { edgeExplores, edgesAtVertex } from './planner';

// Action phase for the Explorers & Pirates AI. Priority tree (every action
// checked by the reducer before it's returned):
//   pending trade → harbor settlement → settlement on a road → a ship when
//   we have none (or for a settler / crews waiting on a harbor settlement
//   with no ship beside it) → a settler → crews for lairs / spice farms → a
//   second ship → a road toward open land → Fast Gold / spend gold → player
//   trades → 3:1 supply trade → buy gold to shelter a big hand → end (the
//   driver's endTurn opens the Movement phase).
// Lower builds keep the cards of the goal we're closest to (`leavesReserve`).

export function chooseEpMainAction(state: GameState, pid: PlayerId): Action | null {
  const p = playerOf(state, pid);

  if (state.pendingTrade) {
    if (state.pendingTrade.proposerId === pid) return { type: 'cancelTrade', playerId: pid };
    if (shouldAcceptTrade(state, pid)) return { type: 'acceptTrade', playerId: pid };
    return { type: 'cancelTrade', playerId: pid };
  }

  const needs = epNeeds(state, pid);
  const reserve = needs.goal !== 'none' && sumShort(needs.byResource) <= 2 ? needs.cost : null;
  const can = (goal: EpGoal) =>
    canAfford(p.resources, EP_GOAL_COST[goal]) &&
    (needs.goal === goal || leavesReserve(p.resources, EP_GOAL_COST[goal], reserve));

  // 1) Harbor settlement: +1 VP for 4 cards, no road needed.
  if (canAfford(p.resources, EP_COSTS.harbor)) {
    const a = firstLegal(
      state,
      rankHarborSpots(state, pid).map((v) => ({ type: 'epBuildHarbor' as const, playerId: pid, vertex: v })),
    );
    if (a) return a;
  }

  // 2) Settlement on our road network.
  if (canAfford(p.resources, COSTS.settlement)) {
    const spots = roadSettlementSpots(state, pid).sort(
      (a, b) => epVertexValue(state, b, pid) - epVertexValue(state, a, pid),
    );
    const a = firstLegal(state, spots.map((v) => ({ type: 'buildSettlement' as const, playerId: pid, vertex: v })));
    if (a) return a;
  }

  const ships = shipsOf(state, pid);
  const supply = epSupply(state, pid);

  // 3) A ship when we have none: nothing explores, carries or delivers.
  if (ships.length === 0 && supply.ships > 0 && canAfford(p.resources, EP_COSTS.ship)) {
    const a = buildShip(state, pid);
    if (a) return a;
  }

  // 3b) Settlers / crews waiting on a harbor settlement with no ship of ours
  //     beside it: a ship there carries them off this turn.
  if (supply.ships > 0 && canAfford(p.resources, EP_COSTS.ship)) {
    const waiting = harborsWaiting(state, pid);
    if (waiting.length > 0) {
      const a = buildShip(state, pid, waiting);
      if (a) return a;
    }
  }

  // 4) A settler: a settlement wherever a ship can carry it.
  if (
    can('settler') &&
    supply.settlers > 0 &&
    settlersOnBoard(state, pid) === 0 &&
    supply.settlements > 0 &&
    foundTargets(state, pid).some((t) => t.value >= 2)
  ) {
    const spots = rankSpots(state, pid, 'settler');
    // No ship beside a harbor to take it: build the ship first if we can
    // pay for both (the settler then goes straight onto it).
    if (
      spots.length > 0 &&
      'harbor' in spots[0]! &&
      supply.ships > 0 &&
      canAfford(p.resources, addCosts(EP_COSTS.settler, EP_COSTS.ship))
    ) {
      const a = buildShip(state, pid, [spots[0].harbor]);
      if (a) return a;
    }
    const a = firstLegal(
      state,
      spots.map((at) => ({ type: 'epBuildSettler' as const, playerId: pid, at })),
    );
    if (a) return a;
  }

  // 5) Crews for pirate lairs and spice farms we've found.
  if (can('crew') && supply.crews > 0) {
    const ships2 = Math.max(1, ships.length);
    const want = Math.min(crewDemand(state, pid), 2 * ships2);
    if (crewsInTransit(state, pid) < want) {
      const a = firstLegal(
        state,
        rankSpots(state, pid, 'crew').map((at) => ({ type: 'epBuildCrew' as const, playerId: pid, at })),
      );
      if (a) return a;
    }
  }

  // 6) A second (third) ship while there's sea to explore or work for it.
  if (supply.ships > 0 && can('ship') && wantsAnotherShip(state, pid)) {
    const a = buildShip(state, pid);
    if (a) return a;
  }

  // 7) A road toward open land.
  if (can('road') && roadSettlementSpots(state, pid).length === 0) {
    const a = buildRoad(state, pid);
    if (a) return a;
  }

  // 8) Gold: Fast Gold, then 2 gold for a card the goal is short of.
  const coin = coinAction(state, pid, needs.goal === 'none' ? null : needs.byResource);
  if (coin) return coin;

  // 9) Player trades, then the 3:1 supply.
  const favorable = tryProposeFavorableTrade(state, pid);
  if (favorable) return favorable;
  const proposal = tryProposeTrade(state, pid);
  if (proposal) return proposal;
  const bank = tryBankTrade(state, pid);
  if (bank && firstLegal(state, [bank])) return bank;

  // 10) A hand of 9+ with nothing to build: shelter some of it as gold.
  if (handSize(state, pid) >= 9) {
    const a = shelterAsGold(state, pid);
    if (a) return a;
  }
  return null;
}

// ----- Builds -----

// Coastal settlements to upgrade, best base for ships first: the most sea
// edges, then closest to the unexplored regions / missions.
function rankHarborSpots(state: GameState, pid: PlayerId): VertexId[] {
  return harborUpgradeSpots(state, pid)
    .map((v) => ({ v, score: edgesAtVertex(state, v).length + epVertexValue(state, v, pid) * 0.05 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.v);
}

// Where a new settler / crew goes: a ship next to a harbor (it can sail this
// turn) before the harbor itself; crews onto a ship already carrying crews.
// Crews only wait on harbor settlements two at a time (more just sit there).
function rankSpots(state: GameState, pid: PlayerId, piece: 'settler' | 'crew'): EpLocation[] {
  const ep = state.explorersPirates!;
  const waitingCrews = harborsOf(state, pid).reduce(
    (n, h) => n + (ep.harbors[h] ?? []).filter((c) => c === 'crew').length,
    0,
  );
  const spots = pieceSpots(state, pid, piece, true).filter(
    (at) => !('harbor' in at) || piece === 'settler' || waitingCrews < 2,
  );
  const score = (at: EpLocation): number => {
    if ('harbor' in at) return 0;
    const ship = shipById(state, at.ship);
    if (!ship) return -1;
    return 2 + ship.cargo.filter((c) => c === piece).length;
  };
  return spots.sort((a, b) => score(b) - score(a));
}

function wantsAnotherShip(state: GameState, pid: PlayerId): boolean {
  const ships = shipsOf(state, pid).length;
  const ep = state.explorersPirates!;
  const hidden = state.board.hexIds.some((h) => isUnexplored(state, h));
  const work = crewDemand(state, pid) > 0 || ep.shoals.length > 0 || ep.farms.some((f) => f.sacks.includes(pid));
  if (ships < 2) return hidden || work;
  return ships < 3 && hidden && work && handSize(state, pid) >= 6;
}

// Harbor settlements holding a settler / crews with none of our ships
// beside them that has room to load them.
function harborsWaiting(state: GameState, pid: PlayerId): VertexId[] {
  const ep = state.explorersPirates!;
  const ships = shipsOf(state, pid);
  const settlerUseful = foundTargets(state, pid).length > 0;
  const crewUseful = crewDemand(state, pid) > 0;
  return harborsOf(state, pid).filter((h) => {
    const stored = ep.harbors[h] ?? [];
    const piece = stored.includes('settler') && settlerUseful ? 'settler' : stored.includes('crew') && crewUseful ? 'crew' : null;
    if (!piece) return false;
    return !ships.some((s) => harborsAtShip(state, s).includes(h) && hasRoomFor(s.cargo, [piece]));
  });
}

function addCosts(a: Partial<ResourceBank>, b: Partial<ResourceBank>): Partial<ResourceBank> {
  const out: Partial<ResourceBank> = {};
  for (const r of RESOURCES) out[r] = (a[r] ?? 0) + (b[r] ?? 0);
  return out;
}

// Build a ship on the harbor edge whose plan looks best (an edge that turns
// hexes over right away scores their exploration value). `at` limits it to
// edges beside those harbor settlements.
function buildShip(state: GameState, pid: PlayerId, at?: readonly VertexId[]): Action | null {
  const edges = buildableShipEdges(state, pid).filter(
    (e) => !at || state.board.edges[e]!.vertices.some((v) => at.includes(v)),
  );
  const scored = edges.map((edge) => {
    const probe: EpShip = { id: '__new__', owner: pid, edge, cargo: [] };
    let score = planShip(state, probe)?.score ?? 0;
    if (edgeExplores(state, edge)) {
      score += hiddenHexesAtEdge(state, edge).reduce((n, h) => n + exploreValue(state, h), 0);
    }
    return { edge, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return firstLegal(
    state,
    scored.map((s) => ({ type: 'epBuildShip' as const, playerId: pid, edge: s.edge })),
  );
}

// A road from our network toward the best open intersection one or two
// roads away.
function buildRoad(state: GameState, pid: PlayerId): Action | null {
  const p = playerOf(state, pid);
  if (p.roads.length >= 15 || epSupply(state, pid).settlements <= 0) return null;
  let best: { edge: EdgeId; score: number } | null = null;
  for (const e of state.board.edgeIds) {
    if (!canConnectRoad(state, pid, e)) continue;
    let score = -Infinity;
    for (const v of state.board.edges[e]!.vertices) {
      if (canFoundAt(state, pid, v)) score = Math.max(score, epVertexValue(state, v, pid));
      for (const n of state.board.vertices[v]!.neighborVertices) {
        if (state.board.edges[e]!.vertices.includes(n)) continue;
        if (canFoundAt(state, pid, n)) score = Math.max(score, 0.6 * epVertexValue(state, n, pid));
      }
    }
    if (score > (best?.score ?? -Infinity)) best = { edge: e, score };
  }
  if (!best || best.score < 3) return null;
  return firstLegal(state, [{ type: 'buildRoad', playerId: pid, edge: best.edge }]);
}

// ----- Gold -----

// Gold to keep for the pirate's tribute when an opponent's pirate is out
// and we have ships.
function tributeReserve(state: GameState, pid: PlayerId): number {
  const pirate = state.explorersPirates?.pirate;
  return pirate && pirate.owner !== pid && shipsOf(state, pid).length > 0 ? EP_TRIBUTE_GOLD : 0;
}

function coinAction(state: GameState, pid: PlayerId, short: Record<Resource, number> | null): Action | null {
  const gold = goldOf(state, pid) - tributeReserve(state, pid);
  const spendsLeft = MAX_GOLD_SPENDS_PER_TURN - (state.goldSpendsThisTurn ?? 0);
  const missing = short ? sumShort(short) : 0;

  // Fast Gold: a spare card for 1 gold (with 2 gold buying a card, two spare
  // cards become one we need — better than the 3:1 supply).
  const fastLeft = farmCount(state, pid, 'fastGold') - (state.explorersPirates?.fastGoldUsed ?? 0);
  if (fastLeft > 0 && (missing > 0 || handSize(state, pid) >= 8)) {
    const give = spareCard(state, pid, short);
    if (give) {
      const a = firstLegal(state, [{ type: 'epFastGold', playerId: pid, give }]);
      if (a) return a;
    }
  }

  // Spend 2 gold for the card we're most short of when it finishes the goal
  // this turn (or gold is piling up).
  if (short && missing > 0 && spendsLeft > 0 && gold >= GOLD_PER_RESOURCE) {
    const coverable = Math.min(spendsLeft, Math.floor(gold / GOLD_PER_RESOURCE));
    if (missing <= coverable || gold >= 5) {
      const want = RESOURCES.filter((r) => short[r] > 0 && state.bank[r] > 0).sort((a, b) => short[b] - short[a])[0];
      if (want) {
        const a = firstLegal(state, [{ type: 'spendGold', playerId: pid, resource: want }]);
        if (a) return a;
      }
    }
  }

  // No gold for the tribute but ships at sea and an opponent's pirate out:
  // buy one with spare cards.
  if (goldOf(state, pid) === 0 && tributeReserve(state, pid) > 0 && handSize(state, pid) >= 5) {
    const a = buyGoldWithSpare(state, pid, short);
    if (a) return a;
  }
  return null;
}

// The card we can best spare: most copies beyond what the goal needs.
function spareCard(state: GameState, pid: PlayerId, short: Record<Resource, number> | null): Resource | null {
  const p = playerOf(state, pid);
  const needs = epNeeds(state, pid);
  let best: { r: Resource; score: number } | null = null;
  for (const r of RESOURCES) {
    const keep = needs.cost?.[r] ?? 0;
    const spare = p.resources[r] - keep;
    if (spare <= 0 || (short && short[r] > 0)) continue;
    const score = spare - EP_WEIGHT[r] * 0.5;
    if (!best || score > best.score) best = { r, score };
  }
  return best?.r ?? null;
}

function buyGoldWithSpare(state: GameState, pid: PlayerId, short: Record<Resource, number> | null): Action | null {
  const p = playerOf(state, pid);
  const needs = epNeeds(state, pid);
  const options = RESOURCES.filter((r) => {
    const rate = getBankTradeRate(state, pid, r);
    const keep = needs.cost?.[r] ?? 0;
    return p.resources[r] - keep >= rate && !(short && short[r] > 0);
  }).sort((a, b) => p.resources[b] - p.resources[a]);
  return firstLegal(state, options.map((give) => ({ type: 'buyGold' as const, playerId: pid, give })));
}

function shelterAsGold(state: GameState, pid: PlayerId): Action | null {
  const p = playerOf(state, pid);
  const options = RESOURCES.filter((r) => p.resources[r] >= getBankTradeRate(state, pid, r)).sort(
    (a, b) => p.resources[b] - p.resources[a],
  );
  return firstLegal(state, options.map((give) => ({ type: 'buyGold' as const, playerId: pid, give })));
}
