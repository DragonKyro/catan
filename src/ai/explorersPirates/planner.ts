import type { EdgeId, EpShip, GameState, HexId, PlayerId, VertexId } from '@/game/types';
import { EP_SHIPS_PER_EDGE } from '@/game/modules/explorersPirates/constants';
import { edgeOfHex, hiddenHexesAtEdge, isShipEdge } from '@/game/modules/explorersPirates/state';

// Ship route planner for the Explorers & Pirates AI: Dijkstra over sea
// edges, one MP per edge, mirroring `legalShipSteps`:
//   - ships sail on edges of explored sea (`isShipEdge`);
//   - an edge touching a face-down hex explores it and ends the move, so
//     the search never goes on from one;
//   - an edge with 2 other ships may be passed, not stopped on;
//   - the first step onto / off / along an opponent pirate's hex costs a
//     1-gold tribute (impossible without gold), once per ship per turn.
// `mp` caps the steps (Infinity = plan over several turns).

export const TRIBUTE_WEIGHT = 0.7;

export interface ReachNode {
  edge: EdgeId;
  steps: number;
  // Steps plus the tribute's planning weight.
  cost: number;
  // First edge on the path from the ship (null at the start).
  first: EdgeId | null;
  // Arriving here turns hexes over (the move ends there).
  explores: boolean;
  // Not an edge with 2 other ships (the move may end here).
  canStop: boolean;
}

export interface ReachOptions {
  mp: number;
  gold: number;
  // The ship already paid the tribute this turn.
  tributePaid: boolean;
}

// Per-state caches (a state is immutable, so a WeakMap keyed on it is safe).
const shipEdgeCache = new WeakMap<GameState, Set<EdgeId>>();
const exploreCache = new WeakMap<GameState, Map<EdgeId, boolean>>();

export function shipEdgeSet(state: GameState): Set<EdgeId> {
  let s = shipEdgeCache.get(state);
  if (!s) {
    s = new Set(state.board.edgeIds.filter((e) => isShipEdge(state, e)));
    shipEdgeCache.set(state, s);
  }
  return s;
}

export function edgeExplores(state: GameState, edge: EdgeId): boolean {
  let m = exploreCache.get(state);
  if (!m) {
    m = new Map();
    exploreCache.set(state, m);
  }
  let v = m.get(edge);
  if (v === undefined) {
    v = hiddenHexesAtEdge(state, edge).length > 0;
    m.set(edge, v);
  }
  return v;
}

function othersOnEdge(state: GameState, edge: EdgeId, shipId: string): number {
  let n = 0;
  for (const s of state.explorersPirates?.ships ?? []) if (s.edge === edge && s.id !== shipId) n++;
  return n;
}

// Tiny binary heap on `cost`.
class Heap<T extends { cost: number }> {
  private items: T[] = [];
  get size(): number {
    return this.items.length;
  }
  push(x: T): void {
    const a = this.items;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.cost <= a[i]!.cost) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.cost < a[m]!.cost) m = l;
        if (r < a.length && a[r]!.cost < a[m]!.cost) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

interface Entry extends ReachNode {
  paid: boolean;
}

// Every edge the ship can reach within `opts.mp` steps, by cheapest path.
export function shipReach(state: GameState, ship: EpShip, opts: ReachOptions): Map<EdgeId, ReachNode> {
  const shipEdges = shipEdgeSet(state);
  const pirate = state.explorersPirates?.pirate ?? null;
  const pirateHex: HexId | null = pirate && pirate.owner !== ship.owner ? pirate.hex : null;
  const best = new Map<string, Entry>();
  const out = new Map<EdgeId, ReachNode>();
  const heap = new Heap<Entry>();
  const start: Entry = {
    edge: ship.edge,
    steps: 0,
    cost: 0,
    first: null,
    explores: false,
    canStop: othersOnEdge(state, ship.edge, ship.id) < EP_SHIPS_PER_EDGE,
    paid: opts.tributePaid,
  };
  heap.push(start);
  best.set(`${ship.edge}|${start.paid}`, start);
  while (heap.size > 0) {
    const cur = heap.pop()!;
    const key = `${cur.edge}|${cur.paid}`;
    if (best.get(key) !== cur) continue;
    const prev = out.get(cur.edge);
    if (!prev || cur.cost < prev.cost) out.set(cur.edge, cur);
    if (cur.explores) continue;
    if (cur.steps >= opts.mp) continue;
    const mpAfter = opts.mp - (cur.steps + 1);
    for (const to of state.board.edges[cur.edge]!.neighborEdges) {
      if (!shipEdges.has(to)) continue;
      const explores = edgeExplores(state, to);
      const full = othersOnEdge(state, to, ship.id) >= EP_SHIPS_PER_EDGE;
      if (full && (mpAfter <= 0 || explores)) continue;
      let cost = cur.cost + 1;
      let paid = cur.paid;
      if (pirateHex && !paid && (edgeOfHex(state, cur.edge, pirateHex) || edgeOfHex(state, to, pirateHex))) {
        if (opts.gold < 1) continue;
        paid = true;
        cost += TRIBUTE_WEIGHT;
      }
      const next: Entry = {
        edge: to,
        steps: cur.steps + 1,
        cost,
        first: cur.first ?? to,
        explores,
        canStop: !full,
        paid,
      };
      const k = `${to}|${paid}`;
      const old = best.get(k);
      if (old && old.cost <= cost) continue;
      best.set(k, next);
      heap.push(next);
    }
  }
  return out;
}

// ----- Target edges -----

// Ship edges with an end on `vertexId`.
export function edgesAtVertex(state: GameState, vertexId: VertexId): EdgeId[] {
  const set = shipEdgeSet(state);
  return (state.board.vertices[vertexId]?.edges ?? []).filter((e) => set.has(e));
}

// Ship edges with an end on a corner of `hexId` ("next to the hex").
export function edgesNextToHex(state: GameState, hexId: HexId): EdgeId[] {
  const out = new Set<EdgeId>();
  for (const c of state.board.hexes[hexId]?.corners ?? []) for (const e of edgesAtVertex(state, c)) out.add(e);
  return [...out];
}

// Sea distance (steps over known ship edges) between two edges, or
// Infinity. Used for setup and build-site scoring.
export function seaDistance(state: GameState, owner: PlayerId, from: EdgeId, to: ReadonlySet<EdgeId>): number {
  const probe: EpShip = { id: '__probe__', owner, edge: from, cargo: [] };
  const reach = shipReach(state, probe, { mp: Infinity, gold: 99, tributePaid: true });
  let best = Infinity;
  for (const e of to) {
    const n = reach.get(e);
    if (n && n.steps < best) best = n.steps;
  }
  return best;
}
