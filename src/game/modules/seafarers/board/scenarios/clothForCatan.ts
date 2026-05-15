import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const MAIN: ScenarioHexDef[] = [
  { q: 0, r: 0, terrain: 'wheat', token: 5 },
  { q: 1, r: 0, terrain: 'wood', token: 4 },
  { q: 1, r: -1, terrain: 'sheep', token: 9 },
  { q: 0, r: -1, terrain: 'brick', token: 11 },
  { q: -1, r: 0, terrain: 'ore', token: 3 },
  { q: -1, r: 1, terrain: 'sheep', token: 8 },
  { q: 0, r: 1, terrain: 'wheat', token: 6 },
  { q: -2, r: 1, terrain: 'wood', token: 10 },
  { q: -1, r: -1, terrain: 'desert', token: null },
];

const CLOTH_ISLANDS: ScenarioHexDef[] = [
  { q: 2, r: -3, terrain: 'gold', token: 8 },
  { q: 3, r: -3, terrain: 'sheep', token: 5 },
  { q: 3, r: -1, terrain: 'gold', token: 6 },
  { q: 3, r: 0, terrain: 'wheat', token: 11 },
  { q: -1, r: 3, terrain: 'sheep', token: 4 },
  { q: 0, r: 3, terrain: 'gold', token: 9 },
];

const EXTRA_5_6: ScenarioHexDef[] = [
  { q: 4, r: -3, terrain: 'wood', token: 5 },
  { q: 4, r: -1, terrain: 'gold', token: 8 },
  { q: 4, r: 0, terrain: 'ore', token: 11 },
  { q: -2, r: 3, terrain: 'wheat', token: 6 },
  { q: 1, r: 3, terrain: 'gold', token: 10 },
  { q: -3, r: 0, terrain: 'brick', token: 3 },
];

export const clothForCatan = buildScenario({
  id: 'clothForCatan',
  name: 'Cloth for Catan',
  defaultIslandBonusVp: 3,
  land: [...MAIN, ...CLOTH_ISLANDS],
  ports: [
    { q: 1, r: -1, direction: 0, type: 'generic' },
    { q: 1, r: 0, direction: 1, type: 'sheep' },
    { q: 0, r: 1, direction: 2, type: 'wheat' },
    { q: -2, r: 1, direction: 3, type: 'wood' },
    { q: 0, r: -1, direction: 5, type: 'brick' },
    { q: -1, r: 0, direction: 3, type: 'ore' },
  ],
  landExtra5_6: EXTRA_5_6,
});
