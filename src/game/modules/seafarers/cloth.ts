import type { EdgeId, GameState, PlayerId, VertexId } from '../../types';
import { updatePlayer } from '../../helpers';

// Cloth for Catan (rulebook p.14-15). The number discs on the small islands'
// intersections are villages, each with 5 cloth tokens; 10 more form a
// general supply.
//   - Trade relations: "When you create a route between one of your
//     buildings and a village ... immediately take 1 cloth token from this
//     village's supply."
//   - Production: when a village's number is rolled, each trading partner
//     takes 1 cloth from the village, topping up from the general supply if
//     the village runs short. A village with no cloth left no longer
//     produces.
//   - Each pair of cloth tokens is worth 1 VP.
//   - The game also ends when 5+ villages are empty at the end of a turn.

export const CLOTH_PER_VILLAGE = 5;
export const CLOTH_GENERAL_SUPPLY = 10;
export const EXHAUSTED_VILLAGES_TO_END = 5;

// Does `playerId` have a route — their roads and ships, switching between
// the two only at their own buildings, not through an opponent's building —
// from one of their buildings to `target`?
export function routeConnects(
  state: GameState,
  playerId: PlayerId,
  target: VertexId,
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  const own = new Set<VertexId>([...player.settlements, ...player.cities]);
  if (own.has(target)) return true;
  const opponent = new Set<VertexId>();
  for (const p of state.players) {
    if (p.id === playerId) continue;
    for (const v of [...p.settlements, ...p.cities]) opponent.add(v);
  }
  type Kind = 'road' | 'ship';
  const kindOf = new Map<EdgeId, Kind>();
  for (const e of player.roads) kindOf.set(e, 'road');
  for (const e of player.ships) kindOf.set(e, 'ship');

  // BFS over (vertex, kind we arrived by).
  const seen = new Set<string>();
  const queue: Array<[VertexId, Kind | null]> = [...own].map((v) => [v, null]);
  while (queue.length > 0) {
    const [v, arrived] = queue.shift()!;
    const key = `${v}|${arrived}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (arrived !== null && opponent.has(v)) continue;
    for (const eid of state.board.vertices[v]?.edges ?? []) {
      const kind = kindOf.get(eid);
      if (!kind) continue;
      if (arrived !== null && arrived !== kind && !own.has(v)) continue;
      const edge = state.board.edges[eid]!;
      const to = edge.vertices[0] === v ? edge.vertices[1] : edge.vertices[0];
      if (to === target) return true;
      queue.push([to, kind]);
    }
  }
  return false;
}

// Establish any newly-created trade relations (each pays 1 cloth at once).
export function updateClothRelations(state: GameState): GameState {
  const villages = state.clothVillages;
  if (!villages || villages.length === 0) return state;
  let next = state;
  let changed = false;
  const updated = villages.map((village) => {
    let v = village;
    for (const p of state.players) {
      if (v.partners.includes(p.id)) continue;
      if (!routeConnects(state, p.id, v.vertex)) continue;
      changed = true;
      const pays = v.supply > 0 ? 1 : 0;
      v = { ...v, partners: [...v.partners, p.id], supply: v.supply - pays };
      if (pays > 0) {
        next = updatePlayer(next, p.id, (pl) => ({ ...pl, cloth: (pl.cloth ?? 0) + 1 }));
      }
    }
    return v;
  });
  return changed ? { ...next, clothVillages: updated } : state;
}

// Production phase: villages whose number was rolled pay their partners.
// Partners are served in turn order from the roller, so if the general
// supply runs dry the roller's side of the table is paid first.
export function distributeCloth(state: GameState, rolled: number): GameState {
  const villages = state.clothVillages;
  if (!villages || villages.length === 0) return state;
  let general = state.clothSupply ?? 0;
  const gains: Record<PlayerId, number> = {};
  const order = turnOrderFromCurrent(state);
  const updated = villages.map((village) => {
    if (village.number !== rolled || village.supply <= 0) return village;
    let supply = village.supply;
    for (const pid of order) {
      if (!village.partners.includes(pid)) continue;
      if (supply > 0) supply--;
      else if (general > 0) general--;
      else continue;
      gains[pid] = (gains[pid] ?? 0) + 1;
    }
    return { ...village, supply };
  });
  let next: GameState = { ...state, clothVillages: updated, clothSupply: general };
  for (const [pid, n] of Object.entries(gains)) {
    next = updatePlayer(next, pid, (p) => ({ ...p, cloth: (p.cloth ?? 0) + n }));
  }
  return next;
}

function turnOrderFromCurrent(state: GameState): PlayerId[] {
  const n = state.playerOrder.length;
  const out: PlayerId[] = [];
  for (let i = 0; i < n; i++) {
    out.push(state.playerOrder[(state.currentPlayerIndex + i) % n]!);
  }
  return out;
}

export function exhaustedVillageCount(state: GameState): number {
  return (state.clothVillages ?? []).filter((v) => v.supply <= 0).length;
}

export function hasClothTradeRoute(state: GameState, playerId: PlayerId): boolean {
  return (state.clothVillages ?? []).some((v) => v.partners.includes(playerId));
}

export function calculateClothVp(state: GameState, playerId: PlayerId): number {
  const cloth = state.players.find((p) => p.id === playerId)?.cloth ?? 0;
  return Math.floor(cloth / 2);
}
