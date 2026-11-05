import type { GameState, PlayerId, Resource, WonderId } from '../../../types';
import { calculateVictoryPoints } from '../../../scoring/points';
import { calculateLongestTradeRoute } from '../scoring/longestTradeRoute';

// The Wonders of Catan tiles (Seafarers rulebook p.1 / p.18; the two 5-6
// player tiles from the Seafarers 5-6 rulebook p.1). Each tile shows its
// requirement and a cost; "Each of the four levels of a wonder costs the
// same 5 resources to build."
export interface WonderDef {
  id: WonderId;
  name: string;
  costPerLevel: Partial<Record<Resource, number>>;
  // Requirement text, as printed on the tile.
  requirement: string;
  // Does the player meet the requirement to claim this wonder now?
  requirementMet: (state: GameState, playerId: PlayerId) => boolean;
  // Only in play at 5-6 players.
  fiveSixOnly?: boolean;
}

export const WONDER_LEVELS = 4;

export const WONDERS: WonderDef[] = [
  {
    id: 'grandCastle',
    name: 'Grand Castle',
    costPerLevel: { brick: 1, wheat: 1, ore: 3 },
    requirement: 'Requires 1 city and 6+ VPs to begin.',
    requirementMet: (s, p) =>
      playerOf(s, p).cities.length >= 1 && calculateVictoryPoints(s, p, true) >= 6,
  },
  {
    id: 'grandMonument',
    name: 'Grand Monument',
    costPerLevel: { wheat: 3, ore: 2 },
    requirement: 'Requires 1 city at a port and a trade route with 5+ roads/ships to begin.',
    requirementMet: (s, p) => hasCityAtPort(s, p) && calculateLongestTradeRoute(s, p) >= 5,
  },
  {
    id: 'greatBridge',
    name: 'Great Bridge',
    costPerLevel: { wood: 3, sheep: 1, wheat: 1 },
    requirement: 'Requires a building at one of the Great Bridge markers to begin.',
    requirementMet: (s, p) => hasBuildingAtSite(s, p, 'greatBridge'),
  },
  {
    id: 'grandTheater',
    name: 'Grand Theater',
    costPerLevel: { brick: 1, wood: 1, sheep: 3 },
    requirement: 'Requires 2 cities to begin.',
    requirementMet: (s, p) => playerOf(s, p).cities.length >= 2,
  },
  {
    id: 'greatWall',
    name: 'Great Wall',
    costPerLevel: { brick: 3, wood: 1, wheat: 1 },
    requirement: 'Requires a building at one of the Great Wall markers to begin.',
    requirementMet: (s, p) => hasBuildingAtSite(s, p, 'greatWall'),
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse',
    costPerLevel: { wood: 3, sheep: 1, wheat: 1 },
    requirement: 'Requires a building at one of the lighthouse markers to begin.',
    requirementMet: (s, p) => hasBuildingAtSite(s, p, 'lighthouse'),
    fiveSixOnly: true,
  },
  {
    id: 'greatLibrary',
    name: 'Great Library',
    costPerLevel: { brick: 1, wood: 1, sheep: 3 },
    requirement: 'Requires 2 cities to begin.',
    requirementMet: (s, p) => playerOf(s, p).cities.length >= 2,
    fiveSixOnly: true,
  },
];

export function wondersForPlayerCount(numPlayers: number): WonderDef[] {
  return WONDERS.filter((w) => !w.fiveSixOnly || numPlayers >= 5);
}

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

function hasBuildingAtSite(state: GameState, playerId: PlayerId, site: WonderId): boolean {
  const vertices = state.wonderSites?.[site] ?? [];
  const p = playerOf(state, playerId);
  return vertices.some((v) => p.settlements.includes(v) || p.cities.includes(v));
}

function hasCityAtPort(state: GameState, playerId: PlayerId): boolean {
  const p = playerOf(state, playerId);
  const portVertices = new Set<string>();
  for (const port of state.board.ports) {
    for (const v of state.board.edges[port.edge]?.vertices ?? []) portVertices.add(v);
  }
  return p.cities.some((v) => portVertices.has(v));
}

// The player's claimed wonder, if any ("You may only claim 1 wonder").
export function claimedWonderOf(state: GameState, playerId: PlayerId) {
  return state.wonders?.find((w) => w.claimedBy === playerId);
}

// Wonders of Catan win condition (besides finishing a wonder): "Have 10 or
// more VPs and have completed a higher level of your wonder than any other
// player."
export function wonderLevelLead(state: GameState, playerId: PlayerId): boolean {
  const mine = claimedWonderOf(state, playerId)?.level ?? 0;
  if (mine === 0) return false;
  for (const w of state.wonders ?? []) {
    if (w.claimedBy && w.claimedBy !== playerId && w.level >= mine) return false;
  }
  return true;
}
