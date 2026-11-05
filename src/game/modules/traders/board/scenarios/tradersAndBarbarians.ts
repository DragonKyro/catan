import type { ScenarioLayout, ScenarioPosition } from '../../../../board/scenarioTypes';
import type { TradersScenario, TradersBarbariansDef } from './types';
import { standardLand3_4 } from '../../../base/scenarios/standardShape';
import { seaPositionsInDisk } from '../../../base/scenarios/helpers';
import { TB_FRAME_PORTS_3_4 } from '../frame';
import { TB_SCENARIO_DEFAULT_VP } from '../../tradersBarbarians/constants';

// "Traders & Barbarians" (2025 rulebook pp. 20-24), 3-4 players.
//
// Variable setup minus 1 pasture, 1 field, the desert and the 2 / 12 discs.
// The three commodity hexes sit on corner hexes of the island with the
// sides that have no interior path against the frame; each frame-side edge
// carries an "X" marker (no roads). Each hex's four inland corners have an
// interior path to its centre plaza. Three barbarians start on edges.
// Coordinates per the orchestrator's TBS-SPEC (axial, pointy-top; edge
// directions 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE; corners 0 NE, 1 SE, 2 S,
// 3 SW, 4 NW, 5 N).

const QUARRY = { q: 2, r: -2 };
const CASTLE = { q: -2, r: 0 };
const GLASSWORKS = { q: 0, r: 2 };
const COMMODITY_HEXES = [QUARRY, CASTLE, GLASSWORKS];

export const TRADERS_BARBARIANS_DEF: TradersBarbariansDef = {
  locations: [
    // X on NW, NE, E; paths from SE, S, SW, NW.
    { id: 'quarry', ...QUARRY, xEdges: [4, 5, 0], pathCorners: [1, 2, 3, 4] },
    // X on NW, W, SW; paths from N, NE, SE, S.
    { id: 'castle', ...CASTLE, xEdges: [4, 3, 2], pathCorners: [5, 0, 1, 2] },
    // X on E, SE, SW; paths from N, NE, SW, NW.
    { id: 'glassworks', ...GLASSWORKS, xEdges: [0, 1, 2], pathCorners: [5, 0, 3, 4] },
  ],
  barbarians: [
    [{ q: 1, r: -2 }, { q: 1, r: -1 }],
    [{ q: -1, r: 0 }, { q: -2, r: 1 }],
    [{ q: 0, r: 1 }, { q: 1, r: 1 }],
  ],
};

function land(): ScenarioPosition[] {
  return standardLand3_4().map((p) =>
    COMMODITY_HEXES.some((c) => c.q === p.q && c.r === p.r)
      ? { ...p, fixedTerrain: 'commodity' as const, noToken: true }
      : p,
  );
}

const LAYOUT_3_4: ScenarioLayout = {
  positions: [...land(), ...seaPositionsInDisk(land(), 3)],
  portAnchors: TB_FRAME_PORTS_3_4,
  pools: {
    // Base terrain minus 1 pasture, 1 field and the desert: 16 hexes.
    terrainCounts: { wood: 4, sheep: 3, wheat: 3, brick: 3, ore: 3 },
    // Base discs minus the 2 and the 12.
    tokens: [3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11],
    portTypes: [],
  },
};

export const tradersAndBarbarians: TradersScenario = {
  id: 'tradersAndBarbarians',
  name: 'Traders & Barbarians',
  description:
    'Haul goods between the quarry, the castle and the glassworks. At the end of your turn your wagon moves along the roads (cheap on your own, a toll on a rival’s, slow past a barbarian), delivers a token for 1 VP and gold, and picks up the next. Upgrade the wagon, buy Knights to move barbarians and rob roads. 2s and 12s are re-rolled. 13 VP wins.',
  minPlayers: 3,
  maxPlayers: 4,
  defaultVpToWin: TB_SCENARIO_DEFAULT_VP,
  coins: true,
  layout3p: LAYOUT_3_4,
  tradersBarbarians: TRADERS_BARBARIANS_DEF,
};
