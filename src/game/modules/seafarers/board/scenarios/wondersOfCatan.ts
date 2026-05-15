import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const LAND: ScenarioHexDef[] = [
  { q: 0, r: 0, terrain: 'wheat', token: 6 },
  { q: 1, r: 0, terrain: 'sheep', token: 4 },
  { q: 1, r: -1, terrain: 'wood', token: 3 },
  { q: 0, r: -1, terrain: 'brick', token: 8 },
  { q: -1, r: 0, terrain: 'ore', token: 5 },
  { q: -1, r: 1, terrain: 'wheat', token: 11 },
  { q: 0, r: 1, terrain: 'wood', token: 9 },
  { q: -2, r: 1, terrain: 'desert', token: null },
  { q: -2, r: 2, terrain: 'sheep', token: 10 },
  { q: -2, r: 0, terrain: 'brick', token: 2 },
  { q: 2, r: -2, terrain: 'gold', token: 12 },
  { q: 0, r: -2, terrain: 'ore', token: 5 },
  { q: -1, r: -1, terrain: 'sheep', token: 4 },
  { q: 1, r: 1, terrain: 'wheat', token: 8 },
  { q: 2, r: -1, terrain: 'wood', token: 10 },
  { q: -1, r: 2, terrain: 'brick', token: 9 },
  { q: 0, r: 2, terrain: 'ore', token: 11 },
];

const EXTRA_5_6: ScenarioHexDef[] = [
  // Extend the main island outward (no new outer islands; the scenario's
  // theme is a single great island).
  { q: 3, r: -2, terrain: 'wheat', token: 6 },
  { q: 3, r: -3, terrain: 'sheep', token: 4 },
  { q: 3, r: 0, terrain: 'wood', token: 11 },
  { q: 2, r: 1, terrain: 'brick', token: 3 },
  { q: -3, r: 1, terrain: 'gold', token: 8 },
  { q: -3, r: 3, terrain: 'wheat', token: 5 },
  { q: 1, r: 2, terrain: 'ore', token: 10 },
  { q: 1, r: -3, terrain: 'sheep', token: 9 },
];

export const wondersOfCatan = buildScenario({
  id: 'wondersOfCatan',
  name: 'The Wonders of Catan',
  defaultIslandBonusVp: 2,
  land: LAND,
  ports: [
    { q: 1, r: -1, direction: 4, type: 'generic' },
    { q: 2, r: -1, direction: 0, type: 'wood' },
    { q: 2, r: -2, direction: 5, type: 'ore' },
    { q: 0, r: 2, direction: 2, type: 'wheat' },
    { q: -1, r: 2, direction: 1, type: 'sheep' },
    { q: -2, r: 2, direction: 3, type: 'generic' },
    { q: -2, r: 0, direction: 4, type: 'brick' },
    { q: 0, r: -2, direction: 5, type: 'generic' },
  ],
  landExtra5_6: EXTRA_5_6,
  ports5_6: [
    { q: 1, r: -1, direction: 4, type: 'generic' },
    { q: 2, r: -1, direction: 0, type: 'wood' },
    { q: 2, r: -2, direction: 3, type: 'ore' },
    { q: 0, r: 2, direction: 2, type: 'wheat' },
    { q: -1, r: 2, direction: 1, type: 'sheep' },
    { q: -2, r: 2, direction: 3, type: 'generic' },
    { q: -2, r: 0, direction: 4, type: 'brick' },
    { q: 0, r: -2, direction: 3, type: 'generic' },
  ],
});
