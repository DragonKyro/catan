import type { BoardState, EdgeId, FishingGround, HexId } from '../../../types';
import { assembleBoardFromLayout } from '../../../board/scenarioAssembly';
import { getTradersScenario } from './scenarios';
import type {
  TradersScenario,
  ScenarioEdgeRef,
  FishingGroundDef,
} from './scenarios/types';

export interface TradersBoardResult {
  board: BoardState;
  rngState: number;
  // Concrete river-edge ids (bridge sites). Roads forbidden here at the
  // engine level — see placement.ts and the buildBridge handler.
  riverEdges: EdgeId[];
  // Fishing on Catan extras. Both undefined for Rivers / future scenarios
  // that don't use them.
  lakeHexId: HexId | null;
  fishingGrounds: FishingGround[];
}

export function generateTradersBoard(
  scenarioId: string | undefined,
  rngState: number,
  numPlayers = 3,
): TradersBoardResult {
  const scenario = getTradersScenario(scenarioId ?? 'riversOfCatan');
  const layout = pickLayout(scenario, numPlayers);
  if (!layout) {
    throw new Error(
      `Traders & Barbarians scenario "${scenario.id}" has no layout for ${numPlayers} players`,
    );
  }
  const assembled = assembleBoardFromLayout(layout, rngState);
  const riverEdges = resolveRiverEdges(
    scenario.riverEdges ?? [],
    assembled.board,
  );
  const lakeHexId = scenario.lake
    ? `${scenario.lake.q},${scenario.lake.r}`
    : findLakeHex(assembled.board);
  const fishingGrounds = resolveFishingGrounds(
    scenario.fishingGrounds ?? [],
    assembled.board,
  );
  // Fishing on Catan: the robber starts off-board. We can't represent
  // "no robber hex" in BoardState, so we keep robberHex pointing at the
  // lake (or whatever the assembly picked) and rely on `state.robberActive`
  // to flag whether the robber is on the board. createGame wires this.
  return {
    board: assembled.board,
    rngState: assembled.rngState,
    riverEdges,
    lakeHexId: lakeHexId && assembled.board.hexes[lakeHexId] ? lakeHexId : null,
    fishingGrounds,
  };
}

function findLakeHex(board: BoardState): HexId | null {
  for (const id of board.hexIds) {
    if (board.hexes[id]?.terrain === 'lake') return id;
  }
  return null;
}

function resolveFishingGrounds(
  defs: FishingGroundDef[],
  board: BoardState,
): FishingGround[] {
  const out: FishingGround[] = [];
  for (const def of defs) {
    const hex = board.hexes[`${def.q},${def.r}`];
    if (!hex) continue;
    const vertex = hex.corners[def.corner];
    if (!vertex) continue;
    out.push({ vertex, token: def.token });
  }
  return out;
}

function pickLayout(scenario: TradersScenario, numPlayers: number) {
  if (numPlayers === 3 || numPlayers === 4) return scenario.layout3p ?? null;
  return null;
}

// Resolve declarative river-edge tuples (hex coord + direction) into actual
// EdgeId strings against the freshly built board. Mirrors `resolvePorts`.
// Dedupes inverse-declared edges (an edge can be named from either of the
// two hexes it spans).
function resolveRiverEdges(
  refs: ScenarioEdgeRef[],
  board: BoardState,
): EdgeId[] {
  const out = new Set<EdgeId>();
  for (const ref of refs) {
    const hexId = `${ref.q},${ref.r}`;
    const hex = board.hexes[hexId];
    if (!hex) continue;
    const v1 = hex.corners[ref.direction];
    const v2 = hex.corners[(ref.direction + 1) % 6];
    if (!v1 || !v2) continue;
    for (const edge of Object.values(board.edges)) {
      if (
        (edge.vertices[0] === v1 && edge.vertices[1] === v2) ||
        (edge.vertices[0] === v2 && edge.vertices[1] === v1)
      ) {
        out.add(edge.id);
        break;
      }
    }
  }
  return Array.from(out);
}
