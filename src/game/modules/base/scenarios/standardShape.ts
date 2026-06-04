import type { ScenarioPortAnchor, ScenarioPosition } from '../../../board/scenarioTypes';

// Shared geometry for Fun Maps that reuse the standard 19/30-hex hexagon
// shape (Gold Rush, Volcano, Black Forest, Pond). Centralizes the position
// list and port-anchor list so each scenario only declares its terrain pool
// and any per-position overrides (fixedTerrain, kind: 'sea', forceToken).

// Radius-2 hexagon = 19 land positions. Listed in spiral order for stable
// iteration. Caller may override individual entries via spread + map.
export function standardLand3_4(): ScenarioPosition[] {
  return [
    { q: 0, r: -2, kind: 'land' },
    { q: 1, r: -2, kind: 'land' },
    { q: 2, r: -2, kind: 'land' },
    { q: -1, r: -1, kind: 'land' },
    { q: 0, r: -1, kind: 'land' },
    { q: 1, r: -1, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    { q: -2, r: 0, kind: 'land' },
    { q: -1, r: 0, kind: 'land' },
    { q: 0, r: 0, kind: 'land' },
    { q: 1, r: 0, kind: 'land' },
    { q: 2, r: 0, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -1, r: 1, kind: 'land' },
    { q: 0, r: 1, kind: 'land' },
    { q: 1, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -1, r: 2, kind: 'land' },
    { q: 0, r: 2, kind: 'land' },
  ];
}

// 9 ports evenly spaced clockwise around the radius-2 perimeter. Each anchor
// faces an outside-the-disk sea hex (the radius-3 fill handles those).
export const STANDARD_PORT_ANCHORS_3_4: ScenarioPortAnchor[] = [
  { q: 0, r: -2, direction: 5 }, // → (1, -3) NE
  { q: 2, r: -2, direction: 0 }, // → (3, -2) E
  { q: 2, r: -1, direction: 0 }, // → (3, -1) E
  { q: 2, r: 0, direction: 1 }, // → (2, 1) SE
  { q: 1, r: 1, direction: 1 }, // → (1, 2) SE
  { q: -1, r: 2, direction: 2 }, // → (-2, 3) SW
  { q: -2, r: 2, direction: 3 }, // → (-3, 2) W
  { q: -2, r: 0, direction: 3 }, // → (-3, 0) W
  { q: -1, r: -1, direction: 4 }, // → (-1, -2) NW
];

// Radius-extended 30-hex shape used by the base game's 5-6p extension
// (rows of 3-4-5-6-5-4-3). Symmetric around q ≈ -0.5.
export function standardLand5_6(): ScenarioPosition[] {
  const out: ScenarioPosition[] = [];
  const rows: Array<[number, number, number]> = [
    [-3, 0, 2],
    [-2, -1, 2],
    [-1, -2, 2],
    [0, -3, 2],
    [1, -3, 1],
    [2, -3, 0],
    [3, -3, -1],
  ];
  for (const [r, qMin, qMax] of rows) {
    for (let q = qMin; q <= qMax; q++) out.push({ q, r, kind: 'land' });
  }
  return out;
}

// 11 ports evenly spaced clockwise around the 5-6p perimeter.
export const STANDARD_PORT_ANCHORS_5_6: ScenarioPortAnchor[] = [
  { q: 0, r: -3, direction: 4 },
  { q: 1, r: -3, direction: 5 },
  { q: 2, r: -2, direction: 0 },
  { q: 2, r: -1, direction: 0 },
  { q: 2, r: 0, direction: 1 },
  { q: 1, r: 1, direction: 1 },
  { q: 0, r: 2, direction: 1 },
  { q: -1, r: 3, direction: 2 },
  { q: -3, r: 3, direction: 3 },
  { q: -3, r: 1, direction: 3 },
  { q: -2, r: -1, direction: 4 },
];
