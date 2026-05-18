import type { GameState, PlayerId, Resource, WonderId } from '../../../types';

// Five wonders, each with a flat per-level cost (same cost paid for every
// level), a prerequisite that gates when the player may START building,
// and a max-level cap. Completing a wonder (level === maxLevel) is an
// instant-win condition — first to finish wins.
//
// Costs are deliberately spread across resource types so no single
// production base sweeps every wonder.
export interface WonderDef {
  id: WonderId;
  name: string;
  costPerLevel: Partial<Record<Resource, number>>;
  // Human-readable prereq label, e.g. "3 cities".
  prereqLabel: string;
  // Returns true when the player currently meets the prereq.
  prereqMet: (state: GameState, playerId: PlayerId) => boolean;
  maxLevel: number;
}

export const WONDERS: WonderDef[] = [
  {
    id: 'greatWall',
    name: 'Great Wall',
    costPerLevel: { ore: 2, wheat: 1 },
    prereqLabel: '3+ cities',
    prereqMet: (s, p) => playerOf(s, p).cities.length >= 3,
    maxLevel: 4,
  },
  {
    id: 'greatBridge',
    name: 'Great Bridge',
    costPerLevel: { brick: 1, wood: 1, sheep: 1 },
    prereqLabel: 'Longest Road',
    prereqMet: (s, p) => playerOf(s, p).hasLongestRoad,
    maxLevel: 4,
  },
  {
    id: 'hangingGardens',
    name: 'Hanging Gardens',
    costPerLevel: { wheat: 1, sheep: 1, wood: 1 },
    prereqLabel: '4+ settlements',
    prereqMet: (s, p) => playerOf(s, p).settlements.length >= 4,
    maxLevel: 4,
  },
  {
    id: 'cathedral',
    name: 'Cathedral',
    costPerLevel: { wheat: 2, ore: 1 },
    prereqLabel: 'Largest Army',
    prereqMet: (s, p) => playerOf(s, p).hasLargestArmy,
    maxLevel: 4,
  },
  {
    id: 'tradeOffice',
    name: 'Trade Office',
    costPerLevel: { wood: 2, sheep: 1 },
    prereqLabel: '3+ ports',
    prereqMet: (s, p) => playerOf(s, p).ports.length >= 3,
    maxLevel: 4,
  },
];

export function getWonder(id: WonderId): WonderDef {
  const w = WONDERS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown wonder: ${id}`);
  return w;
}

function playerOf(state: GameState, playerId: PlayerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) throw new Error(`Unknown player: ${playerId}`);
  return p;
}
