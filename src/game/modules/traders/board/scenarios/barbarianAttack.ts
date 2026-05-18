import type {
  ScenarioLayout,
  ScenarioPosition,
} from '../../../../board/scenarioTypes';
import type { TradersScenario, BarbarianCastleDef } from './types';
import {
  STANDARD_PORT_ANCHORS_3_4,
  standardLand3_4,
} from '../../../base/scenarios/standardShape';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import {
  BARBARIAN_ATTACK_DEFAULT_VP,
  BARBARIAN_BASE_STRENGTH,
} from '../../constants';

// Barbarian Attack — three castles ring the standard 19-hex disc. Each
// castle has a barbarian group creeping along the coast that arrives at
// the castle hex every four turns; combat resolves there automatically
// against any defender knights the players have hired adjacent to the
// castle.
//
// Layout choice: the producing disc is unchanged from the standard 19-hex
// board (no terrain or token re-distribution). Three of the radius-3 sea
// hexes are pinned to `terrain: 'castle'`. The barbarian paths walk
// inward along the outer ring; the generator resolves these via BFS over
// sea/castle terrain.

const NORTH_CASTLE = { q: 0, r: -3 };
const EAST_CASTLE = { q: 3, r: 0 };
const SOUTHWEST_CASTLE = { q: -3, r: 3 };

const CASTLE_COORDS = [NORTH_CASTLE, EAST_CASTLE, SOUTHWEST_CASTLE];

function castleSeaPositions(land: ScenarioPosition[]): ScenarioPosition[] {
  // Start with the radius-3 sea ring, then pin the three castle coords to
  // fixedTerrain: 'castle'. The fixed-terrain pin survives the assembler's
  // shuffled terrain pool because the materializer reads `fixedTerrain`
  // before sampling.
  const sea = seaPositionsInDisk(land, 3);
  const castleKeys = new Set(CASTLE_COORDS.map((c) => `${c.q},${c.r}`));
  return sea.map((p) =>
    castleKeys.has(`${p.q},${p.r}`)
      ? { ...p, kind: 'land', fixedTerrain: 'castle' as const }
      : p,
  );
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [...standardLand3_4(), ...castleSeaPositions(standardLand3_4())],
  portAnchors: STANDARD_PORT_ANCHORS_3_4,
  pools: {
    // Standard 19-hex disc with the classic terrain mix: 18 producing
    // hexes + 1 desert. The castles sit in the radius-3 sea ring outside
    // the disc, so the producing pool is unchanged from base Catan.
    terrainCounts: {
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 4,
      ore: 3,
      desert: 1,
    },
    tokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    portTypes: [
      'generic',
      'generic',
      'generic',
      'generic',
      'wood',
      'brick',
      'sheep',
      'wheat',
      'ore',
    ],
  },
};

const CASTLES: BarbarianCastleDef[] = [
  {
    id: 'castleNorth',
    castle: NORTH_CASTLE,
    // pathStart walks along the north edge of the sea ring eastward to
    // the castle. 4 hexes total: (3, -3) → (2, -3) → (1, -3) → (0, -3).
    pathStart: { q: 3, r: -3 },
    strength: BARBARIAN_BASE_STRENGTH,
  },
  {
    id: 'castleEast',
    castle: EAST_CASTLE,
    // (3, -3) → (3, -2) → (3, -1) → (3, 0). Walks south down the east
    // edge.
    pathStart: { q: 3, r: -3 },
    strength: BARBARIAN_BASE_STRENGTH,
  },
  {
    id: 'castleSouthwest',
    castle: SOUTHWEST_CASTLE,
    // (-3, 0) → (-3, 1) → (-3, 2) → (-3, 3). Walks south down the west
    // edge.
    pathStart: { q: -3, r: 0 },
    strength: BARBARIAN_BASE_STRENGTH,
  },
];

export const barbarianAttack: TradersScenario = {
  id: 'barbarianAttack',
  name: 'Barbarian Attack',
  description:
    "Three castles ring the island. Each turn the barbarians creep one hex closer; when they arrive, defender knights you've hired fight them off. Win a defense for +1 VP per knight; lose one and a defender's building falls.",
  minPlayers: 3,
  maxPlayers: 4,
  defaultVpToWin: BARBARIAN_ATTACK_DEFAULT_VP,
  layout3p: LAYOUT_3_4,
  castles: CASTLES,
};
