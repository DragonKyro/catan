import type { PortType, Terrain } from '../../../types';
import type {
  ScenarioLayout,
  ScenarioPortAnchor,
  ScenarioPosition,
} from '../../../board/scenarioTypes';
import type { BaseScenario, StartingSlot } from './types';
import { seaPositionsInDisk } from './helpers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../../citiesAndKnights/constants';

// The rulebooks' starting set-up for new players: a fixed board with every
// color's two settlements and two roads printed on it. Map spec and the
// measurements behind it: docs/map-specs/BEGINNER-SPEC.md.
//
// 3-4 players — CATAN base rules (2025), "Starting Set-up for Beginners"
// (p.2-3 Illus. A, p.13 Illus. R, back cover). Hexes row by row, top row
// (r = -2) first, west to east:
//
//   r=-2:          mountains 10 · pasture 2 · forest 9
//   r=-1:     fields 12 · hills 6 · pasture 4 · hills 10
//   r= 0: fields 9 · forest 11 · desert · forest 3 · mountains 8
//   r= 1:     forest 8 · mountains 3 · fields 4 · pasture 5
//   r= 2:          hills 5 · fields 6 · pasture 11
//
// "Place 2 settlements and 2 roads of each color as shown. If only 3 are
// playing, remove the red pieces. Each player receives the 3 resources from
// the terrain hexes adjacent to their settlement marked by the white star."
//
// 5-6 players — CATAN 5-6 Player Extension rules (2025) p.4-5, "Starting
// Set-up for 5-6 New Players":
//
//   r=-3:                hills 10 · pasture 6 · desert
//   r=-2:          hills 6 · fields 2 · mountains 9 · hills 11
//   r=-1:     forest 3 · mountains 11 · forest 5 · fields 10 · pasture 4
//   r= 0: desert · pasture 5 · fields 4 · mountains 6 · pasture 3 · fields 8
//   r= 1:     forest 12 · mountains 10 · pasture 2 · hills 4 · forest 11
//   r= 2:          forest 8 · fields 3 · forest 9 · fields 5
//   r= 3:                hills 9 · pasture 12 · mountains 8
//
// "For your first 5 player game: One color remains inactive … Leave that
// color's settlements on the board as inactive settlements, but remove the
// roads." The robber isn't drawn; it starts on the top desert (the
// experienced set-up says "either of the desert hexes").

type Row = Array<[q: number, r: number, terrain: Terrain | 'desert', token: number | null]>;

const HEXES_3_4: Row = [
  [0, -2, 'ore', 10], [1, -2, 'sheep', 2], [2, -2, 'wood', 9],
  [-1, -1, 'wheat', 12], [0, -1, 'brick', 6], [1, -1, 'sheep', 4], [2, -1, 'brick', 10],
  [-2, 0, 'wheat', 9], [-1, 0, 'wood', 11], [0, 0, 'desert', null], [1, 0, 'wood', 3], [2, 0, 'ore', 8],
  [-2, 1, 'wood', 8], [-1, 1, 'ore', 3], [0, 1, 'wheat', 4], [1, 1, 'sheep', 5],
  [-2, 2, 'brick', 5], [-1, 2, 'wheat', 6], [0, 2, 'sheep', 11],
];

const HEXES_5_6: Row = [
  [0, -3, 'brick', 10], [1, -3, 'sheep', 6], [2, -3, 'desert', null],
  [-1, -2, 'brick', 6], [0, -2, 'wheat', 2], [1, -2, 'ore', 9], [2, -2, 'brick', 11],
  [-2, -1, 'wood', 3], [-1, -1, 'ore', 11], [0, -1, 'wood', 5], [1, -1, 'wheat', 10], [2, -1, 'sheep', 4],
  [-3, 0, 'desert', null], [-2, 0, 'sheep', 5], [-1, 0, 'wheat', 4], [0, 0, 'ore', 6], [1, 0, 'sheep', 3], [2, 0, 'wheat', 8],
  [-3, 1, 'wood', 12], [-2, 1, 'ore', 10], [-1, 1, 'sheep', 2], [0, 1, 'brick', 4], [1, 1, 'wood', 11],
  [-3, 2, 'wood', 8], [-2, 2, 'wheat', 3], [-1, 2, 'wood', 9], [0, 2, 'wheat', 5],
  [-3, 3, 'brick', 9], [-2, 3, 'sheep', 12], [-1, 3, 'ore', 8],
];

