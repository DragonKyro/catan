import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { Terrain } from '../../../../types';
import { shuffle } from '../../../../rng';
import type { TradersScenario } from './types';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import { TB_FRAME_PORTS_3_4, TB_FRAME_PORTS_5_6 } from '../frame';
import { tbPositions5_6 } from './board5_6';
import { BARBARIAN_ATTACK_DEFAULT_VP } from '../../constants';

// Barbarian Attack (2025 rulebook pp.15-19), 3-4 players.
//
// The rulebook prints the number discs in fixed places (one forest and one
// 11 disc are returned to the box). The castle and the desert are fixed on
// the coast; the other terrain is random within two areas: the grey coastal
// ring (2 hills, 2 forests, 3 pastures, 2 fields, 1 mountains) and the white
// inner area (1 hills, 1 forest, 1 pasture, 2 fields, 2 mountains). The
// coastal numbers are 2-6 and 8-12 once each, so every non-7 roll names
// exactly one coastal hex — that is where landing barbarians go.

type Coord = { q: number; r: number };

// Fixed number discs, top row to bottom row.
const COASTAL_NUMBERS: Array<Coord & { token: number }> = [
  { q: 0, r: -2, token: 3 },
  { q: 1, r: -2, token: 8 },
  { q: -1, r: -1, token: 9 },
  { q: 2, r: -1, token: 10 },
  { q: -2, r: 0, token: 12 },
  { q: 2, r: 0, token: 11 },
  { q: -2, r: 1, token: 4 },
  { q: 1, r: 1, token: 5 },
  { q: -1, r: 2, token: 6 },
  { q: 0, r: 2, token: 2 },
];
const INNER_NUMBERS: Array<Coord & { token: number }> = [
  { q: 0, r: -1, token: 4 },
  { q: 1, r: -1, token: 5 },
  { q: -1, r: 0, token: 6 },
  { q: 0, r: 0, token: 10 },
  { q: 1, r: 0, token: 8 },
  { q: -1, r: 1, token: 9 },
  { q: 0, r: 1, token: 3 },
];
export const BARBARIAN_ATTACK_CASTLE: Coord = { q: -2, r: 2 };
export const BARBARIAN_ATTACK_DESERT: Coord = { q: 2, r: -2 };

// Terrain pools (hills = brick, forest = wood, pasture = sheep, fields =
// wheat, mountains = ore).
const COASTAL_TERRAIN: Terrain[] = [
  'brick', 'brick', 'wood', 'wood', 'sheep', 'sheep', 'sheep', 'wheat', 'wheat', 'ore',
];
const INNER_TERRAIN: Terrain[] = ['brick', 'wood', 'sheep', 'wheat', 'wheat', 'ore', 'ore'];

// Expel order: "Starting with the number 4 coastal hex (next to the castle)
// and moving clockwise around the island" — ends with the castle.
const EXPEL_ORDER: Coord[] = [
  { q: -2, r: 1 },
  { q: -2, r: 0 },
  { q: -1, r: -1 },
  { q: 0, r: -2 },
  { q: 1, r: -2 },
  { q: 2, r: -2 },
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 2 },
  { q: -2, r: 2 },
];

// One barbarian starts on the 2 hex and one on the 12 hex.
const START_BARBARIANS: Coord[] = [
  { q: 0, r: 2 },
  { q: -2, r: 0 },
];

function land(): ScenarioPosition[] {
  return [
    ...COASTAL_NUMBERS.map((c) => ({ q: c.q, r: c.r, kind: 'land' as const, fixedToken: c.token })),
    ...INNER_NUMBERS.map((c) => ({ q: c.q, r: c.r, kind: 'land' as const, fixedToken: c.token })),
    { ...BARBARIAN_ATTACK_CASTLE, kind: 'land', fixedTerrain: 'castle' },
    { ...BARBARIAN_ATTACK_DESERT, kind: 'desert' },
  ];
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [...land(), ...seaPositionsInDisk(land(), 3)],
  portAnchors: TB_FRAME_PORTS_3_4,
  pools: {
    // Terrain is pinned per area by `prepareLayout` below; every number
    // disc is fixed on its position.
    terrainCounts: {},
    tokens: [],
    portTypes: [],
  },
};

