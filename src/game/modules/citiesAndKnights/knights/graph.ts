import type {
  GameState,
  KnightStrength,
  PlayerId,
  VertexId,
} from '../../../types';
import { knightAt } from './state';

// Cities & Knights — graph traversals for knight movement and displacement.
//
// Knights move along their owner's continuous network of roads/ships/bridges.
// Knights pass over their own pieces (settlements / cities / knights) but
// stop on opposing pieces. Movement ends on an empty intersection.
//
// Notes:
//   - The starting vertex is not a candidate destination (knights must
//     actually move; staying put isn't an action).
//   - For displacement we want the reverse: enumerate vertices that hold
//     an opposing knight strictly weaker than the attacker.

interface BfsResult {
  // Reachable empty vertices along the player's network.
  empty: Set<VertexId>;
  // Reachable vertices that hold an opposing piece — included so the
  // displacement helper can filter to enemy-knight vertices.
  reached: Set<VertexId>;
}

// Walks the player's network from `source`. The walk passes through:
//   - the source vertex (always)
//   - vertices holding the player's own buildings or knights
// and is blocked by:
//   - vertices holding any opposing piece (settlement / city / knight)
// We treat each blocking vertex as still "reached" so callers can identify
// adjacent enemy knights to displace.
function walkNetwork(
  state: GameState,
  playerId: PlayerId,
  source: VertexId,
): BfsResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { empty: new Set(), reached: new Set() };

  const ownEdges = new Set<string>();
  for (const eid of player.roads) ownEdges.add(eid);
  for (const eid of player.ships) ownEdges.add(eid);
  for (const eid of player.bridges ?? []) ownEdges.add(eid);

  const isOpposingVertex = (vid: VertexId): boolean => {
    for (const p of state.players) {
      if (p.id === playerId) continue;
      if (p.settlements.includes(vid) || p.cities.includes(vid)) return true;
    }
    const k = state.knights?.[vid];
    if (k && k.playerId !== playerId) return true;
    return false;
  };

  const empty = new Set<VertexId>();
  const reached = new Set<VertexId>();
  const visited = new Set<VertexId>();
  const queue: VertexId[] = [source];
  visited.add(source);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const vert = state.board.vertices[cur];
    if (!vert) continue;
    for (const eid of vert.edges) {
      if (!ownEdges.has(eid)) continue;
      const edge = state.board.edges[eid];
      if (!edge) continue;
      const other = edge.vertices[0] === cur ? edge.vertices[1] : edge.vertices[0];
      if (visited.has(other)) continue;
      visited.add(other);
      reached.add(other);
      // Stop on opposing vertices: we can REACH them (to displace a knight),
      // but we don't extend the BFS through them.
      if (isOpposingVertex(other)) continue;
      // Empty vertex (no building, no knight at all) is a candidate landing.
      const occupiedByMe =
        player.settlements.includes(other) ||
        player.cities.includes(other) ||
        state.knights?.[other]?.playerId === playerId;
      if (!occupiedByMe && !state.knights?.[other]) {
        empty.add(other);
      }
      queue.push(other);
    }
  }
  return { empty, reached };
}

// Set of empty vertices the knight at `source` can move to.
export function reachableEmptyVertices(
  state: GameState,
  playerId: PlayerId,
  source: VertexId,
): Set<VertexId> {
  return walkNetwork(state, playerId, source).empty;
}

// Set of vertices holding an opposing knight that this attacker can displace.
// Displacement is only legal when the attacker is strictly stronger.
export function enemyKnightDisplacementTargets(
  state: GameState,
  playerId: PlayerId,
  source: VertexId,
  attackerStrength: KnightStrength,
): Set<VertexId> {
  const { reached } = walkNetwork(state, playerId, source);
  const out = new Set<VertexId>();
  for (const vid of reached) {
    const k = knightAt(state, vid);
    if (!k) continue;
    if (k.playerId === playerId) continue;
    if (k.strength < attackerStrength) out.add(vid);
  }
  return out;
}

// Does the displaced knight have anywhere to go? Used by the displaceKnight
// handler — if not, the rulebook says the knight returns to its owner's supply.
export function displacedHasDestination(
  state: GameState,
  victimId: PlayerId,
  victimVertex: VertexId,
): boolean {
  return reachableEmptyVertices(state, victimId, victimVertex).size > 0;
}
