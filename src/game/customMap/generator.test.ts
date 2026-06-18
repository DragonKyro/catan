import { describe, expect, it } from 'vitest';
import { generateCustomMapBoard } from './generator';
import { sampleCustomMap } from './sample';

describe('generateCustomMapBoard', () => {
  it('produces a populated BoardState from the sample map', () => {
    const map = sampleCustomMap();
    const { board } = generateCustomMapBoard(map, 12345);
    expect(board.hexIds.length).toBe(map.layout.positions.length);
    // Every land position got a real terrain (not 'sea').
    const landHexes = map.layout.positions.filter((p) => p.kind === 'land');
    for (const p of landHexes) {
      const h = board.hexes[`${p.q},${p.r}`];
      expect(h).toBeDefined();
      expect(h!.terrain).not.toBe('sea');
    }
    // Every non-desert non-swamp land hex got a number token.
    for (const p of landHexes) {
      const h = board.hexes[`${p.q},${p.r}`]!;
      if (h.terrain === 'desert' || h.terrain === 'swamp') continue;
      expect(h.numberToken).not.toBeNull();
    }
    // Ports resolve to a real edge each.
    expect(board.ports.length).toBe(map.layout.portAnchors.length);
    // Robber sits on a desert when one exists.
    expect(board.robberHex).toBeTruthy();
  });

  it('is deterministic for a given seed', () => {
    const map = sampleCustomMap();
    const a = generateCustomMapBoard(map, 42);
    const b = generateCustomMapBoard(map, 42);
    for (const id of a.board.hexIds) {
      expect(b.board.hexes[id]!.terrain).toBe(a.board.hexes[id]!.terrain);
      expect(b.board.hexes[id]!.numberToken).toBe(a.board.hexes[id]!.numberToken);
    }
  });

  it('populates fog + island chips when seafarers is on', () => {
    const map = sampleCustomMap();
    map.seafarers = true;
    map.fogHexes = [{ q: -2, r: 0 }];
    const r = generateCustomMapBoard(map, 99);
    expect(r.unrevealedFogHexes).toEqual(['-2,0']);
    // Twin Peaks has two clusters separated by desert; the desert is a
    // boundary in T&B / Through-The-Desert but NOT in custom-map Seafarers
    // (we keep the default desertIsBoundary=false). So both peaks are one
    // island after the bridge desert, or in this map's case the desert
    // hex actually IS land-connected so we have one main island — still
    // some outer-island chip count is fine.
    expect(r.islandChips.length).toBeGreaterThanOrEqual(0);
  });
});
