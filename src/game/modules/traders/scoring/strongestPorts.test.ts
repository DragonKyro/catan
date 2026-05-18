import { describe, it, expect } from 'vitest';
import type { GameState, BoardState } from '../../../types';
import { recalcStrongestPorts, portBuildingsVp } from './strongestPorts';

// Build a tiny board with three port edges and three players to exercise
// the port-VP math directly. We don't need the full geometry — just a few
// edges + their vertex memberships.
function mockState(opts: {
  ports: Array<{ edge: string; vertices: [string, string] }>;
  players: Array<{ id: string; settlements: string[]; cities: string[] }>;
}): GameState {
  const edges: BoardState['edges'] = {};
  for (const p of opts.ports) {
    edges[p.edge] = {
      id: p.edge,
      vertices: p.vertices,
      hexes: [],
      neighborEdges: [],
    };
  }
  const board: BoardState = {
    hexes: {},
    vertices: {},
    edges,
    ports: opts.ports.map((p) => ({ edge: p.edge, type: 'generic' })),
    robberHex: 'r',
    hexIds: [],
    vertexIds: [],
    edgeIds: opts.ports.map((p) => p.edge),
  };
  const players = opts.players.map((p) => ({
    id: p.id,
    name: p.id,
    color: 'red' as const,
    isAI: false,
    resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
    devCards: {
      unplayed: [],
      boughtThisTurn: [],
      playedKnights: 0,
      victoryPoints: 0,
    },
    settlements: p.settlements,
    cities: p.cities,
    roads: [],
    ports: [],
    hasLongestRoad: false,
    hasLargestArmy: false,
    ships: [],
  }));
  return { board, players } as unknown as GameState;
}

describe('Strongest Ports scoring', () => {
  it('counts settlements as 1 port-VP and cities as 2', () => {
    const s = mockState({
      ports: [
        { edge: 'e1', vertices: ['v1', 'v2'] },
        { edge: 'e2', vertices: ['v3', 'v4'] },
      ],
      players: [
        { id: 'p0', settlements: ['v1'], cities: ['v3'] },
        { id: 'p1', settlements: [], cities: [] },
      ],
    });
    expect(portBuildingsVp(s, 'p0')).toBe(3); // 1 + 2
    expect(portBuildingsVp(s, 'p1')).toBe(0);
  });

  it('awards the tile to the unique leader at >= 3 port-VP', () => {
    const s = mockState({
      ports: [
        { edge: 'e1', vertices: ['v1', 'v2'] },
        { edge: 'e2', vertices: ['v3', 'v4'] },
      ],
      players: [
        { id: 'p0', settlements: ['v1'], cities: ['v3'] }, // 3 vp
        { id: 'p1', settlements: ['v2'], cities: [] }, // 1 vp
      ],
    });
    expect(recalcStrongestPorts(s)).toEqual({ holder: 'p0' });
  });

  it('leaves the tile unowned below the 3 port-VP threshold', () => {
    const s = mockState({
      ports: [{ edge: 'e1', vertices: ['v1', 'v2'] }],
      players: [
        { id: 'p0', settlements: ['v1'], cities: [] }, // 1 vp
        { id: 'p1', settlements: ['v2'], cities: [] }, // 1 vp
      ],
    });
    expect(recalcStrongestPorts(s)).toEqual({ holder: null });
  });

  it('leaves the tile unowned on a tie', () => {
    const s = mockState({
      ports: [
        { edge: 'e1', vertices: ['v1', 'v2'] },
        { edge: 'e2', vertices: ['v3', 'v4'] },
      ],
      players: [
        { id: 'p0', settlements: [], cities: ['v1', 'v3'] }, // 4 vp
        { id: 'p1', settlements: [], cities: ['v2', 'v4'] }, // 4 vp
      ],
    });
    expect(recalcStrongestPorts(s)).toEqual({ holder: null });
  });
});
