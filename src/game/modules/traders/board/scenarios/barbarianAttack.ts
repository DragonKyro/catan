import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { Terrain } from '../../../../types';
import { shuffle } from '../../../../rng';
import type { TradersScenario } from './types';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import { TB_FRAME_PORTS_3_4 } from '../frame';
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
function dealAreaTerrain(layout: ScenarioLayout, rngState: number): [ScenarioLayout, number] {
  let rng = rngState;
  let coastal: Terrain[];
  let inner: Terrain[];
  [coastal, rng] = shuffle(rng, COASTAL_TERRAIN);
  [inner, rng] = shuffle(rng, INNER_TERRAIN);
  const key = (c: Coord) => `${c.q},${c.r}`;
  const pinned = new Map<string, Terrain>();
  COASTAL_NUMBERS.forEach((c, i) => pinned.set(key(c), coastal[i]!));
  INNER_NUMBERS.forEach((c, i) => pinned.set(key(c), inner[i]!));
  const positions = layout.positions.map((p) => {
    const t = pinned.get(key(p));
    return t ? { ...p, fixedTerrain: t } : p;
  });
  return [{ ...layout, positions }, rng];
}

export const barbarianAttack: TradersScenario = {
  id: 'barbarianAttack',
  name: 'Barbarian Attack',
  description:
    'Barbarians land on the coast every time someone builds. Three on a hex conquer it — no production, and buildings touching only conquered hexes count for nothing. Buy development cards to raise knights, move them at the end of your turn and drive the barbarians off: every 2 prisoners are worth 1 VP. 12 VP wins.',
  minPlayers: 3,
  maxPlayers: 4,
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
};
