import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const LAND: ScenarioHexDef[] = [
  { q: -3, r: 1, terrain: 'wood', token: 6 },
  { q: -3, r: 2, terrain: 'sheep', token: 4 },
  { q: -2, r: 0, terrain: 'wheat', token: 9 },
  { q: -2, r: 1, terrain: 'brick', token: 5 },
  { q: -2, r: 2, terrain: 'ore', token: 3 },
  { q: -1, r: 0, terrain: 'sheep', token: 10 },
  { q: -1, r: 1, terrain: 'wheat', token: 11 },
  { q: 0, r: -1, terrain: 'desert', token: null },
  { q: 0, r: 0, terrain: 'desert', token: null },
  { q: 0, r: 1, terrain: 'desert', token: null },
  { q: 1, r: -1, terrain: 'ore', token: 8 },
  { q: 1, r: 0, terrain: 'brick', token: 12 },
  { q: 2, r: -1, terrain: 'wood', token: 2 },
  { q: 2, r: 0, terrain: 'wheat', token: 5 },
  { q: 1, r: 1, terrain: 'sheep', token: 9 },
  { q: 2, r: 1, terrain: 'wood', token: 6 },
  { q: 0, r: 2, terrain: 'gold', token: 8 },
];

const EXTRA_5_6: ScenarioHexDef[] = [
  { q: -3, r: 3, terrain: 'wood', token: 11 },
  { q: -2, r: 3, terrain: 'sheep', token: 4 },
  { q: 2, r: -3, terrain: 'wheat', token: 10 },
  { q: 3, r: -2, terrain: 'ore', token: 8 },
  { q: 3, r: 0, terrain: 'gold', token: 6 },
  { q: 0, r: -3, terrain: 'brick', token: 3 },
];

export const throughTheDesert = buildScenario({
  id: 'throughTheDesert',
  name: 'Through the Desert',
  defaultIslandBonusVp: 2,
  land: LAND,
  ports: [
    { q: -3, r: 1, direction: 4, type: 'generic' },
    { q: -2, r: 0, direction: 5, type: 'wood' },
    { q: 2, r: -1, direction: 0, type: 'sheep' },
    { q: 2, r: 0, direction: 1, type: 'ore' },
    { q: 2, r: 1, direction: 2, type: 'wheat' },
    { q: -3, r: 2, direction: 3, type: 'brick' },
  ],
  landExtra5_6: EXTRA_5_6,
});
