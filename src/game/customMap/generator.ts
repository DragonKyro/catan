import type { BoardState, HexId, IslandChip } from '../types';
import { assembleBoardFromLayout } from '../board/scenarioAssembly';
import { identifyIslands } from '../modules/seafarers/board/islands';
import type { CustomMap } from './types';

export interface CustomMapBoardResult {
  board: BoardState;
  rngState: number;
  // Populated only when `map.seafarers` is true.
  islandChips: IslandChip[];
  unrevealedFogHexes: HexId[];
}

// Build a BoardState from a user-authored custom map. Drives the same
// modular layout machinery every shipped scenario already uses, then layers
// on Seafarers extras (islands, fog) when the map opts in.
export function generateCustomMapBoard(
  map: CustomMap,
  rngState: number,
): CustomMapBoardResult {
  const assembled = assembleBoardFromLayout(map.layout, rngState);
  const board = assembled.board;

  let islandChips: IslandChip[] = [];
  const unrevealedFogHexes: HexId[] = [];

  if (map.seafarers) {
    // Guarantee a pirate hex exists (the Seafarers engine assumes it).
    if (!board.pirateHex) {
      board.pirateHex =
        board.hexIds.find((id) => board.hexes[id]!.terrain === 'sea') ??
        board.hexIds[0]!;
    }
    board.islandOfHex = {};
    const islands = identifyIslands(board, { desertIsBoundary: false });
    board.islandOfHex = islands.hexToIsland;
    // 2 VP per outer-island chip — same default the Seafarers builder uses
    // for scenarios that don't override it.
    islandChips = islands.outerIslandIds.map((id) => ({
      islandId: id,
      vp: 2,
      firstSettler: null,
    }));

    for (const f of map.fogHexes) {
      const hexId = `${f.q},${f.r}`;
      if (board.hexes[hexId]) unrevealedFogHexes.push(hexId);
    }
  }

  return {
    board,
    rngState: assembled.rngState,
    islandChips,
    unrevealedFogHexes,
  };
}
