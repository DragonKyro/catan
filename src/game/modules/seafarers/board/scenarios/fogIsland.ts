import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const STARTING: ScenarioHexDef[] = [
  { q: 0, r: 0, terrain: 'wheat', token: 6 },
  { q: 1, r: 0, terrain: 'sheep', token: 4 },
  { q: 1, r: -1, terrain: 'wood', token: 3 },
  { q: 0, r: -1, terrain: 'brick', token: 8 },
  { q: -1, r: 0, terrain: 'ore', token: 5 },
  { q: -1, r: 1, terrain: 'wood', token: 10 },
  { q: 0, r: 1, terrain: 'sheep', token: 11 },
  { q: -2, r: 1, terrain: 'desert', token: null },
  { q: -2, r: 2, terrain: 'wheat', token: 9 },
];

const FOG_ISLAND: ScenarioHexDef[] = [
  { q: 3, r: -2, terrain: 'gold', token: 4 },
  { q: 3, r: -1, terrain: 'wheat', token: 8 },
  { q: 3, r: 0, terrain: 'ore', token: 11 },
  { q: 2, r: 1, terrain: 'brick', token: 6 },
  { q: 2, r: -3, terrain: 'gold', token: 10 },
  { q: 1, r: 2, terrain: 'wood', token: 3 },
];

const EXTRA_5_6: ScenarioHexDef[] = [
  // Larger fog island, more outer territory.
  { q: 4, r: -2, terrain: 'gold', token: 5 },
  { q: 4, r: -3, terrain: 'sheep', token: 9 },
  { q: 4, r: 0, terrain: 'wheat', token: 12 },
  { q: 3, r: 1, terrain: 'wood', token: 8 },
  { q: 2, r: 2, terrain: 'ore', token: 6 },
  { q: -3, r: 3, terrain: 'brick', token: 10 },
  { q: -1, r: -2, terrain: 'sheep', token: 11 },
];

export const fogIsland = buildScenario({
  id: 'fogIsland',
  name: 'Fog Island',
  defaultIslandBonusVp: 3,
  defaultVpToWin: 12,
  minPlayers: 3,
  maxPlayers: 4,
  land: [...STARTING, ...FOG_ISLAND],
  ports: [
    { q: 0, r: -1, direction: 5, type: 'generic' },
    { q: 1, r: 0, direction: 1, type: 'sheep' },
    { q: 0, r: 1, direction: 2, type: 'generic' },
    { q: -2, r: 2, direction: 3, type: 'wheat' },
    { q: -2, r: 1, direction: 4, type: 'brick' },
    { q: -1, r: 0, direction: 4, type: 'ore' },
  ],
  landExtra5_6: EXTRA_5_6,
});
