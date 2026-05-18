import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const MAIN: ScenarioHexDef[] = [
  { q: -3, r: 0, terrain: 'wood', token: 4 },
  { q: -3, r: 1, terrain: 'wheat', token: 9 },
  { q: -3, r: 2, terrain: 'sheep', token: 11 },
  { q: -2, r: -1, terrain: 'brick', token: 5 },
  { q: -2, r: 0, terrain: 'ore', token: 8 },
  { q: -2, r: 1, terrain: 'wheat', token: 6 },
  { q: -2, r: 2, terrain: 'wood', token: 3 },
  { q: -1, r: -2, terrain: 'desert', token: null },
  { q: -1, r: -1, terrain: 'sheep', token: 10 },
  { q: -1, r: 0, terrain: 'brick', token: 12 },
];

const PIRATE_ISLES: ScenarioHexDef[] = [
  { q: 1, r: -2, terrain: 'gold', token: 5 },
  { q: 2, r: -2, terrain: 'ore', token: 9 },
  { q: 2, r: 0, terrain: 'wheat', token: 4 },
  { q: 3, r: -1, terrain: 'gold', token: 8 },
  { q: 1, r: 2, terrain: 'sheep', token: 6 },
  { q: 0, r: 3, terrain: 'wood', token: 10 },
];

const EXTRA_5_6: ScenarioHexDef[] = [
  { q: -4, r: 1, terrain: 'ore', token: 11 },
  { q: -4, r: 2, terrain: 'wheat', token: 6 },
  { q: -4, r: 3, terrain: 'wood', token: 4 },
  { q: 3, r: 1, terrain: 'gold', token: 9 },
  { q: 4, r: -2, terrain: 'sheep', token: 5 },
  { q: 4, r: 0, terrain: 'brick', token: 8 },
  { q: -1, r: 3, terrain: 'wheat', token: 3 },
];

export const pirateIslands = buildScenario({
  id: 'pirateIslands',
  name: 'Pirate Islands',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 10,
  minPlayers: 3,
  maxPlayers: 4,
  land: [...MAIN, ...PIRATE_ISLES],
  ports: [
    // (-3, 0) has no coastal edge at 3p (its open side is outside radius 3).
    // Anchor the NW generic port on the desert hex (-1, -2), which has sea
    // on its NE side toward (0, -3).
    { q: -1, r: -2, direction: 5, type: 'generic' },
    { q: -3, r: 2, direction: 1, type: 'generic' },
    { q: -1, r: 0, direction: 1, type: 'wheat' },
    { q: 1, r: -2, direction: 5, type: 'sheep' },
    { q: 2, r: 0, direction: 2, type: 'wood' },
    { q: 0, r: 3, direction: 4, type: 'brick' },
  ],
  landExtra5_6: EXTRA_5_6,
  ports5_6: [
    { q: -3, r: 0, direction: 3, type: 'generic' },
    { q: -3, r: 2, direction: 1, type: 'generic' },
    { q: -1, r: 0, direction: 1, type: 'wheat' },
    { q: 1, r: -2, direction: 5, type: 'sheep' },
    { q: 2, r: 0, direction: 2, type: 'wood' },
    { q: 0, r: 3, direction: 4, type: 'brick' },
  ],
});
