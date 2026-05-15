import type { ScenarioHexDef } from '../types';

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
