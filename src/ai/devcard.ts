import type {
  GameState,
  PlayerId,
  Action,
  Resource,
  ResourceBank,
  EdgeId,
} from '@/game/types';
import { RESOURCES } from '@/game/types';
import { canConnectRoad } from '@/game/placement';
import { canBuildShip } from '@/game/modules/seafarers/validation/shipPlacement';
import {
  pirateIslandsShipViolation,
  shipToConvert,
} from '@/game/modules/seafarers/pirateIslands';
import { reportNeeds } from './value';
import { playStyleActive, routeLengthWith } from './persona';

// Choose which dev card (if any) to play. Returns null if we shouldn't
// play a card right now.
export function chooseDevCardPlay(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (state.hasPlayedDevCardThisTurn) return null;
  const cards = player.devCards.unplayed;
  if (cards.length === 0) return null;

  // Pirate Islands: Knights only turn ships into warships — always worth it
  // while we have a normal ship to convert (before the roll, too, so the
  // new warship counts against this turn's fleet attack).
  if (state.pirateIslands) {
    if (cards.includes('knight') && shipToConvert(state, playerId)) {
      return { type: 'playKnight', playerId };
    }
  }

  // 1) Knight if robber sits on one of our hexes (defensive)
  if (cards.includes('knight') && !state.pirateIslands && (state.robberActive ?? true)) {
    const robberHex = state.board.robberHex;
    let robberHurtsUs = false;
    for (const v of Object.values(state.board.vertices)) {
      if (!v.hexes.includes(robberHex)) continue;
      if (
        player.settlements.includes(v.id) ||
        player.cities.includes(v.id)
      ) {
        robberHurtsUs = true;
        break;
      }
    }
    if (robberHurtsUs) {
      return { type: 'playKnight', playerId };
    }
  }

  // 1.5) Largest Army style (persona.ts): a knight every turn it can until
  //      the army is secure.
  if (
    cards.includes('knight') &&
    !state.noLargestArmy &&
    !state.pirateIslands &&
    (state.robberActive ?? true) &&
    playStyleActive(state, playerId) === 'largestArmy'
  ) {
    return { type: 'playKnight', playerId };
  }

  // 2) Knight if we're 1 away from largest army (or holding it)
  if (cards.includes('knight') && !state.noLargestArmy && !state.pirateIslands) {
    const army = state.largestArmy;
    const targetSize = army ? army.size + 1 : 3;
    if (player.devCards.playedKnights + 1 >= targetSize) {
      return { type: 'playKnight', playerId };
    }
  }

  // 3) Year of Plenty if it unlocks a build for us
  if (cards.includes('yearOfPlenty')) {
    const needs = reportNeeds(state, playerId);
    if (needs.goal !== 'none') {
      const wanted: Resource[] = [];
      for (const r of RESOURCES) {
        const need = needs.byResource[r];
        for (let i = 0; i < need && wanted.length < 2; i++) wanted.push(r);
      }
      // Two of the same resource needs two in the bank.
      const bankHas = wanted[0] === wanted[1]
        ? state.bank[wanted[0]!] >= 2
        : state.bank[wanted[0]!] >= 1 && state.bank[wanted[1]!] >= 1;
      if (wanted.length === 2 && bankHas) {
        return {
          type: 'playYearOfPlenty',
          playerId,
          resources: [wanted[0]!, wanted[1]!],
        };
      }
      if (wanted.length === 1 && state.bank[wanted[0]!] >= 2) {
        return {
          type: 'playYearOfPlenty',
          playerId,
          resources: [wanted[0]!, wanted[0]!],
        };
      }
    }
  }

  // 4) Monopoly if opponents are hoarding one resource and we'd benefit
  if (cards.includes('monopoly')) {
    let bestResource: Resource | null = null;
    let bestAmount = 2; // threshold
    for (const r of RESOURCES) {
      let total = 0;
      for (const p of state.players) {
        if (p.id === playerId) continue;
        total += p.resources[r];
      }
      if (total > bestAmount) {
        bestAmount = total;
        bestResource = r;
      }
    }
    if (bestResource) {
      return { type: 'playMonopoly', playerId, resource: bestResource };
    }
  }

  // 5) Road Building if we have at least one productive road to place
  if (cards.includes('roadBuilding') && player.roads.length < 14) {
    const legalEdges: EdgeId[] =
      playStyleActive(state, playerId) === 'longestRoad'
        ? longestRouteEdges(state, playerId)
        : firstLegalEdges(state, playerId);
    // Seafarers: the card builds ships too — top up with a ship when
    // there's no second road to place.
    const shipEdges: EdgeId[] = [];
    if (legalEdges.length < 2 && state.settings.expansions.includes('seafarers')) {
      for (const eid of state.board.edgeIds) {
        if (!canBuildShip(state, playerId, eid)) continue;
        if (pirateIslandsShipViolation(state, playerId, eid)) continue;
        shipEdges.push(eid);
        break;
      }
    }
    if (legalEdges.length + shipEdges.length >= 1) {
      return {
        type: 'playRoadBuilding',
        playerId,
        edges: legalEdges.slice(0, 2),
        ...(shipEdges.length > 0 ? { ships: shipEdges } : {}),
      };
    }
  }

  return null;
}

/** The all-rounder's Road Building roads: the first two that fit. */
function firstLegalEdges(state: GameState, playerId: PlayerId): EdgeId[] {
  const out: EdgeId[] = [];
  for (const eid of state.board.edgeIds) {
    if (canConnectRoad(state, playerId, eid)) {
      out.push(eid);
      if (out.length >= 2) break;
    }
  }
  return out;
}

/** Longest Road style: two roads, each the one that lengthens the route most. */
function longestRouteEdges(state: GameState, playerId: PlayerId): EdgeId[] {
  const out: EdgeId[] = [];
  let s = state;
  for (let k = 0; k < 2; k++) {
    let best: EdgeId | null = null;
    let bestLen = -1;
    for (const eid of s.board.edgeIds) {
      if (!canConnectRoad(s, playerId, eid)) continue;
      const len = routeLengthWith(s, playerId, [eid]);
      if (len > bestLen) {
        bestLen = len;
        best = eid;
      }
    }
    if (!best) break;
    out.push(best);
    const placed = best;
    s = { ...s, players: s.players.map((p) => (p.id === playerId ? { ...p, roads: [...p.roads, placed] } : p)) };
  }
  return out;
}

// Helper so main.ts can ask for a candidate resource basket worth taking with YoP
export function yoPCandidate(
  state: GameState,
  playerId: PlayerId,
): [Resource, Resource] | null {
  const needs = reportNeeds(state, playerId);
  if (needs.goal === 'none') return null;
  const wanted: Resource[] = [];
  for (const r of RESOURCES) {
    const n = needs.byResource[r];
    for (let i = 0; i < n && wanted.length < 2; i++) wanted.push(r);
  }
  if (wanted.length === 2) return [wanted[0]!, wanted[1]!];
  if (wanted.length === 1) return [wanted[0]!, wanted[0]!];
  return null;
}

// Re-export for the dispatcher
export type { ResourceBank };
