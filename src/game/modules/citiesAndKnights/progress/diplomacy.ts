import type { EdgeId, GameState, Player, PlayerId, VertexId } from '../../../types';

// Diplomacy (p.15): "A road is 'open' if one of its ends is not next to one
// of your roads or buildings and if it is not part of a continuous route
// connecting two of your buildings and/or knights." "Your" is the road's
// owner. So a road is open when
//   (a) at one of its ends the owner has neither a building nor another
//       road, and
//   (b) it doesn't link two of the owner's buildings / knights: following
//       the owner's roads out of each end (not through other players'
//       pieces) doesn't reach a building or knight on both sides.
export function isOpenRoad(state: GameState, edge: EdgeId): boolean {
  const owner = state.players.find((p) => p.roads.includes(edge));
  const e = state.board.edges[edge];
  if (!owner || !e) return false;
  const [a, b] = e.vertices;
  const loose = (v: VertexId) => !hasBuilding(owner, v) && !hasOtherRoad(state, owner, v, edge);
  if (!loose(a) && !loose(b)) return false;
  return !(reachesAnchor(state, owner, a, edge) && reachesAnchor(state, owner, b, edge));
}

export function openRoads(state: GameState): EdgeId[] {
  const out: EdgeId[] = [];
  for (const p of state.players) for (const e of p.roads) if (isOpenRoad(state, e)) out.push(e);
  return out;
}

export function roadOwner(state: GameState, edge: EdgeId): PlayerId | null {
  return state.players.find((p) => p.roads.includes(edge))?.id ?? null;
}

function hasBuilding(p: Player, v: VertexId): boolean {
  return p.settlements.includes(v) || p.cities.includes(v);
}

function hasOtherRoad(state: GameState, p: Player, v: VertexId, except: EdgeId): boolean {
  return (state.board.vertices[v]?.edges ?? []).some((e) => e !== except && p.roads.includes(e));
}

function isAnchor(state: GameState, p: Player, v: VertexId): boolean {
  return hasBuilding(p, v) || state.knights?.[v]?.playerId === p.id;
}

function blockedForOwner(state: GameState, p: Player, v: VertexId): boolean {
  for (const o of state.players) {
    if (o.id !== p.id && hasBuilding(o, v)) return true;
  }
  const k = state.knights?.[v];
  return !!k && k.playerId !== p.id;
}

// Does the owner's network, entered at `start` without using `except`, reach
// one of their buildings or knights?
function reachesAnchor(state: GameState, p: Player, start: VertexId, except: EdgeId): boolean {
  const seen = new Set<VertexId>([start]);
  const queue: VertexId[] = [start];
  while (queue.length > 0) {
    const v = queue.shift()!;
    if (isAnchor(state, p, v)) return true;
    if (blockedForOwner(state, p, v)) continue;
    for (const e of state.board.vertices[v]?.edges ?? []) {
      if (e === except || !p.roads.includes(e)) continue;
      const edge = state.board.edges[e]!;
      const other = edge.vertices[0] === v ? edge.vertices[1] : edge.vertices[0];
      if (seen.has(other)) continue;
      seen.add(other);
      queue.push(other);
    }
  }
  return false;
}
