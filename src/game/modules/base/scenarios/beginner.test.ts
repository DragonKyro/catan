import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import type { GameState, PlayerColor, PortType, Resource } from '../../../types';
import { RESOURCES } from '../../../types';
import { canConnectRoad, canPlaceSettlement } from '../../../placement';
import { calculateLongestRoad } from '../../../scoring/longestRoad';
import { calculateVictoryPoints } from '../../../scoring/points';
import { applyAction } from '../../../engine';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../../citiesAndKnights/constants';

// The rulebooks' beginner boards (CATAN base rules p.13 Illus. R / back
// cover; CATAN 5-6 rules p.5). Everything is checked by the hexes it
// touches, independent of the corner / side numbering in beginner.ts.

const DEFAULT_4: PlayerColor[] = ['red', 'blue', 'orange', 'white'];
const RULEBOOK_6: PlayerColor[] = ['red', 'blue', 'forest', 'white', 'orange', 'brown'];

function game(n: number, opts: { seed?: number; colors?: PlayerColor[]; shuffle?: boolean } = {}): GameState {
  return createGame({
    playerNames: Array.from({ length: n }, (_, i) => `P${i + 1}`),
    seed: opts.seed ?? 1,
    ...(opts.colors ? { playerColors: opts.colors } : {}),
    settings: { baseScenarioId: 'beginner' },
    randomizeTurnOrder: opts.shuffle ?? false,
  });
}

const key = (hexes: string[]) => [...hexes].sort().join(' ');
const vertexHexes = (g: GameState, v: string) => key(g.board.vertices[v]!.hexes);
const edgeHexes = (g: GameState, e: string) => key(g.board.edges[e]!.hexes);

function resources(list: Resource[]): Record<Resource, number> {
  const out = Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Record<Resource, number>;
  for (const r of list) out[r]++;
  return out;
}

interface Expected {
  settlements: [string[], string[]];
  roads: [string[], string[]];
  resources: Resource[];
}

// 3-4 players (Illustration R). Every settlement touches three land hexes.
const BASE: Record<string, Expected> = {
  red: {
    settlements: [['0,-2', '1,-2', '0,-1'], ['-2,0', '-1,0', '-2,1']],
    roads: [['0,-1', '1,-2'], ['-1,0', '-2,1']],
    resources: ['wheat', 'wood', 'wood'],
  },
  blue: {
    settlements: [['-2,1', '-1,1', '-2,2'], ['0,1', '1,1', '0,2']],
    roads: [['-1,1', '-2,2'], ['0,1', '1,1']],
    resources: ['wood', 'ore', 'brick'],
  },
  orange: {
    settlements: [['1,-1', '2,-1', '2,-2'], ['-1,1', '0,1', '-1,2']],
    roads: [['1,-1', '2,-2'], ['0,1', '-1,2']],
    resources: ['ore', 'wheat', 'wheat'],
  },
  white: {
    settlements: [['-1,-1', '0,-1', '-1,0'], ['1,0', '2,0', '1,1']],
    roads: [['-1,-1', '-1,0'], ['1,0', '2,0']],
    resources: ['wheat', 'brick', 'wood'],
  },
};

// 5-6 players. Coastal settlements list the sea hex they touch.
const FIVE_SIX: Record<string, Expected> = {
  red: {
    settlements: [['-1,-2', '-2,-1', '-2,-2'], ['-1,0', '-2,0', '-2,1']],
    roads: [['-1,-2', '-2,-1'], ['-2,0', '-2,1']],
    resources: ['wheat', 'sheep', 'ore'],
  },
  blue: {
    settlements: [['0,0', '1,0', '0,1'], ['2,0', '1,1', '2,1']],
    roads: [['0,0', '1,0'], ['2,0', '1,1']],
    resources: ['ore', 'sheep', 'brick'],
  },
  forest: {
    settlements: [['0,-3', '1,-3', '1,-4'], ['-1,0', '-1,-1', '0,-1']],
    roads: [['0,-3', '1,-3'], ['-1,-1', '0,-1']],
    resources: ['wheat', 'ore', 'wood'],
  },
  white: {
    settlements: [['2,-2', '2,-1', '3,-2'], ['0,0', '0,-1', '1,-1']],
    roads: [['2,-2', '2,-1'], ['0,-1', '1,-1']],
    resources: ['ore', 'wood', 'wheat'],
  },
  orange: {
    settlements: [['0,0', '-1,0', '-1,1'], ['-3,2', '-3,3', '-4,3']],
    roads: [['-1,0', '-1,1'], ['-3,2', '-3,3']],
    resources: ['ore', 'wheat', 'sheep'],
  },
  brown: {
    settlements: [['0,1', '-1,1', '-1,2'], ['0,2', '-1,3', '0,3']],
    roads: [['0,1', '-1,2'], ['0,2', '-1,3']],
    resources: ['brick', 'sheep', 'wood'],
  },
};

