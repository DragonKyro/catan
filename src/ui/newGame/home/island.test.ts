import { describe, expect, it } from 'vitest';
import { BUILDINGS, HARBORS, ISLAND, ROADS, axialToPixel, hexesAtCorner } from './island';

// The home screen's island should look like a game you could actually play.
describe('home screen island', () => {
  it('has the base game tiles and number discs', () => {
    const terrains: Record<string, number> = {};
    for (const h of ISLAND) terrains[h.terrain] = (terrains[h.terrain] ?? 0) + 1;
    expect(terrains).toEqual({ wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, desert: 1 });
    const numbers = ISLAND.map((h) => h.number).filter((n): n is number => n !== null).sort((a, b) => a - b);
    expect(numbers).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
    expect(ISLAND.find((h) => h.terrain === 'desert')!.number).toBeNull();
  });

  it('keeps 6s and 8s apart', () => {
    const red = ISLAND.filter((h) => h.number === 6 || h.number === 8);
    for (const a of red) {
      for (const b of red) {
        if (a === b) continue;
        const pa = axialToPixel(a.q, a.r);
        const pb = axialToPixel(b.q, b.r);
        expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeGreaterThan(70); // neighbours are ~59 apart
      }
    }
  });

  it('places pieces on the island: buildings on land corners two edges apart, harbors on the coast', () => {
    for (const b of BUILDINGS) expect(hexesAtCorner(b.hex, b.corner).length).toBeGreaterThan(0);
    for (const r of ROADS) {
      expect(hexesAtCorner(r.hex, r.from).length).toBeGreaterThan(0);
      expect(hexesAtCorner(r.hex, r.from + 1).length).toBeGreaterThan(0);
    }
    // Distance rule: no two buildings on adjacent (or the same) corners.
    const corners = BUILDINGS.map((b) => {
      const c = axialToPixel(b.hex[0], b.hex[1]);
      const a = (Math.PI / 180) * (-90 + 60 * b.corner);
      return { x: c.x + 34 * Math.cos(a), y: c.y + 34 * Math.sin(a) };
    });
    for (let i = 0; i < corners.length; i++) {
      for (let j = i + 1; j < corners.length; j++) {
        expect(Math.hypot(corners[i]!.x - corners[j]!.x, corners[i]!.y - corners[j]!.y)).toBeGreaterThan(40);
      }
    }
    // A harbor's edge touches exactly one island hex: it's on the coast.
    for (const h of HARBORS) {
      const a = hexesAtCorner(h.hex, h.from);
      const b = hexesAtCorner(h.hex, h.from + 1);
      expect(a.filter((i) => b.includes(i))).toHaveLength(1);
    }
  });
});
