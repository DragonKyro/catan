import { describe, it, expect } from 'vitest';
import { SCENARIO_ORDER } from './index';
import { generateSeafarersBoard } from '../generator';
import { identifyIslands } from '../islands';

describe('all Seafarers scenarios', () => {
  for (const { id, label } of SCENARIO_ORDER) {
    it(`${label} generates a valid 5-6 player board`, () => {
      const { board } = generateSeafarersBoard(id, 42, 6);
      let landCount = 0;
      let seaCount = 0;
      for (const hid of board.hexIds) {
        if (board.hexes[hid]!.terrain === 'sea') seaCount++;
        else landCount++;
      }
      expect(landCount).toBeGreaterThan(0);
      expect(seaCount).toBeGreaterThan(0);
      // 5-6 player boards should be on a radius-4 grid → 61 hexes total.
      expect(board.hexIds.length).toBe(61);
    });
    it(`${label} generates a valid board`, () => {
      const { board, islandChips } = generateSeafarersBoard(id, 42);
      // Sanity: at least some land, some sea
      let landCount = 0;
      let seaCount = 0;
      for (const hid of board.hexIds) {
        if (board.hexes[hid]!.terrain === 'sea') seaCount++;
        else landCount++;
      }
      expect(landCount).toBeGreaterThan(0);
      expect(seaCount).toBeGreaterThan(0);

      // Islands identified; chips for outer islands present.
      const islands = identifyIslands(board);
      expect(islands.mainIslandId).toBeTruthy();
      expect(islandChips.length).toBe(islands.outerIslandIds.length);

      // Pirate placed on sea hex.
      expect(board.pirateHex).toBeDefined();
      expect(board.hexes[board.pirateHex!]!.terrain).toBe('sea');

      // Robber placed on a hex (desert when present, otherwise any non-sea).
      expect(board.robberHex).toBeDefined();
      expect(board.hexes[board.robberHex]!.terrain).not.toBe('sea');

      // Every port edge exists in the graph.
      for (const port of board.ports) {
        expect(board.edges[port.edge]).toBeDefined();
      }
    });
  }
});