function expectPieces(g: GameState, color: PlayerColor, e: Expected) {
  const p = g.players.find((x) => x.color === color)!;
  expect(p.settlements.map((v) => vertexHexes(g, v))).toEqual(e.settlements.map(key));
  expect(p.roads.map((r) => edgeHexes(g, r))).toEqual(e.roads.map(key));
  // Each road is the one printed beside its settlement.
  p.roads.forEach((r, i) => expect(g.board.edges[r]!.vertices).toContain(p.settlements[i]));
  expect(p.resources).toEqual(resources(e.resources));
  expect(p.cities).toEqual([]);
}

describe('beginner board, 3-4 players (base rules Illus. R)', () => {
  it('pins every hex and disc, the robber on the desert, for every seed', () => {
    const expected: Record<string, [string, number | null]> = {
      '0,-2': ['ore', 10], '1,-2': ['sheep', 2], '2,-2': ['wood', 9],
      '-1,-1': ['wheat', 12], '0,-1': ['brick', 6], '1,-1': ['sheep', 4], '2,-1': ['brick', 10],
      '-2,0': ['wheat', 9], '-1,0': ['wood', 11], '0,0': ['desert', null], '1,0': ['wood', 3], '2,0': ['ore', 8],
      '-2,1': ['wood', 8], '-1,1': ['ore', 3], '0,1': ['wheat', 4], '1,1': ['sheep', 5],
      '-2,2': ['brick', 5], '-1,2': ['wheat', 6], '0,2': ['sheep', 11],
    };
    for (const seed of [1, 2, 3]) {
      for (const n of [3, 4]) {
        const b = game(n, { seed }).board;
        const land = b.hexIds.filter((h) => b.hexes[h]!.terrain !== 'sea');
        expect(land.sort()).toEqual(Object.keys(expected).sort());
        for (const [id, [terrain, token]] of Object.entries(expected)) {
          expect(b.hexes[id]!.terrain).toBe(terrain);
          expect(b.hexes[id]!.numberToken ?? null).toBe(token);
        }
        expect(b.robberHex).toBe('0,0');
      }
    }
  });

  it('puts each harbor on the coastal edge its piers touch', () => {
    // [land hex, sea hex across the harbor edge, type]
    const harbors: Array<[string, string, PortType]> = [
      ['0,-2', '0,-3', 'generic'],
      ['1,-2', '2,-3', 'wheat'],
      ['2,-1', '3,-2', 'ore'],
      ['2,0', '3,0', 'generic'],
      ['1,1', '1,2', 'sheep'],
      ['-1,2', '-1,3', 'generic'],
      ['-2,2', '-3,3', 'generic'],
      ['-2,1', '-3,1', 'brick'],
      ['-1,-1', '-2,-1', 'wood'],
    ];
    const g = game(4);
    expect(g.board.ports).toHaveLength(harbors.length);
    const byEdge = Object.fromEntries(g.board.ports.map((p) => [edgeHexes(g, p.edge), p.type]));
    for (const [landHex, seaHex, type] of harbors) {
      expect(g.board.hexes[seaHex]!.terrain).toBe('sea');
      expect(byEdge[key([landHex, seaHex])]).toBe(type);
    }
  });

  it('places the four colors as printed and pays the starred settlements', () => {
    const g = game(4, { colors: DEFAULT_4 });
    for (const [color, e] of Object.entries(BASE)) expectPieces(g, color as PlayerColor, e);
    // No starting settlement stands on a harbor.
    for (const p of g.players) expect(p.ports).toEqual([]);
    // 19 of each, minus the 12 starting cards.
    expect(g.bank).toEqual({ wood: 15, brick: 17, sheep: 19, wheat: 15, ore: 17 });
  });

  it('starts at the first roll: no placement rounds, 2 VP each', () => {
    const g = game(4, { shuffle: true, seed: 5 });
    expect(g.phase).toBe('rollOrPlayKnight');
    expect(g.setupState).toBeUndefined();
    expect(g.currentPlayerIndex).toBe(0);
    for (const p of g.players) expect(calculateVictoryPoints(g, p.id, true)).toBe(2);
    const next = applyAction(g, { type: 'rollDice', playerId: g.playerOrder[0]!, dice: [3, 4] });
    expect(next.hasRolledThisTurn).toBe(true);
  });

  it('3 players: the red pieces are removed', () => {
    const g = game(3, { colors: ['blue', 'orange', 'white'] });
    for (const color of ['blue', 'orange', 'white'] as const) expectPieces(g, color, BASE[color]!);
    const all = g.players.flatMap((p) => p.settlements.map((v) => vertexHexes(g, v)));
    for (const s of BASE.red!.settlements) expect(all).not.toContain(key(s));
    expect(g.inactiveSettlements).toBeUndefined();
  });

  it('seats a player on the slot of their color, the rest in turn order', () => {
    // Default colors at 3 players are red / blue / orange: red has no slot,
    // so that player takes the free one (White).
    const g = game(3);
    const red = g.players.find((p) => p.color === 'red')!;
    expect(red.settlements.map((v) => vertexHexes(g, v))).toEqual(BASE.white!.settlements.map(key));
    // No color match at all: slots follow turn order (Red, Blue, Orange, White).
    const other = game(4, { colors: ['purple', 'pink', 'teal', 'gold'], shuffle: true, seed: 9 });
    const order = ['red', 'blue', 'orange', 'white'];
    other.playerOrder.forEach((id, i) => {
      const p = other.players.find((x) => x.id === id)!;
      expect(p.settlements.map((v) => vertexHexes(other, v))).toEqual(
        BASE[order[i]!]!.settlements.map(key),
      );
    });
  });
});

