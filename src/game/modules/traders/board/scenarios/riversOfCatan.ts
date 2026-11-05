import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { Terrain } from '../../../../types';
import type { RiverDef, TradersScenario } from './types';
import { standardLand3_4 } from '../../../base/scenarios/standardShape';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import { TB_FRAME_PORTS_3_4, TB_FRAME_PORTS_5_6 } from '../frame';
import { TB_DISCS_5_6, tbPositions5_6 } from './board5_6';

// Rivers of Catan (T&B 2025 rulebook, p. 11-12).
//
// Two river tiles sit at fixed places, each running diagonally down-right
// (south-east) from a mountain where the river rises to a swamp where it
// meets the sea:
//   River A (4 hexes): (-1,-1) mountains → (-1,0) hills → (-1,1) pasture →
//                      (-1,2) swamp, into the sea across the swamp's SW edge.
//   River B (3 hexes): (1,-1) mountains → (1,0) hills → (1,1) swamp, into
//                      the sea across the swamp's E edge.
// The other 12 hexes are random from the base set with 2 hills, 2 pastures,
// 2 mountains and the desert returned to the box (the river tiles carry
// their own). Number discs: the 2 is set aside, the other 17 go on the 17
// non-swamp hexes as usual, then the 2 joins the 12 on its hex (that hex
// produces on 2 and on 12). The robber starts on a swamp (the rulebook
// picture puts it on River B's).
//
// Bridge sites — "any location where the river crosses or meets an edge" —
// are the edges shared along each river plus each mouth: seven in all.
// Roads may never go there (setup included); bridges only.

const RIVER_A: Array<{ q: number; r: number; terrain: Terrain }> = [
  { q: -1, r: -1, terrain: 'ore' },
  { q: -1, r: 0, terrain: 'brick' },
  { q: -1, r: 1, terrain: 'sheep' },
  { q: -1, r: 2, terrain: 'swamp' },
];
const RIVER_B: Array<{ q: number; r: number; terrain: Terrain }> = [
  { q: 1, r: -1, terrain: 'ore' },
  { q: 1, r: 0, terrain: 'brick' },
  { q: 1, r: 1, terrain: 'swamp' },
];

const RIVER_TILE_HEXES = [...RIVER_A, ...RIVER_B];

