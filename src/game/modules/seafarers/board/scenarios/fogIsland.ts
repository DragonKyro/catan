import type { ScenarioLayout } from '../types';
import { buildScenario } from './builder';
import { parseRows } from './frame5_6';

// Fog Island — main island plus a foggy archipelago. Fog hexes start hidden
// (`fogHexes`); each one is revealed when a player builds adjacent to it and
// the revealing player gets one of the revealed resource (gold prompts the
// choose-resource flow, desert / sea reveal silently). Terrain + token
// behind the fog come from a SEPARATE `fogPools` so reveals stay random but
// don't leak through the main map's pool counts.
//
// Layout authored in the map builder; 14 land + 30 sea inside a radius-4
// disk, 8 ports, 12 fog hexes. No fixed terrain on the main island.

// ---------------------------------------------------------------------------
// 3-4 player layout from `fog islands.json`.
// ---------------------------------------------------------------------------
const FOG_COORDS_3_4P: { q: number; r: number }[] = [
  { q: -1, r: 4 },
  { q: 0, r: 4 },
  { q: 1, r: 3 },
  { q: 0, r: 3 },
  { q: 0, r: 2 },
  { q: 0, r: 1 },
  { q: 0, r: 0 },
  { q: 0, r: -1 },
  { q: -1, r: -1 },
  { q: -2, r: -1 },
  { q: -1, r: -2 },
  { q: 0, r: -2 },
];

const LAYOUT_3_4P: ScenarioLayout = {
  positions: [
    // Land hexes — west cluster.
    { q: -3, r: 1, kind: 'land' },
    { q: -3, r: 2, kind: 'land' },
    { q: -3, r: 3, kind: 'land' },
    { q: -3, r: 4, kind: 'land' },
    { q: -2, r: 1, kind: 'land' },
    { q: -2, r: 2, kind: 'land' },
    { q: -2, r: 3, kind: 'land' },
    // Land hexes — east cluster.
    { q: 2, r: -2, kind: 'land' },
    { q: 2, r: -1, kind: 'land' },
    { q: 2, r: 0, kind: 'land' },
    { q: 2, r: 1, kind: 'land' },
    { q: 3, r: -2, kind: 'land' },
    { q: 3, r: -1, kind: 'land' },
    { q: 3, r: 0, kind: 'land' },
    // Sea hexes (and fog cells which are listed as sea here — the generator
    // re-pins them from `fogPools` at game-start so they reveal as random
    // terrain).
    { q: -4, r: 1, kind: 'sea' },
    { q: -4, r: 2, kind: 'sea' },
    { q: -4, r: 3, kind: 'sea' },
    { q: -4, r: 4, kind: 'sea' },
    { q: -3, r: 0, kind: 'sea' },
    { q: -2, r: -1, kind: 'sea' },
    { q: -2, r: 0, kind: 'sea' },
    { q: -2, r: 4, kind: 'sea' },
    { q: -1, r: -2, kind: 'sea' },
    { q: -1, r: -1, kind: 'sea' },
    { q: -1, r: 0, kind: 'sea' },
    { q: -1, r: 1, kind: 'sea' },
    { q: -1, r: 2, kind: 'sea' },
    { q: -1, r: 3, kind: 'sea' },
    { q: -1, r: 4, kind: 'sea' },
    { q: 0, r: -2, kind: 'sea' },
    { q: 0, r: -1, kind: 'sea' },
    { q: 0, r: 0, kind: 'sea' },
    { q: 0, r: 1, kind: 'sea' },
    { q: 0, r: 2, kind: 'sea' },
    { q: 0, r: 3, kind: 'sea' },
    { q: 0, r: 4, kind: 'sea' },
    { q: 1, r: -2, kind: 'sea' },
    { q: 1, r: -1, kind: 'sea' },
    { q: 1, r: 0, kind: 'sea' },
    { q: 1, r: 1, kind: 'sea' },
    { q: 1, r: 2, kind: 'sea' },
    { q: 1, r: 3, kind: 'sea' },
    { q: 2, r: 2, kind: 'sea' },
    { q: 3, r: 1, kind: 'sea' },
  ],
  // 8 ports. Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  portAnchors: [
    { q: -3, r: 4, direction: 3 },
    { q: -3, r: 2, direction: 2 },
    { q: -3, r: 1, direction: 2 },
    { q: -2, r: 4, direction: 4 },
    { q: 3, r: 1, direction: 3 },
    { q: 3, r: 0, direction: 5 },
    { q: 3, r: -2, direction: 0 },
    { q: 2, r: -2, direction: 5 },
  ],
  pools: {
    // 14 main-island land hexes; no desert / gold (gold lives in the fog
    // pool). Resource mix matches `fog islands.json`.
    terrainCounts: {
      wood: 4,
      brick: 2,
      sheep: 4,
      wheat: 2,
      ore: 2,
    },
    // 14 tokens — symmetric around 7 with no 2 / 12 (those live in the
    // fog pool so the foggy archipelago lands the extreme rolls).
    tokens: [
      3,
      4, 4,
      5, 5,
      6, 6,
      8, 8,
      9, 9,
      10, 10,
      11,
    ],
    // 8 port types — 5 single-resource + 3 generic.
    portTypes: [
      'brick', 'wheat', 'wood', 'sheep', 'ore',
      'generic', 'generic', 'generic',
    ],
  },
};

