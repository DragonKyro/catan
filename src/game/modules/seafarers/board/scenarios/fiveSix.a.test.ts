import { describe, expect, it } from 'vitest';
import { createGame } from '../../../../createGame';
import { applyAction } from '../../../../engine';
import { updatePlayer } from '../../../../helpers';
import type { EdgeId, GameState, HexId, Terrain } from '../../../../types';
import { resolveEdgeRef, resolveVertexRef } from '../generator';

// Seafarers 5-6 maps of the four "basic rules" scenarios (2025 Seafarers 5-6
// rulebook pp. 4-7), checked against docs/map-specs/SEAFARERS56-SPEC-A.md:
// Heading for New Shores, The Six Islands (Four Islands at 5-6), The Fog
// Islands and Through the Desert. Every printed hex is pinned by terrain +
// number and every harbor by the two hex positions its edge separates —
// measured from the board geometry, so the direction enums are checked
// rather than trusted. Islands / starting zones are pinned by their hexes.

function game(scenarioId: string, players: number, seed = 1): GameState {
  return createGame({
    playerNames: Array.from({ length: players }, (_, i) => `P${i}`),
    seed,
    settings: { expansions: ['seafarers'], scenarioId },
    randomizeTurnOrder: false,
  });
}

// ---------------------------------------------------------------- geometry

interface Grid {
  ox: number;
  oy: number;
  w: number;
  dy: number;
}

function grid(s: GameState): Grid {
  const c = (id: string) => s.board.hexes[id]!.center;
  const o = c('0,0');
  return { ox: o.x, oy: o.y, w: c('1,0').x - o.x, dy: c('0,1').y - o.y };
}

function axialAt(g: Grid, x: number, y: number): string {
  const r = Math.round((y - g.oy) / g.dy);
  const q = Math.round((x - g.ox) / g.w - r / 2);
  return `${q},${r}`;
}

const key = (...ids: string[]) => [...ids].sort().join('|');

// The two hex positions either side of an edge (on the board or off it).
function edgeSides(s: GameState, e: EdgeId): string {
  const g = grid(s);
  const [a, b] = s.board.edges[e]!.vertices.map((v) => s.board.vertices[v]!.position) as [
    { x: number; y: number },
    { x: number; y: number },
  ];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const h = g.w / 2;
  return key(axialAt(g, mx + nx * h, my + ny * h), axialAt(g, mx - nx * h, my - ny * h));
}

// ---------------------------------------------------------------- frame

// The 5-6 frame rows [r, first q, last q] (spec: "The frame and the sea
// count"). 58 positions on the 56-hex maps, 65 on the 63-hex one.
const FRAME_56: Array<[number, number, number]> = [
  [-3, -2, 4],
  [-2, -3, 4],
  [-1, -4, 4],
  [0, -5, 4],
  [1, -5, 3],
  [2, -5, 2],
  [3, -5, 1],
];
const FRAME_63: Array<[number, number, number]> = [
  [-3, -2, 5],
  [-2, -3, 5],
  [-1, -4, 5],
  [0, -5, 5],
  [1, -5, 4],
  [2, -5, 3],
  [3, -5, 2],
];

function frameIds(frame: Array<[number, number, number]>): string[] {
  const out: string[] = [];
  for (const [r, q0, q1] of frame) for (let q = q0; q <= q1; q++) out.push(`${q},${r}`);
  return out.sort();
}

function expectFrame(s: GameState, frame: Array<[number, number, number]>) {
  expect([...s.board.hexIds].sort()).toEqual(frameIds(frame));
  // The board's pixel grid is the axial grid the helpers assume.
  const g = grid(s);
  for (const id of s.board.hexIds) {
    const c = s.board.hexes[id]!.center;
    expect(axialAt(g, c.x, c.y)).toBe(id);
  }
}

// ---------------------------------------------------------------- hexes

const TERRAIN: Record<string, Terrain> = {
  G: 'gold',
  B: 'brick',
  F: 'wood',
  P: 'sheep',
  W: 'wheat',
  O: 'ore',
};

// Printed hexes: "q,r Xn" entries (X terrain letter, n disc).
function printed(list: string): Map<HexId, [Terrain, number]> {
  const out = new Map<HexId, [Terrain, number]>();
  for (const entry of list.trim().split(/\s*;\s*/)) {
    const [id, cell] = entry.split(/\s+/) as [string, string];
    out.set(id, [TERRAIN[cell[0]!]!, Number(cell.slice(1))]);
  }
  return out;
}

