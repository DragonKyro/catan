import type { BoardState, HexId } from '../../../types';

// Identify connected land components on the board. Two hexes are connected
// when they share an edge and both have non-sea terrain.
//
// Returns:
//   - hexToIsland: every land hex mapped to a stable island id ("island-0",
//     "island-1", ...). Sea hexes are absent from the map.
//   - mainIslandId: the id of the largest component; this island never
//     receives a settlement bonus chip.
export interface IslandAnalysis {
  hexToIsland: Record<HexId, string>;
  mainIslandId: string;
  outerIslandIds: string[];
}

export function identifyIslands(board: BoardState): IslandAnalysis {
  const hexToIsland: Record<HexId, string> = {};
  const islandSizes = new Map<string, number>();
  let counter = 0;

  // Build hex-to-hex adjacency from edges (any shared edge means adjacent).
  const adj = new Map<HexId, HexId[]>();
  for (const id of board.hexIds) adj.set(id, []);
  for (const edge of Object.values(board.edges)) {
    if (edge.hexes.length === 2) {
      const [a, b] = edge.hexes;
      adj.get(a!)!.push(b!);
      adj.get(b!)!.push(a!);
    }
  }

  for (const hexId of board.hexIds) {
    if (hexToIsland[hexId]) continue;
    if (board.hexes[hexId]!.terrain === 'sea') continue;

    const islandId = `island-${counter++}`;
    const stack = [hexId];
    let size = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      if (hexToIsland[cur]) continue;
      if (board.hexes[cur]!.terrain === 'sea') continue;
      hexToIsland[cur] = islandId;
      size++;
      for (const n of adj.get(cur) ?? []) {
        if (!hexToIsland[n] && board.hexes[n]!.terrain !== 'sea') stack.push(n);
      }
    }
    islandSizes.set(islandId, size);
  }

  let mainIslandId = '';
  let maxSize = -1;
  for (const [id, size] of islandSizes) {
    if (size > maxSize) {
      maxSize = size;
      mainIslandId = id;
    }
  }

  const outerIslandIds = [...islandSizes.keys()].filter((id) => id !== mainIslandId);

  return { hexToIsland, mainIslandId, outerIslandIds };
}
