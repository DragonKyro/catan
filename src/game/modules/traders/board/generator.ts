import type { BoardState, EdgeId } from '../../../types';
import { assembleBoardFromLayout } from '../../../board/scenarioAssembly';
import { getTradersScenario } from './scenarios';
import type { TradersScenario, ScenarioEdgeRef } from './scenarios/types';

export interface TradersBoardResult {
  board: BoardState;
  rngState: number;
  // Concrete river-edge ids (bridge sites). Roads forbidden here at the
  // engine level — see placement.ts and the buildBridge handler.
  riverEdges: EdgeId[];
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
  return {
    board: assembled.board,
    rngState: assembled.rngState,
    riverEdges,
  };
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
