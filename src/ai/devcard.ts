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
import { reportNeeds } from './value';

// Choose which dev card (if any) to play. Returns null if we shouldn't
// play a card right now.
export function chooseDevCardPlay(state: GameState, playerId: PlayerId): Action | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (state.hasPlayedDevCardThisTurn) return null;
  const cards = player.devCards.unplayed;
  if (cards.length === 0) return null;

  // 1) Knight if robber sits on one of our hexes (defensive)
  if (cards.includes('knight')) {
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

  // 2) Knight if we're 1 away from largest army (or holding it)
  if (cards.includes('knight')) {
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
      if (wanted.length === 2 && state.bank[wanted[0]!] >= 1 && state.bank[wanted[1]!] >= 1) {
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
    const legalEdges: EdgeId[] = [];
    for (const eid of state.board.edgeIds) {
      if (canConnectRoad(state, playerId, eid)) {
        legalEdges.push(eid);
        if (legalEdges.length >= 2) break;
      }
    }
    if (legalEdges.length >= 1) {
      return {
        type: 'playRoadBuilding',
        playerId,
        edges:
          legalEdges.length >= 2
            ? [legalEdges[0]!, legalEdges[1]!]
            : [legalEdges[0]!],
      };
    }
  }

  return null;
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
