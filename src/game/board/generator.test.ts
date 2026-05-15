import { describe, it, expect } from 'vitest';
import { generateBoard } from './generator';
import { buildHexAdjacency } from './adjacency';

describe('generateBoard', () => {
  it('produces 19 hexes with correct terrain distribution', () => {
    const { board } = generateBoard(42);
    const terrainCounts: Record<string, number> = {};
    for (const h of Object.values(board.hexes)) {
      terrainCounts[h.terrain] = (terrainCounts[h.terrain] ?? 0) + 1;
    }
    expect(terrainCounts).toEqual({
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 4,
      ore: 3,
      desert: 1,
    });
  });

  it('places number tokens 2-12 with correct distribution, none on desert', () => {
    const { board } = generateBoard(42);
    const tokenCounts: Record<number, number> = {};
    let nonDesertTokens = 0;
    for (const h of Object.values(board.hexes)) {
      if (h.terrain === 'desert') {
        expect(h.numberToken).toBeNull();
      } else {
        expect(h.numberToken).not.toBeNull();
        tokenCounts[h.numberToken!] = (tokenCounts[h.numberToken!] ?? 0) + 1;
        nonDesertTokens++;
      }
    }
    expect(nonDesertTokens).toBe(18);
    expect(tokenCounts).toEqual({
      2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1,
    });
  });

  it('does not place 6/8 adjacent to each other', () => {
    // Verify across several seeds
    for (const seed of [1, 7, 42, 100, 999, 12345]) {
      const { board } = generateBoard(seed);
      const adj = buildHexAdjacency(board);
      for (const h of Object.values(board.hexes)) {
        const t = h.numberToken;
        if (t !== 6 && t !== 8) continue;
        for (const neighbor of adj.get(h.id) ?? []) {
          const nt = board.hexes[neighbor]!.numberToken;
          expect(nt === 6 || nt === 8).toBe(false);
        }
      }
    }
  });

  it('places 9 ports with 4 generic and 5 specific', () => {
    const { board } = generateBoard(42);
    expect(board.ports).toHaveLength(9);
    const counts: Record<string, number> = {};
    for (const p of board.ports) counts[p.type] = (counts[p.type] ?? 0) + 1;
    expect(counts['generic']).toBe(4);
    expect(counts['wood']).toBe(1);
    expect(counts['brick']).toBe(1);
    expect(counts['sheep']).toBe(1);
    expect(counts['wheat']).toBe(1);
    expect(counts['ore']).toBe(1);
  });

  it('places ports only on coastal edges (single-hex edges)', () => {
    const { board } = generateBoard(42);
    for (const port of board.ports) {
      expect(board.edges[port.edge]!.hexes).toHaveLength(1);
    }
  });

  it('places robber on the desert hex', () => {
    const { board } = generateBoard(42);
    expect(board.hexes[board.robberHex]!.terrain).toBe('desert');
  });

  it('is deterministic for the same seed', () => {
    const { board: a } = generateBoard(42);
    const { board: b } = generateBoard(42);
    expect(a.hexes).toEqual(b.hexes);
    expect(a.ports).toEqual(b.ports);
    expect(a.robberHex).toBe(b.robberHex);
  });

  describe("5-6 player variant", () => {
    it('produces 30 hexes with correct terrain distribution', () => {
      const { board } = generateBoard(42, '5-6');
      expect(Object.keys(board.hexes)).toHaveLength(30);
      const terrainCounts: Record<string, number> = {};
      for (const h of Object.values(board.hexes)) {
        terrainCounts[h.terrain] = (terrainCounts[h.terrain] ?? 0) + 1;
      }
      expect(terrainCounts).toEqual({
        wood: 6,
        brick: 5,
        sheep: 6,
        wheat: 6,
        ore: 5,
        desert: 2,
      });
    });

    it('places 28 number tokens, none on the 2 deserts', () => {
      const { board } = generateBoard(42, '5-6');
      let nonDesertTokens = 0;
      for (const h of Object.values(board.hexes)) {
        if (h.terrain === 'desert') {
          expect(h.numberToken).toBeNull();
        } else {
          expect(h.numberToken).not.toBeNull();
          nonDesertTokens++;
        }
      }
      expect(nonDesertTokens).toBe(28);
    });

    it('places 11 ports', () => {
      const { board } = generateBoard(42, '5-6');
      expect(board.ports).toHaveLength(11);
      // All ports still on coastal (single-hex) edges
      for (const port of board.ports) {
        expect(board.edges[port.edge]!.hexes).toHaveLength(1);
      }
    });

    it('places robber on a desert hex', () => {
      const { board } = generateBoard(42, '5-6');
      expect(board.hexes[board.robberHex]!.terrain).toBe('desert');
    });
  });
});