function riversLand3_4(): ScenarioPosition[] {
  return standardLand3_4().map((p) => {
    const river = RIVER_TILE_HEXES.find((h) => h.q === p.q && h.r === p.r);
    return river ? { ...p, fixedTerrain: river.terrain } : p;
  });
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [...riversLand3_4(), ...seaPositionsInDisk(riversLand3_4(), 3)],
  portAnchors: TB_FRAME_PORTS_3_4,
  robberStart: { q: 1, r: 1 },
  pools: {
    // The 12 random hexes. Totals with the river tiles: wood 4, sheep 3,
    // wheat 4, brick 3, ore 3, swamp 2.
    terrainCounts: { wood: 4, wheat: 4, sheep: 2, brick: 1, ore: 1 },
    // Every base disc but the 2, on the 17 non-swamp hexes.
    tokens: [3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    stackedTokens: [{ token: 2, onto: 12 }],
    // Every frame harbor is printed (TB_FRAME_PORTS_3_4 pins its type).
    portTypes: [],
  },
};

const RIVERS: RiverDef[] = [
  {
    hexes: RIVER_A.map(({ q, r }) => ({ q, r })),
    mouth: { q: -1, r: 2, direction: 2 }, // swamp's SW edge
  },
  {
    hexes: RIVER_B.map(({ q, r }) => ({ q, r })),
    mouth: { q: 1, r: 1, direction: 0 }, // swamp's E edge
  },
];

// ----- 5-6 players (T&B 5-6 rulebook p. 6; TB56-MAP-SPEC) -----
//
// Three river tiles: the two from the 3-4 game on new spots plus the 5-6
// tile (mountains → pasture → pasture, no swamp):
//   River A (4 hexes): (-2,0) mountains → (-2,1) hills → (-2,2) pasture →
//                      (-2,3) swamp, into the sea across the swamp's SW edge.
//   River B (3 hexes): (-1,-1) mountains → (0,-2) hills → (1,-3) swamp,
//                      into the sea across the swamp's NW edge (where the
//                      2:1 ore harbor is).
//   River C (3 hexes): (0,0) mountains → (1,0) pasture → (2,0) pasture,
//                      bending up into the sea across (2,0)'s NE edge.
// "Return 2 hills, 3 pastures, 3 mountains, and 2 deserts": 20 random hexes
// (wood 6, wheat 6, sheep 3, brick 3, ore 2). All 28 CATAN 5-6 discs go on
// the 28 non-swamp hexes — "the instruction to place the number 2 disc on
// the same hex as the number 12 disc does not apply". The robber starts on
// River A's swamp (picture). Ten bridge sites.

const RIVER_A_5_6: Array<{ q: number; r: number; terrain: Terrain }> = [
  { q: -2, r: 0, terrain: 'ore' },
  { q: -2, r: 1, terrain: 'brick' },
  { q: -2, r: 2, terrain: 'sheep' },
  { q: -2, r: 3, terrain: 'swamp' },
];
const RIVER_B_5_6: Array<{ q: number; r: number; terrain: Terrain }> = [
  { q: -1, r: -1, terrain: 'ore' },
  { q: 0, r: -2, terrain: 'brick' },
  { q: 1, r: -3, terrain: 'swamp' },
];
const RIVER_C_5_6: Array<{ q: number; r: number; terrain: Terrain }> = [
  { q: 0, r: 0, terrain: 'ore' },
  { q: 1, r: 0, terrain: 'sheep' },
  { q: 2, r: 0, terrain: 'sheep' },
];
const RIVER_TILE_HEXES_5_6 = [...RIVER_A_5_6, ...RIVER_B_5_6, ...RIVER_C_5_6];

const LAYOUT_5_6: ScenarioLayout = {
  positions: tbPositions5_6((p) => {
    const river = RIVER_TILE_HEXES_5_6.find((h) => h.q === p.q && h.r === p.r);
    return river ? { ...p, fixedTerrain: river.terrain } : p;
  }),
  portAnchors: TB_FRAME_PORTS_5_6,
  robberStart: { q: -2, r: 3 },
  pools: {
    terrainCounts: { wood: 6, wheat: 6, sheep: 3, brick: 3, ore: 2 },
    tokens: TB_DISCS_5_6,
    portTypes: [],
  },
};

const RIVERS_5_6: RiverDef[] = [
  {
    hexes: RIVER_A_5_6.map(({ q, r }) => ({ q, r })),
    mouth: { q: -2, r: 3, direction: 2 }, // swamp's SW edge
  },
  {
    hexes: RIVER_B_5_6.map(({ q, r }) => ({ q, r })),
    mouth: { q: 1, r: -3, direction: 4 }, // swamp's NW edge
  },
  {
    hexes: RIVER_C_5_6.map(({ q, r }) => ({ q, r })),
    mouth: { q: 2, r: 0, direction: 5 }, // (2,0)'s NE edge
  },
];

export const riversOfCatan: TradersScenario = {
  id: 'riversOfCatan',
  name: 'Rivers of Catan',
  description:
    'Two rivers run from the mountains to the swamps. Bridge them, earn gold for building along them, and stay out of the poorhouse: the richest player gains a VP, the poorest lose two.',
  minPlayers: 3,
  maxPlayers: 6,
  defaultVpToWin: 10,
  layout3p: LAYOUT_3_4,
  layout5_6p: LAYOUT_5_6,
  robberStart: { q: 1, r: 1 },
  rivers: RIVERS,
  board5_6: { rivers: RIVERS_5_6, robberStart: { q: -2, r: 3 } },
  coins: true,
  wealthTiles: true,
};
