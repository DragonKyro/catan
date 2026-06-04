import type { BoardState } from '../../../types';
import { assembleBoardFromLayout } from '../../../board/scenarioAssembly';
import { getBaseScenario } from './index';
import type { BaseScenario } from './types';
import type { ScenarioLayout } from '../../../board/scenarioTypes';

export interface BaseScenarioBoardResult {
  board: BoardState;
  rngState: number;
  // Volcano scenario only — the volcano hex id, ready to be stamped onto
  // BoardState. null for non-volcano scenarios.
  volcanoHexId: string | null;
}

// Build a base-game BoardState from a scenario id. Routes through the same
// modular layout machinery as the Seafarers generator, then layers on any
// base-scenario-specific instantiation (currently just Volcano).
//
// Returns the `null` volcanoHexId for scenarios that don't have a volcano so
// the caller can blindly assign without conditionals.
export function generateBaseScenarioBoard(
  scenarioId: string,
  rngState: number,
  numPlayers = 3,
): BaseScenarioBoardResult {
  const scenario = getBaseScenario(scenarioId);
  const layout = pickLayout(scenario, numPlayers);
  if (!layout) {
    throw new Error(
      `Base scenario "${scenario.id}" has no layout for ${numPlayers} players`,
    );
  }
  const assembled = assembleBoardFromLayout(layout, rngState);

  let volcanoHexId: string | null = null;
  if (scenario.volcano) {
    const id = `${scenario.volcano.q},${scenario.volcano.r}`;
    if (assembled.board.hexes[id]) {
      volcanoHexId = id;
      assembled.board.volcanoHex = id;
    }
  }

  return {
    board: assembled.board,
    rngState: assembled.rngState,
    volcanoHexId,
  };
}

function pickLayout(scenario: BaseScenario, numPlayers: number): ScenarioLayout | null {
  if (numPlayers >= 5) return scenario.layout5_6p ?? null;
  if (numPlayers === 4) return scenario.layout4p ?? scenario.layout3p ?? null;
  return scenario.layout3p ?? null;
}
