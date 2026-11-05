import type {
  Commodity,
  CommodityBank,
  GameState,
  PlayerId,
  Resource,
  ResourceBank,
  VertexId,
} from '../../types';
import { COMMODITIES, RESOURCES, TERRAIN_TO_COMMODITY } from '../../types';
import { updatePlayer } from '../../helpers';
import { addResources, subtractResources, totalResources } from '../../resources';
import { addCommodities, subtractCommodities, totalCommodities } from '../../commodities';
import { aqueductActive } from './improvements/state';
import { CITY_WALL_HAND_BONUS } from './constants';

const NO_COMMODITIES: CommodityBank = { paper: 0, cloth: 0, coin: 0 };

// Cards a player may hold before a 7 makes them discard (p.7-8): 7, plus 2
// per city wall.
export function handLimitOnSeven(state: GameState, playerId: PlayerId): number {
  const p = state.players.find((pl) => pl.id === playerId);
  return 7 + CITY_WALL_HAND_BONUS * (p?.cityWalls ?? 0);
}

// Resource + commodity cards in hand (what a 7, the robber and Sabotage see).
export function ckHandSize(state: GameState, playerId: PlayerId): number {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return 0;
  return totalResources(p.resources) + totalCommodities(p.commodities ?? NO_COMMODITIES);
}

// The Production phase for a rolled total: either Resolve a 7 (discards,
// then the robber once it's on the board) or collect resources and
// commodities, followed by Aqueduct picks for science-3 players who got
// nothing. Leaves the interactive steps pending for `resumeFlow`.
export function runProduction(state: GameState, total: number): GameState {
  if (total === 7) return setupSevenRoll(state);
  const after = distributeWithCommodities(state, total);
  return queueAqueductPicks(state, after);
}

// Resolve a 7 (p.7): no hex produces. Every player holding more than their
// limit (resources + commodities) returns half, rounded down. The robber
// only moves once it has been placed on the board by the first barbarian
// attack; until then a 7 steals nothing.
export function setupSevenRoll(state: GameState): GameState {
  const required: Record<PlayerId, number> = {};
  for (const p of state.players) {
    const size = ckHandSize(state, p.id);
    if (size > handLimitOnSeven(state, p.id)) required[p.id] = Math.floor(size / 2);
  }
  return {
    ...state,
    ...(Object.keys(required).length > 0 ? { discardState: { required } } : {}),
    ...(state.robberActive
      ? { pendingRobberMove: { reason: 'sevenRoll' as const, returnTo: 'main' as const } }
      : {}),
  };
}

// Aqueduct (science level 3, p.8): "If you receive no cards during the
// Production phase, you may take 1 resource card of your choice (except
// when a 7 is rolled)." Queued in turn order from the active player.
function queueAqueductPicks(before: GameState, after: GameState): GameState {
  const queue: PlayerId[] = [];
  const n = after.playerOrder.length;
  for (let i = 0; i < n; i++) {
    const pid = after.playerOrder[(after.currentPlayerIndex + i) % n]!;
    if (!aqueductActive(after, pid)) continue;
    if (ckHandSize(after, pid) === ckHandSize(before, pid)) queue.push(pid);
  }
  return queue.length > 0 ? { ...after, pendingAqueduct: queue } : after;
}

// Cities & Knights production (p.7):
//   - Settlements yield 1 resource per adjacent producing hex.
//   - Cities yield 2 of the resource on hills (brick) and fields (wheat);
//     on forest / pasture / mountains 1 resource + 1 commodity
//     (paper / cloth / coin).
//   - The robber's hex produces nothing once the robber is on the board.
//   - Supply shortages apply per resource and per commodity, as in CATAN.
export function distributeWithCommodities(state: GameState, rolled: number): GameState {
  const resGrants = new Map<PlayerId, Record<Resource, number>>();
  const comGrants = new Map<PlayerId, Record<Commodity, number>>();
  for (const p of state.players) {
    resGrants.set(p.id, { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    comGrants.set(p.id, { paper: 0, cloth: 0, coin: 0 });
  }
  const robberOnBoard = state.robberActive ?? true;

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.numberToken !== rolled) continue;
    if (!(RESOURCES as readonly string[]).includes(hex.terrain)) continue;
    if (robberOnBoard && hex.id === state.board.robberHex) continue;

    const corners: VertexId[] = hex.corners;
    const resource = hex.terrain as Resource;
    const commodity = TERRAIN_TO_COMMODITY[resource];

    for (const vid of corners) {
      for (const p of state.players) {
        if (p.settlements.includes(vid)) {
          resGrants.get(p.id)![resource] += 1;
        } else if (p.cities.includes(vid)) {
          if (commodity) {
            resGrants.get(p.id)![resource] += 1;
            comGrants.get(p.id)![commodity] += 1;
          } else {
            resGrants.get(p.id)![resource] += 2;
          }
        }
      }
    }
  }

  // Supply shortage: if the supply can't cover everyone, nobody gets that
  // card — unless only one player is owed it, who takes what's left.
  limitBySupply(state, resGrants, RESOURCES, state.bank);
  const cBank = state.commodityBank ?? NO_COMMODITIES;
  limitBySupply(state, comGrants, COMMODITIES, cBank);

  let next: GameState = state;
  const resOut: Partial<ResourceBank> = {};
  const comOut: Partial<CommodityBank> = {};
  for (const p of state.players) {
    const rg = resGrants.get(p.id)!;
    const cg = comGrants.get(p.id)!;
    const anyR = RESOURCES.some((r) => rg[r] > 0);
    const anyC = COMMODITIES.some((c) => cg[c] > 0);
    if (!anyR && !anyC) continue;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      resources: anyR ? addResources(pl.resources, rg) : pl.resources,
      commodities: anyC ? addCommodities(pl.commodities ?? NO_COMMODITIES, cg) : pl.commodities,
    }));
    for (const r of RESOURCES) if (rg[r] > 0) resOut[r] = (resOut[r] ?? 0) + rg[r];
    for (const c of COMMODITIES) if (cg[c] > 0) comOut[c] = (comOut[c] ?? 0) + cg[c];
  }
  return {
    ...next,
    bank: subtractResources(next.bank, resOut),
    commodityBank: subtractCommodities(cBank, comOut),
  };
}

function limitBySupply<K extends string>(
  state: GameState,
  grants: Map<PlayerId, Record<K, number>>,
  kinds: readonly K[],
  supply: Record<K, number>,
): void {
  for (const k of kinds) {
    let demand = 0;
    let demanders = 0;
    for (const p of state.players) {
      const g = grants.get(p.id)![k];
      if (g > 0) {
        demand += g;
        demanders++;
      }
    }
    if (demand <= supply[k]) continue;
    for (const p of state.players) {
      const g = grants.get(p.id)!;
      if (g[k] > 0) g[k] = demanders > 1 ? 0 : supply[k];
    }
  }
}
