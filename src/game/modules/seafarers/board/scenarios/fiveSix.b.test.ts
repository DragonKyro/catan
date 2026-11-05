import { describe, expect, it } from 'vitest';
import { createGame } from '../../../../createGame';
import type { EdgeId, GameState, HexId, Terrain, VertexId } from '../../../../types';

// Seafarers 5-6 maps of the four fixed-setup scenarios (2025 Seafarers 5-6
// rulebook pp. 8-11), checked against docs/map-specs/SEAFARERS56-SPEC-B.md.
// Every hex is pinned by terrain + number, and every harbor, tribe token,
// village, Pirate Islands piece and wonder marker by the hex positions it
// touches — measured from the board geometry, so the edge / corner enums
// are checked rather than trusted.

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

function centerOf(g: Grid, id: string): { x: number; y: number } {
  const [q, r] = id.split(',').map(Number) as [number, number];
  return { x: g.ox + g.w * (q + r / 2), y: g.oy + g.dy * r };
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

// The three hex positions around a corner (on the board or off it).
function cornerHexes(s: GameState, v: VertexId): string {
  const g = grid(s);
  const p = s.board.vertices[v]!.position;
  const size = g.dy / 1.5;
  const out: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    const x = p.x + size * Math.cos(a);
    const y = p.y + size * Math.sin(a);
    const id = axialAt(g, x, y);
    const c = centerOf(g, id);
    if (Math.hypot(c.x - x, c.y - y) < size / 4) out.push(id);
  }
  expect(out).toHaveLength(3);
  return key(...out);
}

// ---------------------------------------------------------------- hexes

const TERRAIN: Record<string, Terrain> = {
  '~': 'sea',
  D: 'desert',
  G: 'gold',
  B: 'brick',
  F: 'wood',
  P: 'sheep',
  W: 'wheat',
  O: 'ore',
};

// [r, first q, cells west → east]; see the spec's tables.
type Rows = Array<[number, number, string]>;

function expectedHexes(rows: Rows): Map<HexId, [Terrain, number | null]> {
  const out = new Map<HexId, [Terrain, number | null]>();
  for (const [r, q0, cells] of rows) {
    cells.split(' ').forEach((cell, i) => {
      const terrain = TERRAIN[cell[0]!]!;
      const n = cell.length > 1 ? Number(cell.slice(1)) : null;
      out.set(`${q0 + i},${r}`, [terrain, n]);
    });
  }
  return out;
}

function expectBoard(s: GameState, rows: Rows) {
  const want = expectedHexes(rows);
  const got = new Map<HexId, [Terrain, number | null]>();
  for (const id of s.board.hexIds) {
    const h = s.board.hexes[id]!;
    got.set(id, [h.terrain, h.numberToken]);
  }
  expect(Object.fromEntries(got)).toEqual(Object.fromEntries(want));
  // The board's pixel grid is the axial grid the helpers assume.
  const g = grid(s);
  for (const id of s.board.hexIds) {
    const c = s.board.hexes[id]!.center;
    expect(axialAt(g, c.x, c.y)).toBe(id);
  }
}