describe('beginner board, 5-6 players (5-6 rules p.5)', () => {
  it('pins every hex and disc on the 30-hex board', () => {
    const expected: Record<string, [string, number | null]> = {
      '0,-3': ['brick', 10], '1,-3': ['sheep', 6], '2,-3': ['desert', null],
      '-1,-2': ['brick', 6], '0,-2': ['wheat', 2], '1,-2': ['ore', 9], '2,-2': ['brick', 11],
      '-2,-1': ['wood', 3], '-1,-1': ['ore', 11], '0,-1': ['wood', 5], '1,-1': ['wheat', 10], '2,-1': ['sheep', 4],
      '-3,0': ['desert', null], '-2,0': ['sheep', 5], '-1,0': ['wheat', 4], '0,0': ['ore', 6], '1,0': ['sheep', 3], '2,0': ['wheat', 8],
      '-3,1': ['wood', 12], '-2,1': ['ore', 10], '-1,1': ['sheep', 2], '0,1': ['brick', 4], '1,1': ['wood', 11],
      '-3,2': ['wood', 8], '-2,2': ['wheat', 3], '-1,2': ['wood', 9], '0,2': ['wheat', 5],
      '-3,3': ['brick', 9], '-2,3': ['sheep', 12], '-1,3': ['ore', 8],
    };
    for (const n of [5, 6]) {
      const b = game(n).board;
      const land = b.hexIds.filter((h) => b.hexes[h]!.terrain !== 'sea');
      expect(land.sort()).toEqual(Object.keys(expected).sort());
      for (const [id, [terrain, token]] of Object.entries(expected)) {
        expect(b.hexes[id]!.terrain).toBe(terrain);
        expect(b.hexes[id]!.numberToken ?? null).toBe(token);
      }
      expect(b.robberHex).toBe('2,-3');
    }
  });

  it('puts the 11 harbors on the coastal edges their piers touch', () => {
    const harbors: Array<[string, string, PortType]> = [
      ['0,-3', '0,-4', 'generic'],
      ['1,-3', '2,-4', 'sheep'],
      ['2,-2', '3,-3', 'generic'],
      ['2,0', '3,0', 'generic'],
      ['1,1', '1,2', 'brick'],
      ['-1,3', '0,3', 'sheep'],
      ['-2,3', '-2,4', 'wood'],
      ['-3,3', '-4,4', 'generic'],
      ['-3,2', '-4,2', 'wheat'],
      ['-3,0', '-4,1', 'generic'],
      ['-2,-1', '-3,-1', 'ore'],
    ];
    const g = game(6);
    expect(g.board.ports).toHaveLength(harbors.length);
    const byEdge = Object.fromEntries(g.board.ports.map((p) => [edgeHexes(g, p.edge), p.type]));
    for (const [landHex, seaHex, type] of harbors) {
      expect(g.board.hexes[seaHex]!.terrain).toBe('sea');
      expect(byEdge[key([landHex, seaHex])]).toBe(type);
    }
  });

  it('6 players: all six colors as printed, Brown starting on the wool harbor', () => {
    const g = game(6, { colors: RULEBOOK_6 });
    for (const [color, e] of Object.entries(FIVE_SIX)) expectPieces(g, color as PlayerColor, e);
    for (const p of g.players) expect(p.ports).toEqual(p.color === 'brown' ? ['sheep'] : []);
    // 24 of each, minus the 18 starting cards.
    expect(g.bank).toEqual({ wood: 21, brick: 22, sheep: 20, wheat: 20, ore: 19 });
    expect(g.phase).toBe('rollOrPlayKnight');
    expect(g.inactiveSettlements).toBeUndefined();
  });

  it('5 players: one random color is inactive, its settlements stay and its roads go', () => {
    const inactiveSeen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = game(5, { seed, colors: ['purple', 'pink', 'teal', 'gold', 'lime'] });
      const inactive = g.inactiveSettlements!;
      expect(inactive).toHaveLength(2);
      const slot = Object.entries(FIVE_SIX).find(([, e]) =>
        key(e.settlements.map(key)) === key(inactive.map((v) => vertexHexes(g, v))),
      );
      expect(slot).toBeDefined();
      inactiveSeen.add(slot![0]);
      // Nobody owns them, and the five seats have the other five slots.
      const owned = g.players.flatMap((p) => p.settlements);
      for (const v of inactive) expect(owned).not.toContain(v);
      const ownedSlots = Object.entries(FIVE_SIX)
        .filter(([c]) => c !== slot![0])
        .map(([, e]) => key(e.settlements.map(key)));
      expect(g.players.map((p) => key(p.settlements.map((v) => vertexHexes(g, v)))).sort()).toEqual(
        ownedSlots.sort(),
      );
      // Its roads are removed: no road touches an inactive settlement.
      for (const p of g.players) {
        for (const r of p.roads) {
          for (const v of inactive) expect(g.board.edges[r]!.vertices).not.toContain(v);
        }
      }
    }
    // The draw is seeded and varies between games.
    expect(inactiveSeen.size).toBeGreaterThan(1);
  });

  it('5 players: a player who picked a printed color keeps it; the inactive one is another', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = game(5, { seed, colors: ['red', 'blue', 'forest', 'white', 'orange'] });
      for (const color of ['red', 'blue', 'forest', 'white', 'orange'] as const) {
        expectPieces(g, color, FIVE_SIX[color]!);
      }
      expect(key(g.inactiveSettlements!.map((v) => vertexHexes(g, v)))).toBe(
        key(FIVE_SIX.brown!.settlements.map(key)),
      );
    }
  });

  it('inactive settlements block the distance rule, roads and Longest Road', () => {
    const g = game(5, { seed: 2, colors: ['red', 'blue', 'forest', 'white', 'orange'] });
    // Brown is inactive. Its starred corner: pasture 2 / hills 4 / forest 9.
    const v = g.inactiveSettlements!.find((x) => vertexHexes(g, x) === key(['0,1', '-1,1', '-1,2']))!;
    const occupied = new Set(g.players.flatMap((p) => [...p.settlements, ...p.cities]));
    const far = (e: string) => g.board.edges[e]!.vertices.find((a) => a !== v)!;
    // Edges out of v whose far corner has no player's building next to it.
    const clear = g.board.vertices[v]!.edges.filter(
      (e) => !g.board.vertices[far(e)]!.neighborVertices.some((n) => occupied.has(n)),
    );
    expect(clear.length).toBeGreaterThanOrEqual(2);
    const [e1, e2] = clear as [string, string];
    const x = far(e1);
    // A bare player with one road ending at the inactive settlement.
    const pid = g.players[0]!.id;
    const s: GameState = {
      ...g,
      players: g.players.map((p) =>
        p.id === pid ? { ...p, settlements: [], cities: [], roads: [e1] } : p,
      ),
    };
    const without = (st: GameState): GameState => ({ ...st, inactiveSettlements: undefined });
    // Not on it, not next to it (the road reaches x, a neighbor of v).
    expect(canPlaceSettlement(s, pid, v)).toBe(false);
    expect(canPlaceSettlement(s, pid, x)).toBe(false);
    expect(canPlaceSettlement(without(s), pid, x)).toBe(true);
    // No road onward through it.
    expect(canConnectRoad(s, pid, e2)).toBe(false);
    expect(canConnectRoad(without(s), pid, e2)).toBe(true);
    // And it breaks Longest Road.
    const two: GameState = {
      ...s,
      players: s.players.map((p) => (p.id === pid ? { ...p, roads: [e1, e2] } : p)),
    };
    expect(calculateLongestRoad(two, pid)).toBe(1);
    expect(calculateLongestRoad(without(two), pid)).toBe(2);
  });
});

describe('beginner board: combinations', () => {
  it('is refused with Cities & Knights (its setup places a city)', () => {
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C', 'D'],
        seed: 1,
        settings: { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID], baseScenarioId: 'beginner' },
      }),
    ).toThrow(/can't be played/);
  });

  it('plays 3-6 players only', () => {
    for (const n of [2, 7, 8]) expect(() => game(n)).toThrow(/3-6 players/);
  });

  it('works with the T&B variants (any rule set)', () => {
    const g = createGame({
      playerNames: ['A', 'B', 'C', 'D'],
      seed: 1,
      settings: {
        baseScenarioId: 'beginner',
        tradersVariants: { friendlyRobber: true, strongestPorts: true, eventCards: true },
      },
    });
    expect(g.phase).toBe('rollOrPlayKnight');
    expect(g.eventCards).toBeDefined();
  });
});
