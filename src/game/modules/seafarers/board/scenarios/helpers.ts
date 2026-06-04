import type { ScenarioHexDef, ScenarioPosition } from '../types';

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
