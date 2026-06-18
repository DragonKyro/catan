import type { BoardState, HexId, IslandChip } from '../types';
import { assembleBoardFromLayout } from '../board/scenarioAssembly';
import { injectFogPools } from '../board/fogPoolInjection';
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
  // When the map declares fog, fog cells get their terrain + token from a
  // SEPARATE pool. We materialise that pool here (using the seeded RNG so
  // every peer agrees) and inject the result onto the layout as pinned
  // `fixedTerrain` / `fixedToken` values — the regular materializer then
  // skips those cells from the main pool.
  let rng = rngState;
  let workingLayout = map.layout;
  if (map.seafarers && map.fogPools && map.fogHexes.length > 0) {
    const result = injectFogPools(map.layout, map.fogHexes, map.fogPools, rng);
    workingLayout = result.layout;
    rng = result.rngState;
  }

  const assembled = assembleBoardFromLayout(workingLayout, rng);
  const board = assembled.board;
  rng = assembled.rngState;

  let islandChips: IslandChip[] = [];
  const unrevealedFogHexes: HexId[] = [];

  if (map.seafarers) {
    if (!board.pirateHex) {
      board.pirateHex =
        board.hexIds.find((id) => board.hexes[id]!.terrain === 'sea') ??
        board.hexIds[0]!;
    }
    board.islandOfHex = {};
    const islands = identifyIslands(board, { desertIsBoundary: false });
    board.islandOfHex = islands.hexToIsland;
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
    rngState: rng,
    islandChips,
    unrevealedFogHexes,
  };
}