function expectPrinted(s: GameState, want: Map<HexId, [Terrain, number]>) {
  for (const [id, [terrain, n]] of want) {
    const h = s.board.hexes[id];
    expect(h, id).toBeDefined();
    expect([id, h!.terrain, h!.numberToken]).toEqual([id, terrain, n]);
  }
}

function counts(s: GameState, ids: HexId[] = s.board.hexIds) {
  const terrain: Partial<Record<Terrain, number>> = {};
  const discs: Record<number, number> = {};
  for (const id of ids) {
    const h = s.board.hexes[id]!;
    terrain[h.terrain] = (terrain[h.terrain] ?? 0) + 1;
    if (h.numberToken != null) discs[h.numberToken] = (discs[h.numberToken] ?? 0) + 1;
  }
  return { terrain, discs };
}

// Component-table disc counts, columns 2 3 4 5 6 8 9 10 11 12.
function discTable(n: number[]): Record<number, number> {
  const out: Record<number, number> = {};
  [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].forEach((d, i) => {
    if (n[i]! > 0) out[d] = n[i]!;
  });
  return out;
}

// Component-table hex counts, columns sea gold hills forest pasture fields
// mountains desert; `extraSea` adds the frame's two middle-row points, which
// the tables leave out.
function terrainTable(n: number[], extraSea = 2): Partial<Record<Terrain, number>> {
  const names: Terrain[] = ['sea', 'gold', 'brick', 'wood', 'sheep', 'wheat', 'ore', 'desert'];
  const out: Partial<Record<Terrain, number>> = {};
  names.forEach((t, i) => {
    const c = i === 0 ? n[i]! + extraSea : n[i]!;
    if (c > 0) out[t] = c;
  });
  return out;
}

const pair = (a: string, b: string) => key(a, b);
const portSides = (s: GameState) => s.board.ports.map((p) => edgeSides(s, p.edge)).sort();

function portTypeCounts(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of s.board.ports) out[p.type] = (out[p.type] ?? 0) + 1;
  return out;
}

// "6x 2:1 ports, 5x 3:1 ports": the CATAN 2:1 set + the Seafarers 5-6 sheep.
const PORTS_11 = { generic: 5, wood: 1, brick: 1, wheat: 1, ore: 1, sheep: 2 };

// No two harbors share a corner (their piers would touch).
function expectPortsApart(s: GameState) {
  const seen = new Set<string>();
  for (const p of s.board.ports) {
    for (const v of s.board.edges[p.edge]!.vertices) {
      expect(seen.has(v), `two harbors share corner ${v}`).toBe(false);
      seen.add(v);
    }
  }
}

// Hex ids of each island, keyed by island id.
function islands(s: GameState): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [hex, island] of Object.entries(s.board.islandOfHex ?? {})) {
    out.set(island, [...(out.get(island) ?? []), hex]);
  }
  for (const v of out.values()) v.sort();
  return out;
}

const islandSets = (s: GameState) =>
  [...islands(s).values()].map((hexes) => hexes.join(' ')).sort();

const ids = (list: string) => list.trim().split(/\s+/).sort().join(' ');

function adjacentReds(s: GameState): string[] {
  const out: string[] = [];
  for (const e of Object.values(s.board.edges)) {
    if (e.hexes.length !== 2) continue;
    const [a, b] = e.hexes.map((h) => s.board.hexes[h]!.numberToken);
    if ((a === 6 || a === 8) && (b === 6 || b === 8)) out.push(e.hexes.join('|'));
  }
  return out;
}

// ---------------------------------------------------------------- Heading for New Shores

// The main island = the CATAN 5-6 board (rows 3-4-5-6-5-4-3).
const HFNS_MAIN = [
  [-3, 0, 2],
  [-2, -1, 2],
  [-1, -2, 2],
  [0, -3, 2],
  [1, -3, 1],
  [2, -3, 0],
  [3, -3, -1],
].flatMap(([r, q0, q1]) => {
  const out: string[] = [];
  for (let q = q0!; q <= q1!; q++) out.push(`${q},${r}`);
  return out;
});

