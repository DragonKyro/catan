import { describe, expect, it } from 'vitest';
import type { BoardState, HexId, PortType, Terrain } from '../../../types';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { currentPlayerId } from '../../../helpers';
import { canMoveRobberTo, canPlaceInitialSettlement } from '../../../placement';
import { generateSeafarersBoard } from './generator';
import { identifyIslands } from './islands';
import { isPortEligibleEdge } from './edges';
import { generateNewWorldLayout, newWorldSpec, NEW_WORLD_3_4, NEW_WORLD_5_6 } from './newWorldBoard';
import { getScenario } from './scenarios';

// New World deals a random board every game (rulebook p.20 / 5-6 p.12;
// docs/map-specs/NEWWORLD-SPEC.md).

const board = (seed: number, n: number) => generateSeafarersBoard('newWorld', seed, n);

function counts<T extends string | number>(xs: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[String(x)] = (out[String(x)] ?? 0) + 1;
  return out;
}

function hexNeighbours(b: BoardState, id: HexId): HexId[] {
  const out = new Set<HexId>();
  for (const e of Object.values(b.edges)) {
    if (e.hexes.length === 2 && e.hexes.includes(id)) out.add(e.hexes.find((h) => h !== id)!);
  }
  return [...out];
}

const isRed = (n: number | null) => n === 6 || n === 8;

// Every board property the rulebook (and the project's rules) asks for.
function checkBoard(seed: number, n: number): void {
  const spec = newWorldSpec(n);
  const r = board(seed, n);
  const b = r.board;
  const hexes = b.hexIds.map((id) => b.hexes[id]!);

  // The rulebook frame, every position filled.
  const rows = [-3, -2, -1, 0, 1, 2, 3].map((row) => hexes.filter((h) => h.coord.r === row).length);
  expect(rows).toEqual(n >= 5 ? [8, 9, 10, 9, 10, 9, 8] : [5, 6, 7, 6, 7, 6, 5]);
  expect(hexes).toHaveLength(n >= 5 ? 63 : 42);

  // Hex and disc counts from the component table.
  expect(counts(hexes.map((h) => h.terrain))).toEqual(counts(expand(spec.hexes)));
  const producing = hexes.filter((h) => h.terrain !== 'sea' && h.terrain !== 'desert');
  expect(counts(producing.map((h) => h.numberToken!))).toEqual(counts([...spec.discs]));
  for (const h of hexes) {
    if (h.terrain === 'sea' || h.terrain === 'desert') expect(h.numberToken).toBeNull();
    expect(h.extraNumbers).toBeUndefined();
  }

  // Red discs never touch, and never sit on gold.
  for (const h of producing) {
    if (!isRed(h.numberToken)) continue;
    expect(h.terrain).not.toBe('gold');
    for (const nb of hexNeighbours(b, h.id)) expect(isRed(b.hexes[nb]!.numberToken)).toBe(false);
  }

  // Harbors: the right tokens, each on a land / sea or land / frame edge,
  // none sharing a corner with another.
  expect(counts(b.ports.map((p) => p.type))).toEqual(counts([...spec.ports]));
  const corners = new Set<string>();
  for (const p of b.ports) {
    expect(isPortEligibleEdge(b, p.edge)).toBe(true);
    for (const v of b.edges[p.edge]!.vertices) {
      expect(corners.has(v)).toBe(false);
      corners.add(v);
    }
  }

  // Islands: the archipelago the shape step aims for, all separated by sea.
  const islands = identifyIslands(b);
  const sizes = counts(Object.values(islands.hexToIsland));
  const k = Object.keys(sizes).length;
  expect(k).toBeGreaterThanOrEqual(Math.min(...spec.islandCounts));
  expect(k).toBeLessThanOrEqual(Math.max(...spec.islandCounts));
  for (const s of Object.values(sizes)) {
    expect(s).toBeGreaterThanOrEqual(spec.minIslandSize);
    expect(s).toBeLessThanOrEqual(spec.maxIslandSize);
  }
  // Every island has at least two producing hexes.
  for (const id of Object.keys(sizes)) {
    const prod = producing.filter((h) => islands.hexToIsland[h.id] === id).length;
    expect(prod).toBeGreaterThanOrEqual(2);
  }
  // A 1 VP chip on every island (players may start anywhere).
  expect(r.islandChips.map((c) => c.islandId).sort()).toEqual(Object.keys(sizes).sort());
  expect(r.islandChips.every((c) => c.vp === 1)).toBe(true);
  expect(b.islandOfHex).toEqual(islands.hexToIsland);

  // Pirate on a sea hex; robber beside the board.
  expect(b.hexes[b.pirateHex!]!.terrain).toBe('sea');
  expect(r.robberOffBoard).toBe(true);
}

function expand(pool: Partial<Record<Terrain, number>>): Terrain[] {
  const out: Terrain[] = [];
  for (const [t, c] of Object.entries(pool)) for (let i = 0; i < (c ?? 0); i++) out.push(t as Terrain);
  return out;
}

