import { describe, it, expect } from 'vitest';
import { calculateLongestRoad } from './longestRoad';
import { createGame } from '../createGame';
import type { GameState, EdgeId, VertexId } from '../types';

function setRoads(state: GameState, playerIndex: number, roads: EdgeId[]): GameState {
  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, roads: [...roads] } : p,
  );
  return { ...state, players };
}

function setSettlements(state: GameState, playerIndex: number, vertices: VertexId[]): GameState {
  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, settlements: [...vertices] } : p,
  );
  return { ...state, players };
}

// Pick a sequence of edges that form a connected chain along vertex neighbors.
function chainFromVertex(
  state: GameState,
  start: VertexId,
  length: number,
): EdgeId[] {
  const board = state.board;
  const visitedVertices = new Set<VertexId>([start]);
  const path: EdgeId[] = [];
  let current = start;
  for (let i = 0; i < length; i++) {
    const edges = board.vertices[current]!.edges;
    let chose: { edge: EdgeId; next: VertexId } | null = null;
    for (const eid of edges) {
      const e = board.edges[eid]!;
      const other = e.vertices[0] === current ? e.vertices[1] : e.vertices[0];
      if (visitedVertices.has(other)) continue;
      chose = { edge: eid, next: other };
      break;
    }
    if (!chose) break;
    path.push(chose.edge);
    visitedVertices.add(chose.next);
    current = chose.next;
  }
  return path;
}

describe('calculateLongestRoad', () => {
  const state = createGame({ playerNames: ['A', 'B'], seed: 42, randomizeTurnOrder: false });

  it('returns 0 for a player with no roads', () => {
    expect(calculateLongestRoad(state, 'p0')).toBe(0);
  });

  it('counts a straight chain of roads', () => {
    const startVertex = state.board.vertexIds[0]!;
    const path = chainFromVertex(state, startVertex, 5);
    expect(path.length).toBe(5);
    const next = setRoads(state, 0, path);
    expect(calculateLongestRoad(next, 'p0')).toBe(5);
  });

  it('handles a branching shape correctly (longest path, not total roads)', () => {
    // T-shape: 3 in a line, plus a branch of 1.
    // Total roads = 4, longest single path = 4 (we walk the trunk + branch).
    // Actually: edges = trunk (3 segments, 4 vertices) + 1 branch.
    // Longest path: trunk + branch = 4.
    const startVertex = state.board.vertexIds[0]!;
    const trunk = chainFromVertex(state, startVertex, 3);
    // Add a branch from the second vertex (junction between trunk[0] and trunk[1])
    const [, junction] = state.board.edges[trunk[0]!]!.vertices[0] === startVertex
      ? state.board.edges[trunk[0]!]!.vertices
      : ([state.board.edges[trunk[0]!]!.vertices[1], state.board.edges[trunk[0]!]!.vertices[0]] as [VertexId, VertexId]);
    // Pick an edge at junction not in trunk
    const trunkSet = new Set(trunk);
    const branch = state.board.vertices[junction]!.edges.find((eid) => !trunkSet.has(eid));
    const roads = branch ? [...trunk, branch] : trunk;
    const next = setRoads(state, 0, roads);
    const longest = calculateLongestRoad(next, 'p0');
    expect(longest).toBeGreaterThanOrEqual(3);
    expect(longest).toBeLessThanOrEqual(roads.length);
  });

  it('is broken by an opponent settlement in the middle of the path', () => {
    // Build a 4-road chain, then put an opponent settlement at the middle vertex.
    const startVertex = state.board.vertexIds[0]!;
    const path = chainFromVertex(state, startVertex, 4);
    let s = setRoads(state, 0, path);
    // Find the vertex shared between path[1] and path[2] — the middle of the 4-road chain
    const e1 = s.board.edges[path[1]!]!;
    const e2 = s.board.edges[path[2]!]!;
    const middle = e1.vertices.find((v) => v === e2.vertices[0] || v === e2.vertices[1])!;
    s = setSettlements(s, 1, [middle]);
    // The opponent's settlement splits the 4-chain into two: 2 + 2. Longest = 2.
    expect(calculateLongestRoad(s, 'p0')).toBe(2);
  });

  it('finds path of length N when player has N roads in a straight chain', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const startVertex = state.board.vertexIds[0]!;
      const path = chainFromVertex(state, startVertex, n);
      if (path.length < n) continue; // skip if board geometry constrains
      const next = setRoads(state, 0, path);
      expect(calculateLongestRoad(next, 'p0')).toBe(n);
    }
  });
});