// Deal each area's terrain at random, then pin it on the layout.
function areaDealer(
  coastalNumbers: Array<Coord & { token: number }>,
  coastalTerrain: Terrain[],
  innerNumbers: Array<Coord & { token: number }>,
  innerTerrain: Terrain[],
) {
  return (layout: ScenarioLayout, rngState: number): [ScenarioLayout, number] => {
    let rng = rngState;
    let coastal: Terrain[];
    let inner: Terrain[];
    [coastal, rng] = shuffle(rng, coastalTerrain);
    [inner, rng] = shuffle(rng, innerTerrain);
    const key = (c: Coord) => `${c.q},${c.r}`;
    const pinned = new Map<string, Terrain>();
    coastalNumbers.forEach((c, i) => pinned.set(key(c), coastal[i]!));
    innerNumbers.forEach((c, i) => pinned.set(key(c), inner[i]!));
    const positions = layout.positions.map((p) => {
      const t = pinned.get(key(p));
      return t ? { ...p, fixedTerrain: t } : p;
    });
    return [{ ...layout, positions }, rng];
  };
}
const dealAreaTerrain = areaDealer(COASTAL_NUMBERS, COASTAL_TERRAIN, INNER_NUMBERS, INNER_TERRAIN);

// ----- 5-6 players (T&B 5-6 rulebook pp. 8-9; TB56-MAP-SPEC) -----
//
// Two castles at (-3,0) and (2,0) on the left and right coast, printed the
// same way round as the 3-4 tile (so the knight-loss colours by edge
// direction don't change), and the two deserts at (2,-1) and (-3,1). "Return
// 1 forest, 1 pasture, the number 2 disc, the number 12 disc": the 26 discs
// are printed in place — the coast carries 2, 3, 4, 6, 8, 10, 11, 12 once
// and 5 and 9 twice ("when a 5 or a 9 is rolled, place barbarians on both
// corresponding hexes"). Grey coastal ring: 3 hills, 3 forests, 2 pastures,
// 2 fields, 2 mountains; white inner area: 2 hills, 2 forests, 3 pastures,
// 4 fields, 3 mountains.

const COASTAL_NUMBERS_5_6: Array<Coord & { token: number }> = [
  { q: 0, r: -3, token: 12 },
  { q: 1, r: -3, token: 9 },
  { q: 2, r: -3, token: 3 },
  { q: -1, r: -2, token: 4 },
  { q: 2, r: -2, token: 8 },
  { q: -2, r: -1, token: 5 },
  { q: 1, r: 1, token: 9 },
  { q: -3, r: 2, token: 6 },
  { q: 0, r: 2, token: 10 },
  { q: -3, r: 3, token: 2 },
  { q: -2, r: 3, token: 5 },
  { q: -1, r: 3, token: 11 },
];
const INNER_NUMBERS_5_6: Array<Coord & { token: number }> = [
  { q: 0, r: -2, token: 5 },
  { q: 1, r: -2, token: 10 },
  { q: -1, r: -1, token: 11 },
  { q: 0, r: -1, token: 6 },
  { q: 1, r: -1, token: 3 },
  { q: -2, r: 0, token: 8 },
  { q: -1, r: 0, token: 10 },
  { q: 0, r: 0, token: 4 },
  { q: 1, r: 0, token: 6 },
  { q: -2, r: 1, token: 3 },
  { q: -1, r: 1, token: 8 },
  { q: 0, r: 1, token: 11 },
  { q: -2, r: 2, token: 4 },
  { q: -1, r: 2, token: 9 },
];
export const BARBARIAN_ATTACK_CASTLES_5_6: Coord[] = [
  { q: -3, r: 0 },
  { q: 2, r: 0 },
];
export const BARBARIAN_ATTACK_DESERTS_5_6: Coord[] = [
  { q: 2, r: -1 },
  { q: -3, r: 1 },
];
const COASTAL_TERRAIN_5_6: Terrain[] = [
  'brick', 'brick', 'brick', 'wood', 'wood', 'wood', 'sheep', 'sheep', 'wheat', 'wheat', 'ore', 'ore',
];
const INNER_TERRAIN_5_6: Terrain[] = [
  'brick', 'brick', 'wood', 'wood', 'sheep', 'sheep', 'sheep', 'wheat', 'wheat', 'wheat', 'wheat', 'ore', 'ore', 'ore',
];