describe('New World random board', () => {
  it('follows the rulebook component tables', () => {
    // 3-4p: 19 sea + 23 land in a 42-hex frame, 23 discs, 10 harbors.
    expect(expand(NEW_WORLD_3_4.hexes)).toHaveLength(42);
    expect(NEW_WORLD_3_4.discs).toHaveLength(23);
    expect(counts([...NEW_WORLD_3_4.discs])).toEqual({
      2: 1, 3: 3, 4: 3, 5: 3, 6: 2, 8: 2, 9: 3, 10: 3, 11: 2, 12: 1,
    });
    const ports34 = counts([...NEW_WORLD_3_4.ports]);
    expect(ports34.generic).toBe(5);
    expect(NEW_WORLD_3_4.ports).toHaveLength(10);
    // 5-6p: 21 sea + 42 land (4 gold, 3 deserts) in a 63-hex frame, 39
    // discs, 11 harbors (the 5-6 box adds a wool 2:1).
    expect(expand(NEW_WORLD_5_6.hexes)).toHaveLength(63);
    expect(NEW_WORLD_5_6.discs).toHaveLength(39);
    expect(counts([...NEW_WORLD_5_6.discs])).toEqual({
      2: 2, 3: 3, 4: 4, 5: 5, 6: 5, 8: 5, 9: 5, 10: 4, 11: 4, 12: 2,
    });
    expect(counts([...NEW_WORLD_5_6.ports])).toEqual({
      generic: 5, wood: 1, brick: 1, sheep: 2, wheat: 1, ore: 1,
    } satisfies Partial<Record<PortType, number>>);
  });

  it('is deterministic per seed', () => {
    for (const n of [3, 4, 5, 6]) {
      expect(board(77, n)).toEqual(board(77, n));
      const [a, ra] = generateNewWorldLayout(n, 123);
      const [b, rb] = generateNewWorldLayout(n, 123);
      expect(a).toEqual(b);
      expect(ra).toBe(rb);
    }
  });

  it('deals a different board for different seeds', () => {
    for (const n of [3, 5]) {
      const shapes = new Set<string>();
      const boards = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) {
        const b = board(seed, n).board;
        shapes.add(b.hexIds.filter((id) => b.hexes[id]!.terrain !== 'sea').join(';'));
        boards.add(
          b.hexIds.map((id) => `${id}:${b.hexes[id]!.terrain}:${b.hexes[id]!.numberToken}`).join(';'),
        );
      }
      expect(boards.size).toBe(30);
      expect(shapes.size).toBeGreaterThanOrEqual(28);
    }
  });

  it('gives every board the rulebook frame, counts, discs, harbors and islands', () => {
    for (const n of [3, 4, 5, 6]) checkBoard(1, n);
  });

  it('holds up over 200 seeds at 3-4 and 5-6 players', () => {
    for (let seed = 1; seed <= 200; seed++) {
      checkBoard(seed * 2654435761, 3);
      checkBoard(seed * 2654435761, 5);
    }
  });

  it('draws no randomness for the other scenarios', () => {
    for (const s of ['headingForNewShores', 'fourIslands', 'pirateIslands', 'wondersOfCatan']) {
      expect(getScenario(s).randomLayout).toBeUndefined();
    }
    expect(getScenario('newWorld').randomLayout).toBe(generateNewWorldLayout);
  });
});

describe('New World games', () => {
  const start = (n: number, seed: number) =>
    createGame({
      playerNames: Array.from({ length: n }, (_, i) => `P${i}`),
      seed,
      settings: { expansions: ['seafarers'], scenarioId: 'newWorld' },
      randomizeTurnOrder: false,
    });

  it('starts with the robber beside the board and 12 VP to win', () => {
    for (const n of [3, 4, 5, 6]) {
      const g = start(n, 5);
      expect(g.robberActive).toBe(false);
      expect(g.settings.victoryPointsToWin).toBe(12);
      // Nothing is blocked while the robber waits: every land hex is a
      // legal first target, the parking hex included.
      for (const id of g.board.hexIds) {
        expect(canMoveRobberTo(g, id)).toBe(g.board.hexes[id]!.terrain !== 'sea');
      }
      expect(g.startingIslands).toBeUndefined();
    }
  });

  it('has room for every player to start, on any island', () => {
    for (const n of [3, 4, 5, 6]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const g = start(n, seed);
        // Greedy distance-rule packing of the starting spots.
        const picked = new Set<string>();
        const islandsUsed = new Set<string>();
        for (const v of g.board.vertexIds) {
          if (!canPlaceInitialSettlement(g, v)) continue;
          if (g.board.vertices[v]!.neighborVertices.some((nb) => picked.has(nb))) continue;
          picked.add(v);
          for (const h of g.board.vertices[v]!.hexes) {
            const isl = g.board.islandOfHex?.[h];
            if (isl) islandsUsed.add(isl);
          }
        }
        expect(picked.size).toBeGreaterThanOrEqual(4 * n);
        expect(islandsUsed.size).toBe(g.islandChips!.length);
      }
    }
  });

  it('puts the robber on the board at the first 7', () => {
    let g = start(3, 9);
    const land = g.board.hexIds.find((id) => g.board.hexes[id]!.terrain !== 'sea')!;
    g = {
      ...g,
      phase: 'moveRobber',
      pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' },
    };
    g = applyAction(g, { type: 'moveRobber', playerId: currentPlayerId(g), hex: land, stealFrom: null });
    expect(g.robberActive).toBe(true);
    expect(g.board.robberHex).toBe(land);
  });
});