function counts(s: GameState) {
  const terrain: Partial<Record<Terrain, number>> = {};
  const discs: Record<number, number> = {};
  for (const id of s.board.hexIds) {
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
// mountains desert. The table's sea count leaves out the frame's west / east
// points, which are sea hexes on every map (+2).
function terrainTable(n: number[]): Partial<Record<Terrain, number>> {
  const names: Terrain[] = ['sea', 'gold', 'brick', 'wood', 'sheep', 'wheat', 'ore', 'desert'];
  const out: Partial<Record<Terrain, number>> = {};
  names.forEach((t, i) => {
    const c = i === 0 ? n[i]! + 2 : n[i]!;
    if (c > 0) out[t] = c;
  });
  return out;
}

const portSides = (s: GameState) => s.board.ports.map((p) => edgeSides(s, p.edge)).sort();

function portTypeCounts(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of s.board.ports) out[p.type] = (out[p.type] ?? 0) + 1;
  return out;
}

const RANDOM_11_PORTS = { generic: 5, wood: 1, brick: 1, wheat: 1, ore: 1, sheep: 2 };

// ---------------------------------------------------------------- Forgotten Tribe

const FT_ROWS: Rows = [
  [-3, -2, 'D D ~ G G ~ P P'],
  [-2, -3, '~ ~ ~ ~ ~ ~ ~ ~ ~'],
  [-1, -4, 'W3 B5 O11 P8 B4 F10 W4 B3 F8 O5'],
  [0, -5, '~ F11 P12 F5 W10 P5 B9 W2 P9 B10 ~'],
  [1, -5, 'F6 O4 W9 B8 F11 O3 P4 W6 F3 O6'],
  [2, -5, '~ ~ ~ ~ ~ ~ ~ ~ ~'],
  [3, -5, 'D D ~ O B ~ W G'],
];

describe('The Forgotten Tribe, 5-6 players', () => {
  for (const n of [5, 6]) {
    it(`${n}p: every hex, the counts, robber and pirate`, () => {
      const s = game('forgottenTribe', n);
      expectBoard(s, FT_ROWS);
      const c = counts(s);
      expect(c.terrain).toEqual(terrainTable([22, 3, 7, 7, 7, 7, 6, 4]));
      expect(c.discs).toEqual(discTable([1, 4, 4, 4, 3, 3, 3, 3, 3, 1]));
      expect(s.board.hexes[s.board.robberHex]!.terrain).toBe('desert');
      expect(s.board.pirateHex).toBe('-3,3');
      // Every port starts with the tribe.
      expect(s.board.ports).toHaveLength(0);
    });
  }

  it('puts the tribe tokens on the rulebook edges', () => {
    const s = game('forgottenTribe', 6);
    const of = (type: string) =>
      s.tribeTokens!.filter((t) => t.type === type).map((t) => edgeSides(s, t.edge)).sort();
    expect(of('victoryPoint')).toEqual(
      [
        key('-2,-3', '-2,-4'),
        key('-1,-3', '-1,-4'),
        key('1,-3', '2,-4'),
        key('2,-3', '2,-4'),
        key('4,-3', '4,-4'),
        key('-4,3', '-5,4'),
        key('-2,3', '-2,4'),
        key('-1,3', '-2,4'),
        key('1,3', '1,4'),
        key('2,3', '2,4'),
      ].sort(),
    );
    expect(of('devCard')).toEqual(
      [
        key('-2,-3', '-3,-3'),
        key('2,-3', '3,-4'),
        key('5,-3', '6,-3'),
        key('-5,3', '-6,3'),
        key('-2,3', '-3,4'),
        key('2,3', '3,3'),
      ].sort(),
    );
    // Every development card is drawn from the deck at setup.
    expect(s.tribeTokens!.filter((t) => t.type === 'devCard' && t.devCard)).toHaveLength(6);
    const ports = s.tribeTokens!
      .filter((t) => t.type === 'port')
      .map((t) => `${edgeSides(s, t.edge)} ${t.portType}`)
      .sort();
    // Printed face up on the 5-6 map.
    expect(ports).toEqual(
      [
        `${key('-1,-3', '0,-4')} wheat`,
        `${key('1,-3', '1,-4')} generic`,
        `${key('4,-3', '5,-4')} wood`,
        `${key('5,-3', '6,-4')} generic`,
        `${key('-5,3', '-6,4')} brick`,
        `${key('-4,3', '-4,4')} sheep`,
        `${key('-1,3', '-1,4')} ore`,
        `${key('1,3', '0,4')} generic`,
      ].sort(),
    );
    // Same tokens whatever the seed.
    const other = game('forgottenTribe', 5, 99);
    expect(other.tribeTokens!.map((t) => `${t.edge} ${t.type} ${t.portType ?? ''}`).sort()).toEqual(
      s.tribeTokens!.map((t) => `${t.edge} ${t.type} ${t.portType ?? ''}`).sort(),
    );
  });

  it('blocks settlements and the robber on the unnumbered tribe islands', () => {
    const s = game('forgottenTribe', 5);
    const unnumbered = [
      '-2,-3', '-1,-3', '1,-3', '2,-3', '4,-3', '5,-3',
      '-5,3', '-4,3', '-2,3', '-1,3', '1,3', '2,3',
    ].sort();
    expect([...s.settlementBlockedHexes!].sort()).toEqual(unnumbered);
    expect([...s.robberBlockedHexes!].sort()).toEqual(unnumbered);
  });
});

// ---------------------------------------------------------------- Cloth for Catan

const CLOTH_ROWS: Rows = [
  [-3, -2, 'F4 P6 B5 W12 B3 P11 W8'],
  [-2, -3, 'W3 F12 ~ ~ ~ ~ F3 O9'],
  [-1, -4, 'W11 ~ ~ D ~ D ~ ~ P3'],
  [0, -5, '~ ~ G ~ ~ ~ ~ G ~ ~'],
  [1, -5, 'O8 ~ ~ D ~ D ~ ~ O2'],
  [2, -5, 'B9 W2 ~ ~ ~ ~ P11 O4'],
  [3, -5, 'P10 F6 O5 F11 F8 W10 B6'],
];

describe('Cloth for Catan, 5-6 players', () => {
  for (const n of [5, 6]) {
    it(`${n}p: every hex, the counts, robber and pirate`, () => {
      const s = game('clothForCatan', n);
      expectBoard(s, CLOTH_ROWS);
      const c = counts(s);
      expect(c.terrain).toEqual(terrainTable([24, 2, 4, 6, 5, 6, 5, 4]));
      // The table's discs include the 12 villages.
      const discs = { ...c.discs };
      for (const v of s.clothVillages!) discs[v.number] = (discs[v.number] ?? 0) + 1;
      expect(discs).toEqual(discTable([3, 4, 4, 4, 4, 4, 4, 4, 4, 3]));
      expect(s.board.robberHex).toBe('-4,-1');
      expect(s.board.pirateHex).toBe('4,0');
    });
  }

  it('puts the villages on the small islands’ corners', () => {
    const s = game('clothForCatan', 6);
    const villages = s.clothVillages!.map((v) => `${cornerHexes(s, v.vertex)} ${v.number}`).sort();
    expect(villages).toEqual(
      [
        `${key('-1,-1', '-1,-2', '0,-2')} 2`,
        `${key('-1,-1', '-2,0', '-1,0')} 5`,
        `${key('1,-1', '1,-2', '2,-2')} 10`,
        `${key('1,-1', '0,0', '1,0')} 8`,
        `${key('-3,0', '-3,-1', '-2,-1')} 4`,
        `${key('-3,0', '-4,1', '-3,1')} 9`,
        `${key('2,0', '2,-1', '3,-1')} 4`,
        `${key('2,0', '1,1', '2,1')} 5`,
        `${key('-2,1', '-2,0', '-1,0')} 6`,
        `${key('-2,1', '-3,2', '-2,2')} 12`,
        `${key('0,1', '0,0', '1,0')} 9`,
        `${key('0,1', '-1,2', '0,2')} 10`,
      ].sort(),
    );
    expect(s.clothVillages!.every((v) => v.supply === 5)).toBe(true);
    expect(s.clothSupply).toBe(10);
    // Small islands: no settlements, no robber.
    const small = ['-1,-1', '1,-1', '-3,0', '2,0', '-2,1', '0,1'].sort();
    expect([...s.settlementBlockedHexes!].sort()).toEqual(small);
    expect([...s.robberBlockedHexes!].sort()).toEqual(small);
    // Starting settlements on the two large islands.
    const islandOf = s.board.islandOfHex!;
    expect([...s.startingIslands!].sort()).toEqual([islandOf['-2,-3'], islandOf['-5,3']].sort());
    expect(islandOf['-4,-1']).toBe(islandOf['-2,-3']);
    expect(islandOf['4,-1']).toBe(islandOf['-2,-3']);
    expect(islandOf['-5,1']).toBe(islandOf['-5,3']);
    expect(islandOf['3,1']).toBe(islandOf['-5,3']);
  });

  it('puts the eleven random harbors on the rulebook edges', () => {
    const s = game('clothForCatan', 5);
    expect(portSides(s)).toEqual(
      [
        key('-2,-3', '-1,-4'),
        key('1,-3', '1,-4'),
        key('3,-3', '3,-4'),
        key('-3,-2', '-4,-2'),
        key('4,-2', '5,-2'),
        key('3,1', '4,1'),
        key('-5,2', '-6,2'),
        key('2,2', '2,3'),
        key('-4,3', '-5,4'),
        key('-3,3', '-3,4'),
        key('0,3', '0,4'),
      ].sort(),
    );
    expect(portTypeCounts(s)).toEqual(RANDOM_11_PORTS);
  });
});

// ---------------------------------------------------------------- Pirate Islands

const PIRATE_ROWS: Rows = [
  [-3, -2, 'G3 ~ O6 ~ ~ P5 W4 B9'],
  [-2, -3, '~ ~ ~ ~ D ~ O3 B10 F11'],
  [-1, -4, 'G11 D O8 ~ ~ ~ F12 F6 P4 F10'],
  [0, -5, '~ ~ ~ ~ D ~ W6 W4 O5 P8 ~'],
  [1, -5, 'G11 D O6 ~ ~ ~ P2 P10 B3 P5'],
  [2, -5, '~ ~ ~ ~ D ~ W11 O9 B8'],
  [3, -5, 'G3 ~ O8 ~ ~ F9 W5 F4'],
];

// Rulebook colours in seat order: settlement, ship, fortress, beachhead.
const PIRATE_SLOTS: Array<[string, string, string, string, string]> = [
  ['red', key('3,-3', '2,-3', '3,-4'), key('2,-3', '3,-4'), key('-2,-3', '-3,-3', '-2,-4'), key('0,-3', '1,-4', '1,-3')],
  ['white', key('3,-3', '3,-2', '2,-2'), key('2,-2', '3,-3'), key('-2,-3', '-2,-2', '-3,-2'), key('0,-3', '0,-2', '-1,-2')],
  ['blue', key('1,0', '1,-1', '2,-1'), key('1,0', '1,-1'), key('-4,-1', '-3,-1', '-4,0'), key('-2,-1', '-1,-1', '-2,0')],
  ['orange', key('1,0', '1,1', '0,1'), key('1,0', '0,1'), key('-5,1', '-4,0', '-4,1'), key('-3,1', '-2,0', '-2,1')],
  ['green', key('0,3', '0,2', '1,2'), key('0,3', '0,2'), key('-5,3', '-5,2', '-4,2'), key('-3,3', '-3,2', '-2,2')],
  ['purple', key('0,3', '-1,4', '-1,3'), key('-1,3', '-1,4'), key('-5,3', '-6,4', '-6,3'), key('-3,3', '-2,3', '-3,4')],
];

describe('The Pirate Islands, 5-6 players', () => {
  for (const n of [5, 6]) {
    it(`${n}p: every hex and the counts`, () => {
      const s = game('pirateIslands', n);
      expectBoard(s, PIRATE_ROWS);
      const c = counts(s);
      expect(c.terrain).toEqual(terrainTable([26, 4, 4, 6, 6, 5, 7, 5]));
      expect(c.discs).toEqual(discTable([1, 4, 4, 4, 4, 4, 3, 3, 4, 1]));
    });

    it(`${n}p: seats each player on their rulebook slot (5p leaves out purple)`, () => {
      const s = game('pirateIslands', n);
      const pi = s.pirateIslands!;
      expect(pi.fortresses).toHaveLength(n);
      s.playerOrder.forEach((pid, i) => {
        const [, settlement, ship, fortress, beachhead] = PIRATE_SLOTS[i]!;
        const p = s.players.find((x) => x.id === pid)!;
        expect(p.settlements.map((v) => cornerHexes(s, v))).toEqual([settlement]);
        expect(p.ships.map((e) => edgeSides(s, e))).toEqual([ship]);
        const f = pi.fortresses.find((x) => x.playerId === pid)!;
        expect(cornerHexes(s, f.vertex)).toBe(fortress);
        expect(cornerHexes(s, f.beachhead)).toBe(beachhead);
        expect(f.lairs).toBe(3);
      });
    });
  }

  it('sails the fleet clockwise round the desert islets, skipping attacks on the "!" hex', () => {
    const s = game('pirateIslands', 6);
    const pi = s.pirateIslands!;
    expect(pi.path).toEqual([
      '1,-3', '2,-3', '2,-2', '1,-1', '0,0', '0,1', '0,2',
      '-1,3', '-2,3', '-2,2', '-2,1', '-2,0', '-1,-1', '0,-2',
    ]);
    // Consecutive loop hexes are neighbours, all sea.
    pi.path.forEach((h, i) => {
      const next = pi.path[(i + 1) % pi.path.length]!;
      const shared = s.board.hexes[h]!.corners.filter((v) => s.board.hexes[next]!.corners.includes(v));
      expect(shared).toHaveLength(2);
      expect(s.board.hexes[h]!.terrain).toBe('sea');
    });
    expect(pi.path[pi.fleetIndex]).toBe('-2,3');
    expect(s.board.pirateHex).toBe('-2,3');
    expect(pi.noAttackHex).toBe('-2,0');
    expect(s.robberActive).toBe(false);
  });

  it('puts the nine random harbors on the main island’s rulebook edges', () => {
    const s = game('pirateIslands', 5);
    expect(portSides(s)).toEqual(
      [
        key('4,-3', '4,-4'),
        key('5,-3', '5,-4'),
        key('5,-3', '6,-3'),
        key('5,-2', '6,-2'),
        key('4,0', '5,0'),
        key('3,2', '4,2'),
        key('2,3', '3,3'),
        key('1,3', '0,4'),
        key('2,3', '1,4'),
      ].sort(),
    );
    expect(portTypeCounts(s)).toEqual({ generic: 4, wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 1 });
  });
});

// ---------------------------------------------------------------- Wonders of Catan

const WONDERS_ROWS: Rows = [
  [-3, -2, 'G8 ~ P10 ~ W12 ~ ~ ~'],
  [-2, -3, '~ ~ B11 ~ F11 ~ ~ D D'],
  [-1, -4, '~ B2 P5 W6 B5 W3 P8 F11 D ~'],
  [0, -5, '~ ~ W9 O3 F4 O6 W10 P9 B10 D ~'],
  [1, -5, '~ ~ B8 P5 ~ B4 F8 O12 ~ ~'],
  [2, -5, 'G6 ~ F10 O3 ~ O9 W4 ~ F4'],
  [3, -5, '~ O5 F9 ~ P2 P11 ~ G6'],
];

describe('The Wonders of Catan, 5-6 players', () => {
  for (const n of [5, 6]) {
    it(`${n}p: every hex, the counts, the robber and 7 wonders`, () => {
      const s = game('wondersOfCatan', n);
      expectBoard(s, WONDERS_ROWS);
      const c = counts(s);
      expect(c.terrain).toEqual(terrainTable([24, 3, 6, 7, 7, 6, 6, 4]));
      expect(c.discs).toEqual(discTable([2, 3, 4, 4, 4, 4, 4, 4, 4, 2]));
      expect(s.board.robberHex).toBe('4,-1');
      expect(s.board.pirateHex).toBeUndefined();
      expect(s.wonders).toHaveLength(7);
      // Three small islands, 1 VP each: (-2,-3); (-5,2); (3,2) + (2,3).
      const islandOf = s.board.islandOfHex!;
      expect(s.islandChips!.map((ch) => ch.islandId).sort()).toEqual(
        [islandOf['-2,-3'], islandOf['-5,2'], islandOf['3,2']].sort(),
      );
      expect(islandOf['2,3']).toBe(islandOf['3,2']);
      expect(s.islandChips!.every((ch) => ch.vp === 1)).toBe(true);
    });
  }

  it('puts the wonder markers and X markers on the rulebook corners', () => {
    const s = game('wondersOfCatan', 6);
    const corners = (vs: VertexId[] | undefined) => (vs ?? []).map((v) => cornerHexes(s, v)).sort();
    const wall = [
      key('3,-1', '3,-2', '4,-2'),
      key('3,-1', '4,-2', '4,-1'),
      key('3,-1', '4,-1', '3,0'),
      key('3,0', '4,-1', '4,0'),
      key('3,0', '4,0', '3,1'),
    ];
    const bridge = [key('-2,2', '-1,2', '-2,3'), key('-1,3', '-2,3', '-1,2')];
    const lighthouse = [key('0,-3', '1,-3', '0,-2'), key('1,-2', '0,-2', '1,-3')];
    const xMarkers = [
      key('-2,2', '-1,1', '-1,2'),
      key('-2,2', '-2,3', '-3,3'),
      key('-1,3', '-1,2', '0,2'),
      key('-1,3', '-2,4', '-2,3'),
      key('0,-3', '1,-4', '1,-3'),
      key('0,-3', '0,-2', '-1,-2'),
      key('1,-2', '1,-3', '2,-3'),
      key('1,-2', '0,-1', '0,-2'),
    ];
    expect(corners(s.wonderSites!.greatWall)).toEqual(wall.sort());
    expect(corners(s.wonderSites!.greatBridge)).toEqual(bridge.sort());
    expect(corners(s.wonderSites!.lighthouse)).toEqual(lighthouse.sort());
    // No starting settlement on any marker or X.
    expect([...new Set(corners(s.setupBlockedVertices))].sort()).toEqual(
      [...wall, ...bridge, ...lighthouse, ...xMarkers].sort(),
    );
  });

  it('puts the eleven random harbors on the rulebook edges', () => {
    const s = game('wondersOfCatan', 5);
    expect(portSides(s)).toEqual(
      [
        key('-2,-1', '-2,-2'),
        key('-1,-1', '0,-2'),
        key('1,-1', '2,-2'),
        key('-3,-1', '-4,-1'),
        key('-1,0', '-1,1'),
        key('-3,1', '-4,1'),
        key('2,1', '2,2'),
        key('-3,2', '-4,2'),
        key('1,2', '1,3'),
        key('-4,3', '-4,4'),
        key('-1,3', '-1,4'),
      ].sort(),
    );
    expect(portTypeCounts(s)).toEqual(RANDOM_11_PORTS);
  });
});