// "Start with the number 5 coastal hex (next to the castle) and move
// clockwise around the island" — the 5 beside the (-3,0) castle, ending
// with that castle. Deserts and castles stay in the list like the 3-4 one.
const EXPEL_ORDER_5_6: Coord[] = [
  { q: -2, r: -1 },
  { q: -1, r: -2 },
  { q: 0, r: -3 },
  { q: 1, r: -3 },
  { q: 2, r: -3 },
  { q: 2, r: -2 },
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 3 },
  { q: -2, r: 3 },
  { q: -3, r: 3 },
  { q: -3, r: 2 },
  { q: -3, r: 1 },
  { q: -3, r: 0 },
];

// One barbarian on the 2 hex and one on the 12 hex (unchanged at 5-6).
const START_BARBARIANS_5_6: Coord[] = [
  { q: -3, r: 3 },
  { q: 0, r: -3 },
];

const fixed5_6 = new Map<string, number>(
  [...COASTAL_NUMBERS_5_6, ...INNER_NUMBERS_5_6].map((c) => [`${c.q},${c.r}`, c.token]),
);

const LAYOUT_5_6: ScenarioLayout = {
  positions: tbPositions5_6((p) => {
    const key = `${p.q},${p.r}`;
    if (BARBARIAN_ATTACK_CASTLES_5_6.some((c) => c.q === p.q && c.r === p.r)) {
      return { ...p, fixedTerrain: 'castle' };
    }
    if (BARBARIAN_ATTACK_DESERTS_5_6.some((c) => c.q === p.q && c.r === p.r)) {
      return { ...p, kind: 'desert' };
    }
    return { ...p, fixedToken: fixed5_6.get(key)! };
  }),
  portAnchors: TB_FRAME_PORTS_5_6,
  pools: { terrainCounts: {}, tokens: [], portTypes: [] },
};

export const barbarianAttack: TradersScenario = {
  id: 'barbarianAttack',
  name: 'Barbarian Attack',
  description:
    'Barbarians land on the coast every time someone builds. Three on a hex conquer it — no production, and buildings touching only conquered hexes count for nothing. Buy development cards to raise knights, move them at the end of your turn and drive the barbarians off: every 2 prisoners are worth 1 VP. 12 VP wins.',
  minPlayers: 3,
  maxPlayers: 6,
  defaultVpToWin: BARBARIAN_ATTACK_DEFAULT_VP,
  // Coins (spendGold / buyGold) but no Wealthiest / Poor tiles.
  coins: true,
  layout3p: LAYOUT_3_4,
  prepareLayout: dealAreaTerrain,
  barbarianAttack: {
    castle: BARBARIAN_ATTACK_CASTLE,
    expelOrder: EXPEL_ORDER,
    startBarbarians: START_BARBARIANS,
  },
  layout5_6p: LAYOUT_5_6,
  board5_6: {
    prepareLayout: areaDealer(
      COASTAL_NUMBERS_5_6,
      COASTAL_TERRAIN_5_6,
      INNER_NUMBERS_5_6,
      INNER_TERRAIN_5_6,
    ),
    barbarianAttack: {
      castle: BARBARIAN_ATTACK_CASTLES_5_6[0]!,
      extraCastles: BARBARIAN_ATTACK_CASTLES_5_6.slice(1),
      expelOrder: EXPEL_ORDER_5_6,
      startBarbarians: START_BARBARIANS_5_6,
    },
  },
};