const HFNS_SMALL = printed(`
  -2,-3 G9; -3,-2 O11; -4,-1 P8;
  -5,1 B4; -5,2 F2; -5,3 G5;
  4,-3 O6; 4,-1 B12; 3,1 W3; 1,3 G10
`);

describe('Heading for New Shores, 5-6 players', () => {
  for (const n of [5, 6]) {
    it(`${n}p: frame, printed small islands, sea, counts, robber and pirate`, () => {
      const s = game('headingForNewShores', n);
      expectFrame(s, FRAME_56);
      expect(HFNS_MAIN).toHaveLength(30);
      expectPrinted(s, HFNS_SMALL);
      // Everything else off the main island is sea.
      for (const id of s.board.hexIds) {
        if (HFNS_MAIN.includes(id) || HFNS_SMALL.has(id)) continue;
        expect([id, s.board.hexes[id]!.terrain]).toEqual([id, 'sea']);
      }
      const c = counts(s);
      expect(c.terrain).toEqual(terrainTable([16, 3, 7, 7, 7, 7, 7, 2]));
      expect(c.discs).toEqual(discTable([3, 4, 4, 4, 4, 4, 4, 4, 4, 3]));
      expect(s.board.hexes[s.board.robberHex]!.terrain).toBe('desert');
      expect(HFNS_MAIN).toContain(s.board.robberHex);
      expect(s.board.pirateHex).toBe('4,0');
      expect(s.settings.victoryPointsToWin).toBe(14);
    });
  }

  it('deals the main island by the CATAN 5-6 variable setup', () => {
    const layouts = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = game('headingForNewShores', 5, seed);
      const c = counts(s, HFNS_MAIN);
      expect(c.terrain).toEqual({ brick: 5, wood: 6, sheep: 6, wheat: 6, ore: 5, desert: 2 });
      expect(c.discs).toEqual(discTable([2, 3, 3, 3, 3, 3, 3, 3, 3, 2]));
      expect(adjacentReds(s)).toEqual([]);
      layouts.add(HFNS_MAIN.map((id) => s.board.hexes[id]!.terrain).join());
      // Random harbor types from the 11-harbor set.
      expect(portTypeCounts(s)).toEqual(PORTS_11);
    }
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('puts the 11 harbors on the rulebook edges of the main island', () => {
    const s = game('headingForNewShores', 6);
    expect(portSides(s)).toEqual(
      [
        pair('1,-3', '2,-4'),
        pair('-1,-2', '-1,-3'),
        pair('2,-2', '3,-3'),
        pair('-2,-1', '-3,-1'),
        pair('2,-1', '3,-1'),
        pair('-3,0', '-4,1'),
        pair('2,0', '2,1'),
        pair('0,2', '1,2'),
        pair('-3,2', '-4,3'),
        pair('-2,3', '-3,4'),
        pair('-1,3', '-1,4'),
      ].sort(),
    );
    expectPortsApart(s);
  });

  it('starts everyone on the main island; the small islands pay 2 VP', () => {
    const s = game('headingForNewShores', 5);
    const isl = islands(s);
    const main = s.board.islandOfHex!['0,0']!;
    expect(isl.get(main)).toEqual([...HFNS_MAIN].sort());
    expect(s.startingIslands).toEqual([main]);
    // The rulebook outlines 4 small islands: each east pair, with the sea
    // hex between, is one outline (`extras5_6.islandGroups`).
    expect(islandSets(s)).toEqual(
      [
        ids(HFNS_MAIN.join(' ')),
        ids('-2,-3 -3,-2 -4,-1'),
        ids('-5,1 -5,2 -5,3'),
        ids('4,-3 4,-1'),
        ids('3,1 1,3'),
      ].sort(),
    );
    expect(s.islandChips).toHaveLength(4);
    expect(s.islandChips!.map((c) => c.islandId).sort()).toEqual(
      [...isl.keys()].filter((id) => id !== main).sort(),
    );
    expect(s.islandChips!.every((c) => c.vp === 2)).toBe(true);
  });
});

// ---------------------------------------------------------------- The Six Islands

const SIX_ISLANDS = [
  '-2,-3 P12; -1,-3 O4; -3,-2 F8; -2,-2 O10; -4,-1 B11; -3,-1 W9',
  '1,-3 F6; 0,-2 O11; 1,-2 B10; -1,-1 P3; 0,-1 F4',
  '3,-3 O9; 4,-3 P6; 3,-2 W3; 4,-2 B10; 3,-1 F4',
  '-4,1 B4; -5,2 F9; -4,2 W12; -5,3 P5; -4,3 O6',
  '-1,1 P8; 0,1 F10; -2,2 W5; -1,2 O3; -2,3 P2',
  '2,1 F5; 3,1 W6; 1,2 B8; 2,2 P9; 0,3 B5; 1,3 W2',
];

describe('The Six Islands (Four Islands at 5-6 players)', () => {
  for (const n of [5, 6]) {
    it(`${n}p: frame, every hex, counts, robber and pirate`, () => {
      const s = game('fourIslands', n);
      expectFrame(s, FRAME_56);
      const land = new Map(SIX_ISLANDS.flatMap((isl) => [...printed(isl)]));
      expect(land.size).toBe(32);
      expectPrinted(s, land);
      for (const id of s.board.hexIds) {
        if (!land.has(id)) expect([id, s.board.hexes[id]!.terrain]).toEqual([id, 'sea']);
      }
      const c = counts(s);
      expect(c.terrain).toEqual(terrainTable([24, 0, 6, 7, 7, 6, 6, 0]));
      expect(c.discs).toEqual(discTable([2, 3, 4, 4, 4, 3, 4, 4, 2, 2]));
      // "Place the robber on the pasture hex with the number 12 disc."
      expect(s.board.robberHex).toBe('-2,-3');
      expect(s.board.pirateHex).toBe('-5,0');
      expect(s.settings.victoryPointsToWin).toBe(13);
      expect(portTypeCounts(s)).toEqual(PORTS_11);
    });
  }

  it('puts the 11 harbors on the rulebook edges', () => {
    const s = game('fourIslands', 5);
    expect(portSides(s)).toEqual(
      [
        pair('-1,-3', '-1,-4'),
        pair('1,-3', '2,-4'),
        pair('4,-3', '5,-4'),
        pair('-2,-2', '-2,-1'),
        pair('-3,-1', '-4,0'),
        pair('3,-2', '2,-1'),
        pair('-5,2', '-6,2'),
        pair('-4,3', '-3,2'),
        pair('-2,2', '-3,3'),
        pair('2,2', '3,2'),
        pair('0,3', '-1,4'),
      ].sort(),
    );
    expectPortsApart(s);
  });

  it('has six islands, every one paying its bonus; start anywhere', () => {
    const s = game('fourIslands', 6);
    expect(islandSets(s)).toEqual(
      SIX_ISLANDS.map((isl) => ids([...printed(isl).keys()].join(' '))).sort(),
    );
    expect(s.islandChips).toHaveLength(6);
    expect(s.islandChips!.every((c) => c.vp === 2)).toBe(true);
    expect(s.startingIslands).toBeUndefined();
  });
});

// ---------------------------------------------------------------- The Fog Islands

const FOG_WEST = printed(`
  -2,-3 F10; -3,-2 P6; -4,-1 W12; -3,-1 B4; -4,0 O11; -3,0 P5;
  -5,1 W6; -4,1 F3; -5,2 B9; -4,2 P8; -5,3 B11; -4,3 O10
`);
const FOG_EAST = printed(`
  3,-3 F9; 4,-3 W2; 3,-2 W5; 4,-2 O12; 3,-1 P4; 4,-1 B8;
  2,0 F6; 3,0 P3; 2,1 O9; 3,1 W4; 2,2 B10; 1,3 F8
`);
const FOG_HEXES = ids(`
  0,-3 1,-3
  -1,-2 0,-2 1,-2
  -1,-1 0,-1 1,-1
  -1,0 0,0
  -2,1 -1,1 0,1
  -2,2 -1,2 0,2
  -2,3 -1,3
`);

describe('The Fog Islands, 5-6 players', () => {
  for (const n of [5, 6]) {
    it(`${n}p: frame, the two printed islands, fog area, robber and pirate`, () => {
      const s = game('fogIsland', n);
      expectFrame(s, FRAME_56);
      expectPrinted(s, FOG_WEST);
      expectPrinted(s, FOG_EAST);
      expect([...s.unrevealedFogHexes!].sort().join(' ')).toBe(FOG_HEXES);
      const fog = FOG_HEXES.split(' ');
      for (const id of s.board.hexIds) {
        if (FOG_WEST.has(id) || FOG_EAST.has(id) || fog.includes(id)) continue;
        expect([id, s.board.hexes[id]!.terrain]).toEqual([id, 'sea']);
      }
      const faceUp = s.board.hexIds.filter((id) => !fog.includes(id));
      const c = counts(s, faceUp);
      expect(c.terrain).toEqual(terrainTable([14, 0, 5, 5, 5, 5, 4, 0]));
      expect(c.discs).toEqual(discTable([1, 2, 3, 2, 3, 3, 3, 3, 2, 2]));
      // "Place the robber on the field hex with the number 12 disc."
      expect(s.board.robberHex).toBe('-4,-1');
      // The printed pirate sits on the frame under the southern fog; the
      // nearest stand-in sea hex.
      expect(s.board.pirateHex).toBe('0,3');
      expect(s.settings.victoryPointsToWin).toBe(12);
    });
  }

  it('draws the 18 fog hexes from the face-down stack', () => {
    for (const seed of [1, 2, 3]) {
      const s = game('fogIsland', 6, seed);
      const c = counts(s, FOG_HEXES.split(' '));
      expect(c.terrain).toEqual(terrainTable([3, 3, 2, 2, 2, 2, 3, 1], 0));
      expect(c.discs).toEqual(discTable([2, 2, 1, 2, 1, 1, 1, 1, 2, 1]));
    }
  });

  it('puts the 11 printed harbors on the rulebook edges', () => {
    const s = game('fogIsland', 5);
    const typed = s.board.ports.map((p) => `${edgeSides(s, p.edge)} ${p.type}`).sort();
    expect(typed).toEqual(
      [
        `${pair('-3,-2', '-3,-3')} generic`,
        `${pair('-3,-1', '-2,-1')} sheep`,
        `${pair('-4,0', '-5,0')} ore`,
        `${pair('-5,2', '-6,2')} generic`,
        `${pair('-4,3', '-3,2')} generic`,
        `${pair('3,-3', '4,-4')} wood`,
        `${pair('4,-1', '5,-2')} generic`,
        `${pair('3,-2', '2,-1')} sheep`,
        `${pair('3,1', '4,0')} brick`,
        `${pair('3,1', '3,2')} wheat`,
        `${pair('2,2', '1,2')} generic`,
      ].sort(),
    );
    expectPortsApart(s);
  });

  it('a ship off the west island discovers the fog', () => {
    let s = game('fogIsland', 5);
    s = {
      ...s,
      players: s.players.map((p) => ({ ...p, settlements: [], cities: [], roads: [], ships: [] })),
      phase: 'main',
      setupState: undefined,
      hasRolledThisTurn: true,
      currentPlayerIndex: 0,
      turnHolderIndex: 0,
    };
    // A settlement on (-2,-3)'s SE corner; the ship goes along the sea edge
    // (-1,-3)|(-2,-2), whose far end touches the fog hex (-1,-2).
    const home = resolveVertexRef(s.board, { q: -2, r: -3, corner: 1 });
    const edge = resolveEdgeRef(s.board, { q: -1, r: -3, direction: 2 });
    expect(edgeSides(s, edge)).toBe(pair('-1,-3', '-2,-2'));
    s = updatePlayer(s, 'p0', (p) => ({
      ...p,
      settlements: [home],
      resources: { wood: 5, brick: 5, sheep: 5, wheat: 5, ore: 5 },
    }));
    expect(s.unrevealedFogHexes).toContain('-1,-2');
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge });
    expect(s.unrevealedFogHexes).not.toContain('-1,-2');
    expect(s.unrevealedFogHexes).toHaveLength(17);
  });

  it('has no island bonus and lets players start on either island', () => {
    const s = game('fogIsland', 6);
    expect(s.islandChips ?? []).toHaveLength(0);
    expect(s.startingIslands).toBeUndefined();
    const west = s.board.islandOfHex!['-4,0']!;
    const east = s.board.islandOfHex!['3,0']!;
    expect(islands(s).get(west)).toEqual([...FOG_WEST.keys()].sort());
    expect(islands(s).get(east)).toEqual([...FOG_EAST.keys()].sort());
  });
});