// Harbors as printed on the frame: the land hex whose coastal edge the two
// piers touch, and that edge (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE).
function port(q: number, r: number, direction: ScenarioPortAnchor['direction'], fixedType: PortType): ScenarioPortAnchor {
  return { q, r, direction, fixedType };
}

export const BEGINNER_PORTS_3_4: ScenarioPortAnchor[] = [
  port(0, -2, 4, 'generic'), // top left: mountains 10, NW edge
  port(1, -2, 5, 'wheat'), // top: pasture 2, NE edge
  port(2, -1, 5, 'ore'), // upper right: hills 10, NE edge
  port(2, 0, 0, 'generic'), // right: mountains 8, E edge
  port(1, 1, 1, 'sheep'), // lower right: pasture 5, SE edge
  port(-1, 2, 1, 'generic'), // bottom: fields 6, SE edge
  port(-2, 2, 2, 'generic'), // bottom left: hills 5, SW edge
  port(-2, 1, 3, 'brick'), // lower left: forest 8, W edge
  port(-1, -1, 3, 'wood'), // upper left: fields 12, W edge
];

export const BEGINNER_PORTS_5_6: ScenarioPortAnchor[] = [
  port(0, -3, 4, 'generic'), // top left: hills 10, NW edge
  port(1, -3, 5, 'sheep'), // top: pasture 6, NE edge
  port(2, -2, 5, 'generic'), // upper right: hills 11, NE edge
  port(2, 0, 0, 'generic'), // right: fields 8, E edge
  port(1, 1, 1, 'brick'), // lower right: forest 11, SE edge
  port(-1, 3, 0, 'sheep'), // bottom right: mountains 8, E edge
  port(-2, 3, 1, 'wood'), // bottom: pasture 12, SE edge
  port(-3, 3, 2, 'generic'), // bottom left: hills 9, SW edge
  port(-3, 2, 3, 'wheat'), // lower left: forest 8, W edge
  port(-3, 0, 2, 'generic'), // left: desert, SW edge
  port(-2, -1, 3, 'ore'), // upper left: forest 3, W edge
];

// Each color's settlements (by hex corner: 0 NE, 1 SE, 2 S, 3 SW, 4 NW,
// 5 N) and the road beside each (by hex side). `star` = the settlement with
// the white star, which pays the starting resources.
function slot(
  label: string,
  color: StartingSlot['color'],
  pieces: Array<[q: number, r: number, corner: 0 | 1 | 2 | 3 | 4 | 5, rq: number, rr: number, side: 0 | 1 | 2 | 3 | 4 | 5]>,
  star: 0 | 1,
): StartingSlot {
  const [a, b] = pieces.map(([q, r, corner, rq, rr, direction]) => ({
    settlement: { q, r, corner },
    road: { q: rq, r: rr, direction },
  }));
  return { label, color, pieces: [a!, b!], star };
}

// Seats without a matching color take the free slots in this order.
export const BEGINNER_SLOTS_3_4: StartingSlot[] = [
  // Red: mountains 10 / pasture 2 / hills 6 ("A"), road toward pasture 4;
  // ★ fields 9 / forest 11 / forest 8, road toward mountains 3.
  slot('Red', 'red', [[0, -1, 5, 0, -1, 5], [-1, 0, 3, -1, 0, 2]], 1),
  // Blue: ★ forest 8 / mountains 3 / hills 5, road toward fields 6;
  // fields 4 / pasture 5 / pasture 11, road up toward forest 3.
  slot('Blue', 'blue', [[-1, 1, 3, -1, 1, 2], [0, 1, 1, 0, 1, 0]], 0),
  // Orange: pasture 4 / hills 10 / forest 9 ("B"), road toward pasture 2;
  // ★ mountains 3 / fields 4 / fields 6, road toward pasture 11.
  slot('Orange', 'orange', [[1, -1, 0, 1, -1, 5], [0, 1, 3, 0, 1, 2]], 1),
  // White: ★ fields 12 / hills 6 / forest 11, road toward fields 9;
  // forest 3 / mountains 8 / pasture 5 ("C"), road up toward hills 10.
  slot('White', 'white', [[-1, 0, 5, -1, 0, 4], [1, 0, 1, 1, 0, 0]], 0),
];

