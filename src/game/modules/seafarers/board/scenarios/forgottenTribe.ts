import type { ScenarioHexDef } from '../types';
import { buildScenario } from './builder';

const MAIN: ScenarioHexDef[] = [
  { q: 0, r: 0, terrain: 'wheat', token: 6 },
  { q: 1, r: 0, terrain: 'sheep', token: 4 },
  { q: 1, r: -1, terrain: 'wood', token: 3 },
  { q: 0, r: -1, terrain: 'brick', token: 8 },
  { q: -1, r: 0, terrain: 'ore', token: 5 },
  { q: -1, r: 1, terrain: 'wheat', token: 11 },
  { q: 0, r: 1, terrain: 'wood', token: 9 },
  { q: -2, r: 1, terrain: 'desert', token: null },
  { q: -2, r: 2, terrain: 'sheep', token: 10 },
  { q: -1, r: -1, terrain: 'brick', token: 12 },
];

const TRIBE_ISLETS: ScenarioHexDef[] = [
  { q: 3, r: -2, terrain: 'gold', token: 6 },
  { q: 3, r: 0, terrain: 'ore', token: 8 },
  { q: 2, r: 1, terrain: 'wheat', token: 5 },
  { q: 0, r: 3, terrain: 'gold', token: 9 },
  { q: -2, r: -1, terrain: 'sheep', token: 11 },
];

const EXTRA_5_6: ScenarioHexDef[] = [
  { q: -3, r: 0, terrain: 'wood', token: 10 },
  { q: -3, r: 3, terrain: 'brick', token: 4 },
  { q: 4, r: -2, terrain: 'gold', token: 5 },
  { q: 4, r: 0, terrain: 'sheep', token: 11 },
  { q: 3, r: 1, terrain: 'wheat', token: 3 },
  { q: -1, r: 3, terrain: 'ore', token: 8 },
];

// Tribe token placements. Per the official rulebook the Forgotten Tribe
// brings ~8 tokens (3 dev card, 2 VP, 3 commercial harbor); we approximate
// that distribution within the available islet hexes for each board size.
// Anchor each token on an outer-islet land hex — the first player to
// settle adjacent claims it.
const TRIBE_TOKENS_3_4: { q: number; r: number; type: 'devCard' | 'victoryPoint' | 'commercialHarbor' }[] = [
  { q: 3, r: -2, type: 'commercialHarbor' },
  { q: 3, r: 0, type: 'devCard' },
  { q: 2, r: 1, type: 'victoryPoint' },
  { q: 0, r: 3, type: 'devCard' },
  { q: -2, r: -1, type: 'commercialHarbor' },
];

const TRIBE_TOKENS_5_6: { q: number; r: number; type: 'devCard' | 'victoryPoint' | 'commercialHarbor' }[] = [
  ...TRIBE_TOKENS_3_4,
  { q: -3, r: 0, type: 'devCard' },
  { q: -3, r: 3, type: 'victoryPoint' },
  { q: 4, r: -2, type: 'commercialHarbor' },
];

export const forgottenTribe = buildScenario({
  id: 'forgottenTribe',
  name: 'The Forgotten Tribe',
  defaultIslandBonusVp: 2,
  defaultVpToWin: 11,
  defaultVpToWin5_6: 13,
  minPlayers: 3,
  maxPlayers: 4,
  tribeTokens: TRIBE_TOKENS_3_4,
  tribeTokens5_6: TRIBE_TOKENS_5_6,
  land: [...MAIN, ...TRIBE_ISLETS],
  ports: [
    { q: 1, r: -1, direction: 0, type: 'generic' },
    { q: 1, r: 0, direction: 1, type: 'wheat' },
    { q: 0, r: 1, direction: 2, type: 'sheep' },
    { q: -2, r: 2, direction: 3, type: 'wood' },
    { q: -2, r: 1, direction: 4, type: 'brick' },
    { q: -1, r: -1, direction: 5, type: 'ore' },
  ],
  landExtra5_6: EXTRA_5_6,
});
