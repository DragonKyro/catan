import type {
  BoardState,
  EdgeId,
  FishingGround,
  HexId,
  RiverPath,
} from '../../../types';
import { assembleBoardFromLayout } from '../../../board/scenarioAssembly';
import { getTradersScenario } from './scenarios';
import type {
  TradersScenario,
} from './scenarios/types';
import { resolveBarbarianBoard, type BarbarianBoardSetup } from '../barbarianAttack/board';
import { resolveFishingGrounds, resolveRivers } from './resolveRiversAndFishing';
import {
  resolveTradersBarbariansBoard,
  type TradersBarbariansBoardSetup,
} from '../tradersBarbarians/board';

export interface TradersBoardResult {
  board: BoardState;
  rngState: number;
  // Concrete river-edge ids (bridge sites). Roads forbidden here at the
  // engine level — see placement.ts and the buildBridge handler.
  riverEdges: EdgeId[];
  // Rivers of Catan: the river tiles (hexes source → mouth). Empty otherwise.
  rivers: RiverPath[];
  // Fishing on Catan extras. Both undefined for Rivers / future scenarios
  // that don't use them.
  lakeHexId: HexId | null;
  fishingGrounds: FishingGround[];
  // Merchant Trains: the watering hole hex id (origin of every train).
  // null when the scenario doesn't have one.
  wateringHoleHexId: HexId | null;
  // Barbarian Attack: castle, coastal hexes in expel order, starting
  // barbarians. null in every other scenario.
  barbarianAttack: BarbarianBoardSetup | null;
  // Traders & Barbarians scenario: commodity hexes (plazas + interior
  // paths, already added to `board`), X edges, barbarian start edges.
  tradersBarbarians: TradersBarbariansBoardSetup | null;
}

export function generateTradersBoard(
  scenarioId: string | undefined,
  rngState: number,
  numPlayers = 3,
): TradersBoardResult {
  const scenario = getTradersScenario(scenarioId ?? 'riversOfCatan');
  let layout = pickLayout(scenario, numPlayers);
  if (!layout) {
    throw new Error(
      `Traders & Barbarians scenario "${scenario.id}" has no layout for ${numPlayers} players`,
    );
  }
  if (scenario.prepareLayout) [layout, rngState] = scenario.prepareLayout(layout, rngState);
  const assembled = assembleBoardFromLayout(layout, rngState);
  // T&B maps have no pirate; drop the sea hex the assembler parks one on so
  // no pirate ship is drawn.
  delete assembled.board.pirateHex;
  let rng = assembled.rngState;
  const { rivers, riverEdges } = resolveRivers(scenario.rivers ?? [], assembled.board);
  const lakeHexId = scenario.lake
    ? `${scenario.lake.q},${scenario.lake.r}`
    : findHexByTerrain(assembled.board, 'lake');
  let fishingGrounds: FishingGround[];
  [fishingGrounds, rng] = resolveFishingGrounds(
    scenario.fishingGrounds ?? [],
    scenario.fishingGroundTokens ?? [],
    assembled.board,
    rng,
  );
  const wateringHoleHexId = scenario.wateringHole
    ? `${scenario.wateringHole.q},${scenario.wateringHole.r}`
    : findHexByTerrain(assembled.board, 'wateringHole');
  const barbarianAttack = scenario.barbarianAttack
    ? resolveBarbarianBoard(scenario.barbarianAttack, assembled.board)
    : null;
  let tradersBarbarians: TradersBarbariansBoardSetup | null = null;
  if (scenario.tradersBarbarians) {
    const tb = resolveTradersBarbariansBoard(scenario.tradersBarbarians, assembled.board);
    assembled.board = tb.board;
    tradersBarbarians = tb.setup;
  }
  // Fishing on Catan: the robber starts off-board. We can't represent
  // "no robber hex" in BoardState, so we keep robberHex pointing at the
  // lake (or whatever the assembly picked) and rely on `state.robberActive`
  // to flag whether the robber is on the board. createGame wires this.
  return {
    board: assembled.board,
    rngState: rng,
    riverEdges,
    rivers,
    lakeHexId: lakeHexId && assembled.board.hexes[lakeHexId] ? lakeHexId : null,
    fishingGrounds,
    wateringHoleHexId:
      wateringHoleHexId && assembled.board.hexes[wateringHoleHexId]
        ? wateringHoleHexId
        : null,
    barbarianAttack,
    tradersBarbarians,
  };
}

function findHexByTerrain(
  board: BoardState,
  terrain: BoardState['hexes'][string]['terrain'],
): HexId | null {
  for (const id of board.hexIds) {
    if (board.hexes[id]?.terrain === terrain) return id;
  }
  return null;
}

function pickLayout(scenario: TradersScenario, numPlayers: number) {
  if (numPlayers === 3 || numPlayers === 4) return scenario.layout3p ?? null;
  return null;
}
