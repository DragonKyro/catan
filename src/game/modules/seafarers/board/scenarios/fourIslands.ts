import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const LAND: ScenarioHexDef[] = [
  // North cluster
  { q: -1, r: -2, terrain: 'wood', token: 9 },
  { q: 0, r: -2, terrain: 'ore', token: 5 },
  { q: 1, r: -3, terrain: 'wheat', token: 11 },
  { q: 0, r: -3, terrain: 'gold', token: 8 },
  // East cluster
  { q: 3, r: -1, terrain: 'brick', token: 4 },
  { q: 3, r: 0, terrain: 'sheep', token: 10 },
  { q: 2, r: 1, terrain: 'wheat', token: 3 },
  { q: 3, r: -2, terrain: 'gold', token: 6 },
  // South cluster
  { q: -2, r: 3, terrain: 'ore', token: 9 },
  { q: -1, r: 3, terrain: 'wood', token: 12 },
  { q: 0, r: 3, terrain: 'brick', token: 8 },
  { q: -1, r: 2, terrain: 'sheep', token: 4 },
  // West cluster
  { q: -3, r: 1, terrain: 'wheat', token: 5 },
  { q: -3, r: 2, terrain: 'wood', token: 10 },
  { q: -2, r: 1, terrain: 'sheep', token: 11 },
  { q: -2, r: 0, terrain: 'ore', token: 2 },
];

// 5-6 variant: each of the four clusters gets one or two extra hexes,
// pushed into the outer ring to keep play spread.
const EXTRA_5_6: ScenarioHexDef[] = [
  { q: -2, r: -2, terrain: 'sheep', token: 6 },
  { q: 1, r: -4, terrain: 'wood', token: 3 },
  { q: 4, r: -1, terrain: 'wood', token: 5 },
  { q: 4, r: 0, terrain: 'ore', token: 11 },
  { q: -3, r: 4, terrain: 'wheat', token: 10 },
  { q: 0, r: 4, terrain: 'gold', token: 9 },
  { q: -4, r: 2, terrain: 'brick', token: 8 },
  { q: -4, r: 4, terrain: 'sheep', token: 4 },
];

export const fourIslands = buildScenario({
  id: 'fourIslands',
  name: 'Four Islands',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 12,
  minPlayers: 3,
  maxPlayers: 6,
  startingPlacementZone: 'anyIsland',
  land: LAND,
  ports: [
    { q: 0, r: -2, direction: 0, type: 'generic' },
    { q: 3, r: -1, direction: 2, type: 'wheat' },
    { q: -1, r: 3, direction: 5, type: 'sheep' },
    { q: -3, r: 1, direction: 4, type: 'wood' },
    { q: 1, r: -3, direction: 0, type: 'ore' },
    { q: 0, r: 3, direction: 5, type: 'brick' },
  ],
  landExtra5_6: EXTRA_5_6,
});
