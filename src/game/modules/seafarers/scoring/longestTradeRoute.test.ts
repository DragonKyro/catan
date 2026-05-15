import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { calculateLongestTradeRoute } from './longestTradeRoute';

// Build a minimal game state and manipulate roads/ships directly. The
// engine's recomputeDerived and the scorer are independent so we can do
// this without driving full actions.
function newGame() {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores' },
    randomizeTurnOrder: false,
  });
}

describe('longestTradeRoute', () => {
  it('returns 0 with no roads and no ships', () => {
    const s = newGame();
    expect(calculateLongestTradeRoute(s, 'p0')).toBe(0);
  });

  it('counts a contiguous chain of two roads', () => {
    const s = newGame();
    // Pick two edges sharing a vertex.
    let e1: string | null = null;
    let e2: string | null = null;
    for (const eid of s.board.edgeIds) {
      const edge = s.board.edges[eid]!;
      // Skip pure-sea so we don't accidentally make a ship-only edge a "road".
      if (edge.hexes.every((h) => s.board.hexes[h]!.terrain === 'sea')) continue;
      for (const eid2 of s.board.edgeIds) {
        if (eid === eid2) continue;
        const e2def = s.board.edges[eid2]!;
        if (e2def.hexes.every((h) => s.board.hexes[h]!.terrain === 'sea')) continue;
        if (
          edge.vertices.some((v) => e2def.vertices.includes(v))
        ) {
          e1 = eid;
          e2 = eid2;
          break;
        }
      }
      if (e1 && e2) break;
    }
    expect(e1).toBeTruthy();
    expect(e2).toBeTruthy();
    const next = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, roads: [e1!, e2!] } : p,
      ),
    };
    expect(calculateLongestTradeRoute(next, 'p0')).toBe(2);
  });

  it('counts ships the same as roads', () => {
    const s = newGame();
    let e1: string | null = null;
    let e2: string | null = null;
    for (const eid of s.board.edgeIds) {
      for (const eid2 of s.board.edgeIds) {
        if (eid === eid2) continue;
        if (s.board.edges[eid]!.vertices.some((v) => s.board.edges[eid2]!.vertices.includes(v))) {
          e1 = eid;
          e2 = eid2;
          break;
        }
      }
      if (e1 && e2) break;
    }
    const next = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, ships: [e1!, e2!] } : p,
      ),
    };
    expect(calculateLongestTradeRoute(next, 'p0')).toBe(2);
  });

  it('forbids road/ship transition at an unsettled vertex', () => {
    const s = newGame();
    // Find a single shared vertex v that is NOT settled by p0, and two edges
    // attached to it where one will be a road and the other a ship.
    let edges: [string, string] | null = null;
    for (const vid of s.board.vertexIds) {
      const v = s.board.vertices[vid]!;
      if (v.edges.length < 2) continue;
      edges = [v.edges[0]!, v.edges[1]!];
      break;
    }
    expect(edges).not.toBeNull();
    const next = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? { ...p, roads: [edges![0]], ships: [edges![1]] }
          : p,
      ),
    };
    // Without an own settlement at the meeting vertex, the road and ship
    // count as two disconnected single edges → longest path 1.
    expect(calculateLongestTradeRoute(next, 'p0')).toBe(1);
  });

  it('allows road/ship transition when an own settlement sits between them', () => {
    const s = newGame();
    let meeting: string | null = null;
    let e1: string | null = null;
    let e2: string | null = null;
    for (const vid of s.board.vertexIds) {
      const v = s.board.vertices[vid]!;
      if (v.edges.length < 2) continue;
      meeting = vid;
      e1 = v.edges[0]!;
      e2 = v.edges[1]!;
      break;
    }
    const next = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? {
              ...p,
              roads: [e1!],
              ships: [e2!],
              settlements: [meeting!],
            }
          : p,
      ),
    };
    expect(calculateLongestTradeRoute(next, 'p0')).toBe(2);
  });
});
