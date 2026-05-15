import { describe, it, expect } from 'vitest';
import { generateSeafarersBoard } from './generator';
import { identifyIslands } from './islands';
import { classifyEdge } from './edges';
import { createGame } from '../../../createGame';

describe('seafarers board generator', () => {
  it('produces a board with sea, land, and gold hexes', () => {
    const { board } = generateSeafarersBoard('headingForNewShores', 42);
    const terrains = new Set(board.hexIds.map((id) => board.hexes[id]!.terrain));
    expect(terrains.has('sea')).toBe(true);
    expect(terrains.has('gold')).toBe(true);
    // Standard producing terrains
    expect(terrains.has('wood')).toBe(true);
    expect(terrains.has('brick')).toBe(true);
    expect(terrains.has('sheep')).toBe(true);
    expect(terrains.has('wheat')).toBe(true);
    expect(terrains.has('ore')).toBe(true);
  });

  it('places the robber on the desert and the pirate on a sea hex', () => {
    const { board } = generateSeafarersBoard('headingForNewShores', 42);
    expect(board.hexes[board.robberHex]!.terrain).toBe('desert');
    expect(board.pirateHex).toBeDefined();
    expect(board.hexes[board.pirateHex!]!.terrain).toBe('sea');
  });

  it('produces island chips for each outer island (not the main island)', () => {
    const { board, islandChips } = generateSeafarersBoard('headingForNewShores', 42);
    const islands = identifyIslands(board);
    expect(islandChips.length).toBe(islands.outerIslandIds.length);
    expect(islandChips.length).toBeGreaterThan(0);
    for (const chip of islandChips) {
      expect(chip.vp).toBe(2);
      expect(chip.firstSettler).toBeNull();
      expect(islands.outerIslandIds).toContain(chip.islandId);
    }
  });

  it('classifies edges by adjacent terrain', () => {
    const { board } = generateSeafarersBoard('headingForNewShores', 42);
    const seen = { land: 0, sea: 0, coastal: 0 };
    for (const eid of board.edgeIds) {
      seen[classifyEdge(board, eid)]++;
    }
    expect(seen.land).toBeGreaterThan(0);
    expect(seen.sea).toBeGreaterThan(0);
    expect(seen.coastal).toBeGreaterThan(0);
  });

  it('createGame with Seafarers expansion populates islandChips', () => {
    const state = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 7,
      settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores' },
      randomizeTurnOrder: false,
    });
    expect(state.islandChips).toBeDefined();
    expect(state.islandChips!.length).toBeGreaterThan(0);
    expect(state.board.pirateHex).toBeDefined();
    expect(state.board.islandOfHex).toBeDefined();
  });

  it('base game still works without Seafarers', () => {
    const state = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 7,
      randomizeTurnOrder: false,
    });
    expect(state.islandChips).toBeUndefined();
    expect(state.board.pirateHex).toBeUndefined();
    expect(state.board.hexIds.length).toBe(19);
  });
});