// ---------------------------------------------------------------------------
// 5-6 players (Seafarers 5-6 rulebook p. 6; docs/map-specs/SEAFARERS56-SPEC-A.md).
// "Set up the game as shown, including creating the facedown hex and number
// disc stacks for the fog islands. Place the robber on the field hex with
// the number 12 disc and the pirate on the indicated location." Two printed
// 12-hex islands (terrain, discs and harbor types all printed) either side
// of 18 fog hexes (`f`). The frame's two middle-row points are sea hexes too
// (the table's 14 face-up sea leaves them out).
// ---------------------------------------------------------------------------
const PARSED_5_6P = parseRows([
  [-3, -2, 'F10 ~   f f   ~ F9 W2'],
  [-2, -3, 'P6 ~   f f f   ~ W5 O12'],
  [-1, -4, 'W12 B4 ~   f f f   ~ P4 B8'],
  [0, -5, '~ O11 P5 ~   f f   ~ F6 P3 ~'],
  [1, -5, 'W6 F3 ~   f f f   ~ O9 W4'],
  [2, -5, 'B9 P8 ~   f f f   ~ B10'],
  [3, -5, 'B11 O10 ~   f f   ~ F8'],
]);
const FOG_COORDS_5_6P = PARSED_5_6P.fog;

const LAYOUT_5_6P: ScenarioLayout = {
  positions: PARSED_5_6P.positions,
  // 11 harbors with their printed types. Direction: 0 E, 1 SE, 2 SW, 3 W,
  // 4 NW, 5 NE.
  portAnchors: [
    // West island.
    { q: -3, r: -2, direction: 4, fixedType: 'generic' },
    { q: -3, r: -1, direction: 0, fixedType: 'sheep' },
    { q: -4, r: 0, direction: 3, fixedType: 'ore' },
    { q: -5, r: 2, direction: 3, fixedType: 'generic' },
    { q: -4, r: 3, direction: 5, fixedType: 'generic' },
    // East island.
    { q: 3, r: -3, direction: 5, fixedType: 'wood' },
    { q: 4, r: -1, direction: 5, fixedType: 'generic' },
    { q: 3, r: -2, direction: 2, fixedType: 'sheep' },
    { q: 3, r: 1, direction: 5, fixedType: 'brick' },
    { q: 3, r: 1, direction: 1, fixedType: 'wheat' },
    { q: 2, r: 2, direction: 3, fixedType: 'generic' },
  ],
  robberStart: { q: -4, r: -1 },
  // The rulebook's pirate sits on the frame below the two southern fog
  // hexes, where no hex exists here. (0,3) is the nearest sea hex touching
  // as little land / fog as any (one land hex, two fog), on the same side
  // as the 3-4 map's pirate.
  pirateStart: { q: 0, r: 3 },
  pools: {
    // Everything face up is printed: hills 5, forest 5, pasture 5, fields 5,
    // mountains 4; discs 2 3,3 4×3 5,5 6×3 8×3 9×3 10×3 11,11 12,12.
    terrainCounts: {},
    tokens: [],
    portTypes: [],
  },
};

export const fogIsland = buildScenario({
  id: 'fogIsland',
  name: 'Fog Island',
  // No island bonus in The Fog Islands; discovering a land hex pays 1
  // resource instead. Starting settlements may go on one or two islands.
  defaultIslandBonusVp: 0,
  defaultVpToWin: 12,
  startingPlacementZone: 'anyIsland',
  minPlayers: 3,
  maxPlayers: 6,
  fogHexes: FOG_COORDS_3_4P,
  fogHexes5_6: FOG_COORDS_5_6P,
  // Fog pool from `fog islands.json`. 12 fog tiles: 2 gold + 1 wood +
  // 1 sheep + 2 ore + 2 wheat + 2 brick + 2 sea = 12. 10 producing tiles
  // (12 - 2 sea) → 10 tokens.
  fogPools: {
    terrainCounts: {
      gold: 2,
      wood: 1,
      sheep: 1,
      ore: 2,
      wheat: 2,
      brick: 2,
      sea: 2,
    },
    tokens: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
  },
  // 5-6p face-down stack (rulebook p. 6 table): sea 3, gold 3, hills 2,
  // forest 2, pasture 2, fields 2, mountains 3, desert 1 = 18; discs for the
  // 14 producing hexes: 2,2 3,3 4 5,5 6 8 9 10 11,11 12.
  fogPools5_6: {
    terrainCounts: {
      sea: 3,
      gold: 3,
      brick: 2,
      wood: 2,
      sheep: 2,
      wheat: 2,
      ore: 3,
      desert: 1,
    },
    tokens: [2, 2, 3, 3, 4, 5, 5, 6, 8, 9, 10, 11, 11, 12],
  },
  layout3p: LAYOUT_3_4P,
  layout5_6p: LAYOUT_5_6P,
});
