import type {
  BoardState,
  EpHiddenTile,
  EpRegion,
  EpSpiceAbility,
  HexId,
  Resource,
  Terrain,
  VertexId,
} from '../../types';
import { assembleBoardFromDefs } from '../../board/scenarioAssembly';
import type { ScenarioHexDef } from '../../board/scenarioTypes';
import { shuffle } from '../../rng';

// The Explorers & Pirates scenario map (2025 Rulebook pp. 6-7), measured
// from the rulebook picture: pointy-top hexes, axial (q, r), the Council of
// Catan at (0, 0), rows r = -3 (north) … 3 (south). Corners run clockwise
// from the north-east (0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N).
//
//   r = -3   q 0 … 8      r = 0   q -3 … 8 (8 is sea printed on the frame)
//   r = -2   q -1 … 8     r = 1   q -3 … 7
//   r = -1   q -2 … 8     r = 2   q -3 … 6
//                         r = 3   q -3 … 5
//
// The starting island (west) has its number discs printed on the map; its
// 14 CATAN land hexes go face up at random. The pasture at (-3, 0) is printed
// on an Explorers & Pirates frame piece (so 15 numbered hexes for the
// rulebook's 14 + 1). The parrot (north, green) and goose (south, orange)
// regions are face down until a ship discovers them.

export const EP_ROWS: ReadonlyArray<{ r: number; qMin: number; qMax: number }> = [
  { r: -3, qMin: 0, qMax: 8 },
  { r: -2, qMin: -1, qMax: 8 },
  { r: -1, qMin: -2, qMax: 8 },
  { r: 0, qMin: -3, qMax: 8 },
  { r: 1, qMin: -3, qMax: 7 },
  { r: 2, qMin: -3, qMax: 6 },
  { r: 3, qMin: -3, qMax: 5 },
];

// Starting island: (q, r) → printed number disc.
export const EP_START_ISLAND: ReadonlyArray<{ q: number; r: number; token: number }> = [
  { q: 0, r: -3, token: 11 },
  { q: 1, r: -3, token: 9 },
  { q: -1, r: -2, token: 3 },
  { q: 0, r: -2, token: 8 },
  { q: -2, r: -1, token: 4 },
  { q: -1, r: -1, token: 10 },
  { q: -3, r: 0, token: 6 },
  { q: -2, r: 0, token: 12 },
  { q: -1, r: 0, token: 8 },
  { q: -3, r: 1, token: 10 },
  { q: -2, r: 1, token: 4 },
  { q: -3, r: 2, token: 11 },
  { q: -2, r: 2, token: 6 },
  { q: -3, r: 3, token: 3 },
  { q: -2, r: 3, token: 5 },
];
// The pasture printed on the frame piece.
export const EP_FIXED_PASTURE = { q: -3, r: 0 } as const;
// The 14 CATAN land hexes (Rulebook p. 5: 2 hills, 4 forests, 3 pastures,
// 2 fields, 3 mountains).
export const EP_START_TERRAINS: Partial<Record<Resource, number>> = {
  brick: 2,
  wood: 4,
  sheep: 3,
  wheat: 2,
  ore: 3,
};

export const EP_PARROT_POSITIONS: ReadonlyArray<{ q: number; r: number }> = [
  ...[4, 5, 6, 7, 8].map((q) => ({ q, r: -3 })),
  ...[3, 4, 5, 6, 7, 8].map((q) => ({ q, r: -2 })),
  ...[2, 3, 5, 7, 8].map((q) => ({ q, r: -1 })),
];
export const EP_GOOSE_POSITIONS: ReadonlyArray<{ q: number; r: number }> = [
  ...[1, 2, 4, 6, 7].map((q) => ({ q, r: 1 })),
  ...[1, 2, 3, 4, 5, 6].map((q) => ({ q, r: 2 })),
  ...[1, 2, 3, 4, 5].map((q) => ({ q, r: 3 })),
];

export const EP_COUNCIL = { q: 0, r: 0 } as const;
// The anchors printed at the Council hex's north and south corners.
export const EP_COUNCIL_ANCHOR_CORNERS = [5, 2] as const;
export const EP_FRAME_HEXES: ReadonlyArray<{ q: number; r: number }> = [{ q: 8, r: 0 }];
// The green-check intersections for the starting harbor settlements: the
// north-east and south-east corners of the island's seven east-coast hexes.
export const EP_HARBOR_SITE_HEXES: ReadonlyArray<{ q: number; r: number }> = [
  { q: 1, r: -3 },
  { q: 0, r: -2 },
  { q: -1, r: -1 },
  { q: -1, r: 0 },
  { q: -2, r: 1 },
  { q: -2, r: 2 },
  { q: -2, r: 3 },
];

// The 17 hexes of each region with one sea hex returned to the box
// (Rulebook p. 3). Fish shoals carry die numbers; spice farms one advantage
// each (the Pirate Bonus farm prints a 5 in the parrot set, a 4 in the
// goose set).
interface RegionTile {
  terrain: Terrain;
  shoal?: number;
  ability?: EpSpiceAbility;
  pirateNumber?: number;
}
function regionPool(region: EpRegion): RegionTile[] {
  const land: Partial<Record<Resource, number>> =
    region === 'parrot'
      ? { brick: 1, wood: 1, sheep: 1, wheat: 1, ore: 2 }
      : { brick: 1, wood: 1, sheep: 1, wheat: 2, ore: 1 };
  const tiles: RegionTile[] = [];
  for (const [t, n] of Object.entries(land) as Array<[Resource, number]>) {
    for (let i = 0; i < n; i++) tiles.push({ terrain: t });
  }
  tiles.push({ terrain: 'sea' });
  for (let i = 0; i < 3; i++) tiles.push({ terrain: 'gold' });
  const shoals = region === 'parrot' ? [1, 2, 3] : [4, 5, 6];
  for (const n of shoals) tiles.push({ terrain: 'sea', shoal: n });
  tiles.push({ terrain: 'spice', ability: 'swiftVoyage' });
  tiles.push({ terrain: 'spice', ability: 'fastGold' });
  tiles.push({ terrain: 'spice', ability: 'pirateBonus', pirateNumber: region === 'parrot' ? 5 : 4 });
  return tiles;
}

