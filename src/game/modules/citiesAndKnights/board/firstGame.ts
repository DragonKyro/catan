import type { Terrain } from '../../../types';
import type {
  ScenarioLayout,
  ScenarioPortAnchor,
  ScenarioPosition,
} from '../../../board/scenarioTypes';
import type { BaseScenario } from '../../base/scenarios/types';
import { seaPositionsInDisk } from '../../base/scenarios/helpers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../constants';

// The board the 2025 Cities & Knights rulebook recommends for a first game
// (p.4: "we recommend placing the hexes and number discs in the frame as
// shown"). Every hex and disc is fixed, transcribed from the picture row by
// row (top row r = -2 first, west to east):
//
//   r=-2:          hills 6 · mountains 2 · hills 5
//   r=-1:     forest 3 · mountains 9 · desert · forest 10
//   r= 0: forest 8 · fields 4 · hills 11 · pasture 3 · fields 8
//   r= 1:     pasture 10 · fields 5 · mountains 6 · pasture 4
//   r= 2:          fields 9 · pasture 12 · forest 11
//
// The C&K sea frame piece with the barbarian track replaces CATAN's 1-2
// frame piece on the east side; the nine harbors are where the picture
// shows them (directions per ScenarioPortAnchor: 0 E, 1 SE, 2 SW, 3 W,
// 4 NW, 5 NE — the edge of the land hex the harbor's piers touch).
const HEXES: Array<[q: number, r: number, terrain: Terrain | 'desert', token: number | null]> = [
  [0, -2, 'brick', 6],
  [1, -2, 'ore', 2],
  [2, -2, 'brick', 5],
  [-1, -1, 'wood', 3],
  [0, -1, 'ore', 9],
  [1, -1, 'desert', null],
  [2, -1, 'wood', 10],
  [-2, 0, 'wood', 8],
  [-1, 0, 'wheat', 4],
  [0, 0, 'brick', 11],
  [1, 0, 'sheep', 3],
  [2, 0, 'wheat', 8],
  [-2, 1, 'sheep', 10],
  [-1, 1, 'wheat', 5],
  [0, 1, 'ore', 6],
  [1, 1, 'sheep', 4],
  [-2, 2, 'wheat', 9],
  [-1, 2, 'sheep', 12],
  [0, 2, 'wood', 11],
];

export const CK_FIRST_GAME_PORTS: ScenarioPortAnchor[] = [
  { q: 1, r: -2, direction: 4, fixedType: 'ore' }, // top: mountains 2, NW edge
  { q: 2, r: -1, direction: 5, fixedType: 'wood' }, // upper right: forest 10, NE edge
  { q: 1, r: 1, direction: 0, fixedType: 'generic' }, // right, below the track: pasture 4, E edge
  { q: 0, r: 2, direction: 1, fixedType: 'generic' }, // bottom right: forest 11, SE edge
  { q: -1, r: 2, direction: 2, fixedType: 'wheat' }, // bottom: pasture 12, SW edge
  { q: -2, r: 2, direction: 2, fixedType: 'generic' }, // bottom left: fields 9, SW edge
  { q: -2, r: 1, direction: 3, fixedType: 'sheep' }, // lower left: pasture 10, W edge
  { q: -2, r: 0, direction: 3, fixedType: 'generic' }, // left: forest 8, W edge
  { q: -1, r: -1, direction: 4, fixedType: 'brick' }, // upper left: forest 3, NW edge
];

function land(): ScenarioPosition[] {
  return HEXES.map(([q, r, terrain, token]) =>
    terrain === 'desert'
      ? { q, r, kind: 'desert' as const }
      : { q, r, kind: 'land' as const, fixedTerrain: terrain, fixedToken: token! },
  );
}

const LAYOUT: ScenarioLayout = {
  positions: [...land(), ...seaPositionsInDisk(land(), 3)],
  portAnchors: CK_FIRST_GAME_PORTS,
  robberStart: { q: 1, r: -1 },
  // Everything is pinned; nothing to shuffle.
  tokenConstraints: { allow6_8Adjacent: true },
  pools: { terrainCounts: {}, tokens: [], portTypes: [] },
};

export const ckFirstGame: BaseScenario = {
  id: 'ckFirstGame',
  name: 'C&K first game (rulebook)',
  description:
    'The fixed board the Cities & Knights rulebook recommends for your first game: balanced starting spots, harbors as printed.',
  minPlayers: 3,
  maxPlayers: 4,
  layout3p: LAYOUT,
  onlyWithExpansion: CITIES_AND_KNIGHTS_EXPANSION_ID,
};
