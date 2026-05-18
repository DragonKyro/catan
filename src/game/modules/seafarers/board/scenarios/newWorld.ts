import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const LAND: ScenarioHexDef[] = [
  { q: -2, r: 0, terrain: 'wood', token: 5 },
  { q: -1, r: -1, terrain: 'brick', token: 6 },
  { q: 0, r: -2, terrain: 'sheep', token: 9 },
  { q: 1, r: -2, terrain: 'wheat', token: 4 },
  { q: 2, r: -2, terrain: 'ore', token: 10 },
  { q: -2, r: 2, terrain: 'sheep', token: 11 },
  { q: -1, r: 2, terrain: 'wood', token: 3 },
  { q: 0, r: 2, terrain: 'wheat', token: 8 },
  { q: 1, r: 1, terrain: 'brick', token: 12 },
  { q: 0, r: 0, terrain: 'desert', token: null },
  { q: -1, r: 1, terrain: 'gold', token: 6 },
  { q: 1, r: 0, terrain: 'ore', token: 4 },
  { q: 3, r: -1, terrain: 'gold', token: 8 },
  { q: 3, r: 0, terrain: 'wheat', token: 10 },
];

const EXTRA_5_6: ScenarioHexDef[] = [
  { q: -3, r: 0, terrain: 'sheep', token: 9 },
  { q: -3, r: 2, terrain: 'wood', token: 5 },
  { q: 2, r: -3, terrain: 'brick', token: 3 },
  { q: 4, r: -1, terrain: 'gold', token: 11 },
  { q: 4, r: 0, terrain: 'wheat', token: 8 },
  { q: -2, r: 4, terrain: 'ore', token: 6 },
  { q: 1, r: 3, terrain: 'wood', token: 10 },
];

export const newWorld = buildScenario({
  id: 'newWorld',
  name: 'New World',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 12,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 4,
  land: LAND,
  ports: [
    { q: -2, r: 0, direction: 4, type: 'generic' },
    { q: 2, r: -2, direction: 0, type: 'wheat' },
    { q: 1, r: 1, direction: 0, type: 'sheep' },
    { q: -2, r: 2, direction: 3, type: 'ore' },
    { q: 0, r: -2, direction: 5, type: 'wood' },
    { q: 3, r: 0, direction: 2, type: 'brick' },
  ],
  landExtra5_6: EXTRA_5_6,
  ports5_6: [
    { q: -2, r: 0, direction: 4, type: 'generic' },
    { q: 2, r: -2, direction: 0, type: 'wheat' },
    { q: 1, r: 1, direction: 0, type: 'sheep' },
    { q: -2, r: 2, direction: 4, type: 'ore' },
    { q: 0, r: -2, direction: 5, type: 'wood' },
    { q: 3, r: 0, direction: 1, type: 'brick' },
  ],
});
