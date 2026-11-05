import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { FishingGroundDef, TradersScenario } from './types';
import { standardLand3_4 } from '../../../base/scenarios/standardShape';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import { TB_FRAME_PORTS_3_4, TB_FRAME_PORTS_5_6 } from '../frame';
import { shuffle } from '../../../../rng';
import { TB_DISCS_5_6, isInner5_6, tbPositions5_6 } from './board5_6';

// Fishing on Catan (T&B 2025 rulebook, p. 9-10).
//
// Variable setup with the desert replaced by the lake. The lake and six
// random hexes go in the light-blue inner area (the 7 hexes around and
// including the centre), the lake at a random spot there; the other 12
// hexes form the outer ring. All 18 base number discs go on the 18 land
// hexes as usual; the lake tile has its own printed 2, 3, 11 and 12 and
// produces fish on any of them. The robber starts beside the board.
//
// Six fishing-ground frame tiles fill the six coastal "V" notches, numbers
// 4, 5, 6, 8, 9, 10 dealt at random. Each touches two coastal edges and so
// three corners of the island (TB-MAP-SPEC). They interleave with the nine
// printed T&B harbors and never share an edge with one.

const INNER = new Set(['0,0', '1,-1', '1,0', '0,1', '-1,1', '-1,0', '0,-1']);

function fishingLand3_4(): ScenarioPosition[] {
  return standardLand3_4().map((p) =>
    INNER.has(`${p.q},${p.r}`) ? { ...p, zone: 'inner' } : p,
  );
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [...fishingLand3_4(), ...seaPositionsInDisk(fishingLand3_4(), 3)],
  portAnchors: TB_FRAME_PORTS_3_4,
  pools: {
    // The 18 base land hexes (the desert is replaced by the lake).
    terrainCounts: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3 },
    zoneTerrains: { inner: { lake: 1 } },
    printedNumbers: { lake: [2, 3, 11, 12] },
    tokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    portTypes: [],
  },
};

// Directions: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE (edge of the named hex).
const FISHING_GROUNDS: FishingGroundDef[] = [
  // top: (0,-2) NE edge + (1,-2) NW edge
  { edges: [{ q: 0, r: -2, direction: 5 }, { q: 1, r: -2, direction: 4 }] },
  // upper right: (2,-1) E edge + (2,0) NE edge
  { edges: [{ q: 2, r: -1, direction: 0 }, { q: 2, r: 0, direction: 5 }] },
  // lower right: (2,0) SE edge + (1,1) E edge
  { edges: [{ q: 2, r: 0, direction: 1 }, { q: 1, r: 1, direction: 0 }] },
  // bottom: (-2,2) SE edge + (-1,2) SW edge
  { edges: [{ q: -2, r: 2, direction: 1 }, { q: -1, r: 2, direction: 2 }] },
  // lower left: (-2,1) SW edge + (-2,2) W edge
  { edges: [{ q: -2, r: 1, direction: 2 }, { q: -2, r: 2, direction: 3 }] },
  // upper left: (0,-2) W edge + (-1,-1) NW edge
  { edges: [{ q: 0, r: -2, direction: 3 }, { q: -1, r: -1, direction: 4 }] },
];

// ----- 5-6 players (T&B 5-6 rulebook p. 5; TB56-MAP-SPEC) -----
//
// "Replace the desert hexes with the lake hexes. Place the 2 lakes and 12
// random hexes in the light blue, inner area" — the 14 hexes inside the
// coast; the 16 coastal hexes are random. The two lakes carry different
// printed numbers: the T&B lake 2 / 3 / 11 / 12, the 5-6 lake 4 / 10. All
// 28 CATAN 5-6 discs go on the 28 land hexes. "Place a random fishing
// ground tile on each frame section that does not have a harbor": eight
// notches, numbers 4, 5, 6, 8, 9, 10 plus the 5-6 tiles' 5 and 9.

