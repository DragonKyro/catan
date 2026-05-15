import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

// Heading for New Shores — the canonical Seafarers introductory scenario.
// Main island (centre-left) plus three smaller outer islands, with two gold
// hexes. The 5-6 player variant adds a fourth outer island chain and a
// third gold hex on the radius-4 grid.

const MAIN_ISLAND: ScenarioHexDef[] = [
  { q: 0, r: 0, terrain: 'wheat', token: 6 },
  { q: 1, r: 0, terrain: 'sheep', token: 4 },
  { q: 1, r: -1, terrain: 'wood', token: 11 },
  { q: 0, r: -1, terrain: 'brick', token: 8 },
  { q: -1, r: 0, terrain: 'ore', token: 5 },
  { q: -1, r: 1, terrain: 'wheat', token: 3 },
  { q: 0, r: 1, terrain: 'wood', token: 9 },
  { q: -2, r: 1, terrain: 'wood', token: 10 },
  { q: -2, r: 2, terrain: 'sheep', token: 8 },
  { q: -1, r: 2, terrain: 'desert', token: null },
  { q: -2, r: 0, terrain: 'brick', token: 2 },
  { q: 0, r: -2, terrain: 'ore', token: 12 },
  { q: -1, r: -1, terrain: 'sheep', token: 4 },
];

const OUTER_ISLANDS: ScenarioHexDef[] = [
  { q: 2, r: -3, terrain: 'gold', token: 5 },
  { q: 3, r: -3, terrain: 'ore', token: 9 },
  { q: 3, r: -1, terrain: 'wheat', token: 11 },
  { q: 3, r: 0, terrain: 'sheep', token: 3 },
  { q: 2, r: 1, terrain: 'wood', token: 6 },
  { q: 0, r: 3, terrain: 'brick', token: 10 },
  { q: -1, r: 3, terrain: 'gold', token: 4 },
];

// 5-6 player additions: another outer island to the west and an extension
// to the eastern island, plus a third gold hex.
const EXTRA_5_6: ScenarioHexDef[] = [
  { q: -4, r: 1, terrain: 'ore', token: 3 },
  { q: -4, r: 2, terrain: 'wood', token: 6 },
  { q: -3, r: 3, terrain: 'sheep', token: 11 },
  { q: -4, r: 4, terrain: 'wheat', token: 5 },
  { q: 4, r: -2, terrain: 'gold', token: 10 },
  { q: 4, r: 0, terrain: 'brick', token: 8 },
  { q: 1, r: 3, terrain: 'sheep', token: 9 },
  { q: 2, r: 2, terrain: 'wheat', token: 12 },
];

export const headingForNewShores = buildScenario({
  id: 'headingForNewShores',
  name: 'Heading for New Shores',
  defaultIslandBonusVp: 2,
  land: [...MAIN_ISLAND, ...OUTER_ISLANDS],
  ports: [
    { q: 1, r: -1, direction: 0, type: 'generic' },
    { q: 1, r: 0, direction: 1, type: 'ore' },
    { q: 0, r: 1, direction: 1, type: 'wheat' },
    { q: -2, r: 2, direction: 3, type: 'generic' },
    { q: -2, r: 0, direction: 4, type: 'sheep' },
    { q: 0, r: -2, direction: 5, type: 'wood' },
  ],
  landExtra5_6: EXTRA_5_6,
  ports5_6: [
    { q: 1, r: -1, direction: 0, type: 'generic' },
    { q: 1, r: 0, direction: 1, type: 'ore' },
    { q: 0, r: 1, direction: 1, type: 'wheat' },
    { q: -2, r: 2, direction: 3, type: 'generic' },
    { q: -4, r: 2, direction: 5, type: 'sheep' },
    { q: 0, r: -2, direction: 5, type: 'wood' },
    { q: 4, r: 0, direction: 2, type: 'generic' },
    { q: -4, r: 4, direction: 4, type: 'brick' },
  ],
});