// Number discs per region (Rulebook p. 3).
export const EP_REGION_DISCS: Record<EpRegion, readonly number[]> = {
  parrot: [3, 4, 5, 6, 9, 10],
  goose: [4, 5, 8, 9, 10, 11],
};
// ASSUMPTION: the rulebook pictures one pirate lair token (a 3) but doesn't
// list the six numbers on their backs. We use 3, 4, 5, 9, 10, 11 — symmetric
// around 7 like every other disc set, and no 6 / 8 on a field that pays 2
// gold per building.
export const EP_LAIR_TOKENS: readonly number[] = [3, 4, 5, 9, 10, 11];

export interface EpBoardSetup {
  hidden: Record<HexId, EpHiddenTile>;
  regionOf: Record<HexId, EpRegion>;
  discs: Record<EpRegion, number[]>;
  lairTokens: number[];
  councilHex: HexId;
  councilAnchors: VertexId[];
  startIsland: HexId[];
  frameHexes: HexId[];
  harborSites: VertexId[];
}

export interface EpBoardResult {
  board: BoardState;
  rngState: number;
  setup: EpBoardSetup;
}

const key = (c: { q: number; r: number }): HexId => `${c.q},${c.r}`;

export function generateExplorersPiratesBoard(rngState: number): EpBoardResult {
  let rng = rngState;
  const island = new Map(EP_START_ISLAND.map((h) => [key(h), h.token]));

  // Starting island terrain: the frame's pasture, the rest at random.
  const terrainPool: Terrain[] = [];
  for (const [t, n] of Object.entries(EP_START_TERRAINS) as Array<[Resource, number]>) {
    for (let i = 0; i < n; i++) terrainPool.push(t);
  }
  let terrains: Terrain[];
  [terrains, rng] = shuffle(rng, terrainPool);

  const defs: ScenarioHexDef[] = [];
  for (const row of EP_ROWS) {
    for (let q = row.qMin; q <= row.qMax; q++) {
      const id = key({ q, r: row.r });
      const token = island.get(id);
      if (token !== undefined) {
        const fixed = q === EP_FIXED_PASTURE.q && row.r === EP_FIXED_PASTURE.r;
        defs.push({ q, r: row.r, terrain: fixed ? 'sheep' : terrains.pop()!, token });
      } else {
        // Sea, the Council of Catan, and the face-down regions (shown as sea
        // until explored; what's under them lives in `hidden`).
        defs.push({ q, r: row.r, terrain: 'sea', token: null });
      }
    }
  }

  const hidden: Record<HexId, EpHiddenTile> = {};
  const regionOf: Record<HexId, EpRegion> = {};
  for (const [region, positions] of [
    ['parrot', EP_PARROT_POSITIONS],
    ['goose', EP_GOOSE_POSITIONS],
  ] as const) {
    let pool: RegionTile[];
    [pool, rng] = shuffle(rng, regionPool(region));
    positions.forEach((pos, i) => {
      const tile = pool[i]!;
      const id = key(pos);
      regionOf[id] = region;
      hidden[id] = {
        region,
        terrain: tile.terrain,
        ...(tile.shoal !== undefined ? { shoal: tile.shoal } : {}),
        ...(tile.ability ? { ability: tile.ability } : {}),
        ...(tile.pirateNumber !== undefined ? { pirateNumber: tile.pirateNumber } : {}),
      };
    });
  }

  let parrotDiscs: number[];
  let gooseDiscs: number[];
  let lairTokens: number[];
  [parrotDiscs, rng] = shuffle(rng, EP_REGION_DISCS.parrot);
  [gooseDiscs, rng] = shuffle(rng, EP_REGION_DISCS.goose);
  [lairTokens, rng] = shuffle(rng, EP_LAIR_TOKENS);

  const councilHex = key(EP_COUNCIL);
  // No robber in Explorers & Pirates (state.robberActive is false); park the
  // board's robber field on the Council so renderers have a hex.
  const assembled = assembleBoardFromDefs(defs, [], { robberHint: EP_COUNCIL }, rng);
  const board = assembled.board;
  delete board.pirateHex;

  const council = board.hexes[councilHex]!;
  const councilAnchors = EP_COUNCIL_ANCHOR_CORNERS.map((c) => council.corners[c]!);
  const harborSites: VertexId[] = [];
  for (const h of EP_HARBOR_SITE_HEXES) {
    const corners = board.hexes[key(h)]!.corners;
    for (const c of [0, 1]) {
      const v = corners[c]!;
      if (!harborSites.includes(v)) harborSites.push(v);
    }
  }

  return {
    board,
    rngState: assembled.rngState,
    setup: {
      hidden,
      regionOf,
      discs: { parrot: parrotDiscs, goose: gooseDiscs },
      lairTokens,
      councilHex,
      councilAnchors,
      startIsland: EP_START_ISLAND.map(key),
      frameHexes: EP_FRAME_HEXES.map(key),
      harborSites,
    },
  };
}