export const BEGINNER_SLOTS_5_6: StartingSlot[] = [
  // Red: hills 6 / forest 3 (coast), road between them;
  // ★ pasture 5 / fields 4 / mountains 10, road toward forest 12.
  slot('Red', 'red', [[-1, -2, 3, -1, -2, 2], [-1, 0, 3, -2, 0, 1]], 1),
  // Blue: ★ mountains 6 / pasture 3 / hills 4, road up toward fields 10;
  // fields 8 / forest 11 (coast), road between them.
  slot('Blue', 'blue', [[0, 0, 1, 0, 0, 0], [2, 0, 2, 2, 0, 2]], 0),
  // Green: hills 10 / pasture 6 (coast), road between them;
  // ★ mountains 11 / forest 5 / fields 4, road up toward fields 2.
  slot('Green', 'forest', [[0, -3, 0, 0, -3, 0], [-1, 0, 5, -1, -1, 0]], 1),
  // White: hills 11 / pasture 4 (coast), road toward fields 10;
  // ★ forest 5 / fields 10 / mountains 6, road up toward mountains 9.
  slot('White', 'white', [[2, -2, 1, 2, -2, 1], [0, 0, 5, 0, -1, 0]], 1),
  // Orange: ★ fields 4 / mountains 6 / pasture 2, road toward mountains 10;
  // forest 8 / hills 9 (coast), road toward fields 3.
  slot('Orange', 'orange', [[0, 0, 3, -1, 0, 1], [-3, 2, 2, -3, 2, 1]], 0),
  // Brown: ★ pasture 2 / hills 4 / forest 9, road toward fields 5;
  // fields 5 / mountains 8 (coast, on the 2:1 wool harbor), road between them.
  slot('Brown', 'brown', [[0, 1, 3, 0, 1, 2], [0, 2, 2, 0, 2, 2]], 0),
];

function land(rows: Row): ScenarioPosition[] {
  return rows.map(([q, r, terrain, token]) =>
    terrain === 'desert'
      ? { q, r, kind: 'desert' as const }
      : { q, r, kind: 'land' as const, fixedTerrain: terrain, fixedToken: token! },
  );
}

function layout(
  rows: Row,
  radius: number,
  ports: ScenarioPortAnchor[],
  robberStart: { q: number; r: number },
): ScenarioLayout {
  return {
    positions: [...land(rows), ...seaPositionsInDisk(land(rows), radius)],
    portAnchors: ports,
    robberStart,
    // Everything is pinned; nothing to shuffle.
    tokenConstraints: { allow6_8Adjacent: true },
    pools: { terrainCounts: {}, tokens: [], portTypes: [] },
  };
}

export const beginner: BaseScenario = {
  id: 'beginner',
  name: 'Beginner set-up (rulebook)',
  description:
    'The rulebooks\' fixed board for new players, with everyone\'s starting settlements and roads already placed. The game starts at the first roll.',
  minPlayers: 3,
  maxPlayers: 6,
  layout3p: layout(HEXES_3_4, 3, BEGINNER_PORTS_3_4, { q: 0, r: 0 }),
  layout5_6p: layout(HEXES_5_6, 4, BEGINNER_PORTS_5_6, { q: 2, r: -3 }),
  startingSetup: {
    slots3_4: BEGINNER_SLOTS_3_4,
    dropAt3: 'Red',
    slots5_6: BEGINNER_SLOTS_5_6,
  },
  // Cities & Knights starts with a city (and has its own first-game board).
  notWithExpansions: [CITIES_AND_KNIGHTS_EXPANSION_ID],
};
