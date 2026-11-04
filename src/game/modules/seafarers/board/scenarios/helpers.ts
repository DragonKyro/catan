import type { ScenarioHexDef, ScenarioPosition, Terrain } from '../types';

// Fill a bounded hex grid (max radius `radius`) with sea hexes, skipping
// any coordinate already claimed by the scenario's land list.
export function fillSea(land: ScenarioHexDef[], radius: number): ScenarioHexDef[] {
  const occupied = new Set(land.map((h) => `${h.q},${h.r}`));
  const out: ScenarioHexDef[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > radius) continue;
      if (occupied.has(`${q},${r}`)) continue;
      out.push({ q, r, terrain: 'sea', token: null });
    }
  }
  return out;
}

// Modular-layout equivalent of `fillSea`: enumerate every coord inside the
// radius-`radius` disk that isn't already in `landPositions`, returning them
// as `kind: 'sea'` positions. Lets scenarios concisely declare just their land
// frame + a call to this helper instead of hand-listing every sea cell.
export function seaPositionsInDisk(
  landPositions: ScenarioPosition[],
  radius: number,
): ScenarioPosition[] {
  const occupied = new Set(landPositions.map((p) => `${p.q},${p.r}`));
  const out: ScenarioPosition[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > radius) continue;
      if (occupied.has(`${q},${r}`)) continue;
      out.push({ q, r, kind: 'sea' });
    }
  }
  return out;
}

// A hex of a fixed (rulebook "Fixed Setup") map: [q, r, terrain, number].
// Sea and desert take no number; land with `null` gets no number disc.
export type FixedHex = [number, number, Terrain, (number | null)?];

export function fixedPositions(hexes: FixedHex[]): ScenarioPosition[] {
  return hexes.map(([q, r, terrain, token]): ScenarioPosition => {
    if (terrain === 'sea') return { q, r, kind: 'sea' };
    if (terrain === 'desert') return { q, r, kind: 'desert' };
    if (token == null) return { q, r, kind: 'land', fixedTerrain: terrain, noToken: true };
    return { q, r, kind: 'land', fixedTerrain: terrain, fixedToken: token };
  });
}

// Sea hexes for a fixed map, from [q, r] pairs.
export function seaHexes(coords: Array<[number, number]>): FixedHex[] {
  return coords.map(([q, r]): FixedHex => [q, r, 'sea']);
}
