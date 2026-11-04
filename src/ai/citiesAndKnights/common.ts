import type {
  Action,
  Commodity,
  CommodityBank,
  GameState,
  Player,
  PlayerId,
  VertexId,
} from '@/game/types';
import { applyAction } from '@/game/engine';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { totalResources } from '@/game/resources';
import { totalCommodities } from '@/game/commodities';
import { calculateVictoryPoints } from '@/game/scoring/points';

// Shared helpers for the Cities & Knights heuristic AI. Pure: no React, no
// store, no randomness.

export function isCitiesAndKnights(state: GameState): boolean {
  return state.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
}

const NO_COMMODITIES: CommodityBank = { paper: 0, cloth: 0, coin: 0 };

export function commoditiesOf(player: Player): CommodityBank {
  return player.commodities ?? NO_COMMODITIES;
}

// Cards that count toward the 7-roll discard / robber steals in C&K:
// resources + commodities (never progress cards).
export function handSizeCK(player: Player): number {
  return totalResources(player.resources) + totalCommodities(commoditiesOf(player));
}

export function playerById(state: GameState, id: PlayerId): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

export function publicVp(state: GameState, id: PlayerId): number {
  return calculateVictoryPoints(state, id, true);
}

// The engine is the authority on legality: an action is legal iff the
// reducer accepts it. The AI only runs this on the one or few actions it is
// about to return, so the cost (one reducer pass) stays small.
export function isLegal(state: GameState, action: Action): boolean {
  try {
    applyAction(state, action);
    return true;
  } catch {
    return false;
  }
}

// First action in `candidates` the engine accepts, or null.
export function firstLegal(
  state: GameState,
  candidates: Iterable<Action | null | undefined>,
): Action | null {
  for (const a of candidates) {
    if (a && isLegal(state, a)) return a;
  }
  return null;
}

// Every vertex touching `hexId`.
export function hexCorners(state: GameState, hexId: string): VertexId[] {
  const hex = state.board.hexes[hexId];
  if (hex?.corners?.length) return hex.corners;
  const out: VertexId[] = [];
  for (const v of Object.values(state.board.vertices)) {
    if (v.hexes.includes(hexId)) out.push(v.id);
  }
  return out;
}

// True when one of `playerId`'s buildings touches `hexId`.
export function touchesHex(state: GameState, playerId: PlayerId, hexId: string): boolean {
  const p = playerById(state, playerId);
  for (const v of hexCorners(state, hexId)) {
    if (p.settlements.includes(v) || p.cities.includes(v)) return true;
  }
  return false;
}

// Expected production weight of a hex (pips: 5 for a 6/8 … 1 for a
// 2/12), 0 when it has no number. Same scale as `probabilityDots`.
export function hexPips(state: GameState, hexId: string): number {
  const token = state.board.hexes[hexId]?.numberToken;
  if (token == null) return 0;
  return 6 - Math.abs(7 - token);
}

// Commodity pips a player's CITIES produce, by commodity. Cities on
// forest / pasture / mountains yield paper / cloth / coin.
export function commodityPips(state: GameState, playerId: PlayerId): Record<Commodity, number> {
  const out: Record<Commodity, number> = { paper: 0, cloth: 0, coin: 0 };
  const p = playerById(state, playerId);
  for (const vid of p.cities) {
    const v = state.board.vertices[vid];
    if (!v) continue;
    for (const hexId of v.hexes) {
      if (hexId === state.board.robberHex) continue;
      const c = commodityOfTerrain(state.board.hexes[hexId]?.terrain);
      if (c) out[c] += hexPips(state, hexId);
    }
  }
  return out;
}

export function commodityOfTerrain(terrain: string | undefined): Commodity | null {
  if (terrain === 'wood') return 'paper';
  if (terrain === 'sheep') return 'cloth';
  if (terrain === 'ore') return 'coin';
  return null;
}