const LAKE_NUMBERS_5_6: number[][] = [
  [2, 3, 11, 12],
  [4, 10],
];

const LAYOUT_5_6: ScenarioLayout = {
  positions: tbPositions5_6((p) => (isInner5_6(p.q, p.r) ? { ...p, zone: 'inner' } : p)),
  portAnchors: TB_FRAME_PORTS_5_6,
  pools: {
    // The 28 CATAN 5-6 land hexes (the deserts became the lakes, which
    // `placeLakes5_6` pins before materialization).
    terrainCounts: { wood: 6, sheep: 6, wheat: 6, brick: 5, ore: 5 },
    tokens: TB_DISCS_5_6,
    portTypes: [],
  },
};

// Each lake on its own random inner hex, with its own printed numbers.
function placeLakes5_6(layout: ScenarioLayout, rngState: number): [ScenarioLayout, number] {
  const inner = layout.positions
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.zone === 'inner' && p.kind === 'land' && !p.fixedTerrain)
    .map(({ i }) => i);
  const [picked, rng] = shuffle(rngState, inner);
  const positions = layout.positions.slice();
  LAKE_NUMBERS_5_6.forEach((numbers, k) => {
    const i = picked[k]!;
    positions[i] = { ...positions[i]!, fixedTerrain: 'lake', printedNumbers: numbers };
  });
  return [{ ...layout, positions }, rng];
}

// Directions: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE (edge of the named hex).
const FISHING_GROUNDS_5_6: FishingGroundDef[] = [
  // top: (1,-3) NE edge + (2,-3) NW edge
  { edges: [{ q: 1, r: -3, direction: 5 }, { q: 2, r: -3, direction: 4 }] },
  // upper right: (2,-3) E edge + (2,-2) NE edge
  { edges: [{ q: 2, r: -3, direction: 0 }, { q: 2, r: -2, direction: 5 }] },
  // right: (2,-1) E edge + (2,0) NE edge
  { edges: [{ q: 2, r: -1, direction: 0 }, { q: 2, r: 0, direction: 5 }] },
  // lower right: (1,1) SE edge + (0,2) E edge
  { edges: [{ q: 1, r: 1, direction: 1 }, { q: 0, r: 2, direction: 0 }] },
  // bottom: (-3,3) SE edge + (-2,3) SW edge
  { edges: [{ q: -3, r: 3, direction: 1 }, { q: -2, r: 3, direction: 2 }] },
  // lower left: (-3,2) SW edge + (-3,3) W edge
  { edges: [{ q: -3, r: 2, direction: 2 }, { q: -3, r: 3, direction: 3 }] },
  // left: (-3,0) SW edge + (-3,1) W edge
  { edges: [{ q: -3, r: 0, direction: 2 }, { q: -3, r: 1, direction: 3 }] },
  // upper left: (-2,-1) W edge + (-3,0) NW edge
  { edges: [{ q: -2, r: -1, direction: 3 }, { q: -3, r: 0, direction: 4 }] },
];

export const fishingOnCatan: TradersScenario = {
  id: 'fishingOnCatan',
  name: 'Fishing on Catan',
  description:
    'Fish the lake and the six coastal fishing grounds, then spend fish to chase off the robber, steal, take a card, build a free road or a free development card. Pass the old boot on — its holder needs 11 VP to win.',
  minPlayers: 3,
  maxPlayers: 6,
  defaultVpToWin: 10,
  layout3p: LAYOUT_3_4,
  fishingGrounds: FISHING_GROUNDS,
  fishingGroundTokens: [4, 5, 6, 8, 9, 10],
  layout5_6p: LAYOUT_5_6,
  board5_6: {
    prepareLayout: placeLakes5_6,
    fishingGrounds: FISHING_GROUNDS_5_6,
    fishingGroundTokens: [4, 5, 5, 6, 8, 9, 9, 10],
  },
};
