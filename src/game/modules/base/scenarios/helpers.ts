import type { ScenarioPosition } from '../../../board/scenarioTypes';

// Fill the radius-`radius` axial-coord disk with `kind: 'sea'` positions,
// skipping any coord already in `landPositions`. Lets a scenario declare just
// its land frame + a call to this helper to materialize the surrounding sea.
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

// Enumerate every (q, r) on a radius-`radius` axial hexagon (the standard
// shape: 1, 7, 19, 37 hexes for radii 0, 1, 2, 3).
export function hexagonalDisk(radius: number): Array<{ q: number; r: number }> {
  const out: Array<{ q: number; r: number }> = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > radius) continue;
      out.push({ q, r });
    }
  }
  return out;
}

// Generic-land helper: turn a list of (q, r) into `kind: 'land'` positions
// with no fixed terrain.
export function landPositions(
  coords: Array<{ q: number; r: number }>,
): ScenarioPosition[] {
  return coords.map((c) => ({ q: c.q, r: c.r, kind: 'land' as const }));
}