// ---------------------------------------------------------------- Through the Desert

const TTD_DESERTS = ['-1,-2', '0,-2', '1,-2', '2,-2', '3,-2'];
const TTD_NORTH_WEST = printed('-2,-3 G4; -1,-3 O6; 0,-3 B11; -3,-2 F5; -2,-2 P2');
const TTD_NORTH_EAST = printed('2,-3 F12; 3,-3 W5; 4,-3 O3; 5,-3 B6');
const TTD_MAIN = printed(`
  -1,-1 W2; 0,-1 F8; 1,-1 P9; 2,-1 F10;
  -4,0 O4; -3,0 F5; -2,0 W10; -1,0 B5; 0,0 P10; 1,0 F4; 2,0 B8;
  -5,1 P12; -4,1 W3; -3,1 B12; -2,1 O6; -1,1 B11; 0,1 O3; 1,1 W9;
  -5,2 B9; -4,2 O11;
  -5,3 P6
`);
const TTD_SMALL = [
  printed('5,-1 G10'),
  printed('4,1 O8; 2,2 P11; 3,2 F3; 2,3 W9'),
  printed('-3,3 P8; -2,3 W2'),
  printed('0,3 G4'),
];

describe('Through the Desert, 5-6 players', () => {
  for (const n of [5, 6]) {
    it(`${n}p: frame, every hex, counts, robber and pirate`, () => {
      const s = game('throughTheDesert', n);
      expectFrame(s, FRAME_63);
      const land = new Map([
        ...TTD_NORTH_WEST,
        ...TTD_NORTH_EAST,
        ...TTD_MAIN,
        ...TTD_SMALL.flatMap((m) => [...m]),
      ]);
      expect(land.size).toBe(38);
      expectPrinted(s, land);
      for (const id of TTD_DESERTS) {
        expect([id, s.board.hexes[id]!.terrain, s.board.hexes[id]!.numberToken]).toEqual([
          id,
          'desert',
          null,
        ]);
      }
      for (const id of s.board.hexIds) {
        if (land.has(id) || TTD_DESERTS.includes(id)) continue;
        expect([id, s.board.hexes[id]!.terrain]).toEqual([id, 'sea']);
      }
      const c = counts(s);
      expect(c.terrain).toEqual(terrainTable([20, 3, 7, 7, 7, 7, 7, 5]));
      expect(c.discs).toEqual(discTable([3, 4, 4, 4, 4, 4, 4, 4, 4, 3]));
      expect(TTD_DESERTS).toContain(s.board.robberHex);
      expect(s.board.pirateHex).toBe('1,3');
      expect(s.settings.victoryPointsToWin).toBe(14);
      expect(portTypeCounts(s)).toEqual(PORTS_11);
    });
  }

  it('puts the 11 harbors on the rulebook edges of the main island', () => {
    const s = game('throughTheDesert', 6);
    expect(portSides(s)).toEqual(
      [
        pair('-4,0', '-4,-1'),
        pair('-2,0', '-2,-1'),
        pair('2,-1', '3,-1'),
        pair('-5,1', '-5,0'),
        pair('2,0', '2,1'),
        pair('-3,1', '-3,2'),
        pair('-1,1', '-2,2'),
        pair('1,1', '0,2'),
        pair('-5,2', '-6,2'),
        pair('-4,2', '-4,3'),
        pair('-5,3', '-6,4'),
      ].sort(),
    );
    expectPortsApart(s);
    const main = s.board.islandOfHex!['0,0']!;
    for (const p of s.board.ports) {
      const land = s.board.edges[p.edge]!.hexes.filter((h) => s.board.hexes[h]!.terrain !== 'sea');
      expect(land.map((h) => s.board.islandOfHex![h])).toEqual([main]);
    }
  });

  it('splits the far side of the desert off; settle first south of it', () => {
    const s = game('throughTheDesert', 5);
    const main = s.board.islandOfHex!['0,0']!;
    expect(islands(s).get(main)).toEqual([...TTD_MAIN.keys()].sort());
    expect(s.startingIslands).toEqual([main]);
    for (const id of TTD_DESERTS) expect(s.board.islandOfHex![id]).toBeUndefined();
    expect(islandSets(s)).toEqual(
      [TTD_MAIN, TTD_NORTH_WEST, TTD_NORTH_EAST, ...TTD_SMALL]
        .map((m) => ids([...m.keys()].join(' ')))
        .sort(),
    );
    expect(s.islandChips).toHaveLength(6);
    expect(s.islandChips!.every((c) => c.vp === 2)).toBe(true);
  });
});
