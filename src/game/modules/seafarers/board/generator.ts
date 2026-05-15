import type {
  BoardState,
  Hex,
  HexId,
  Port,
} from '../../../types';
import type { IslandChip } from '../../../types';
import { buildGraphFromCoords, type BaseGraph } from '../../../board/graph';
import { getScenario } from './scenarios';
import { identifyIslands } from './islands';

export interface SeafarersBoardResult {
  board: BoardState;
  rngState: number;
  islandChips: IslandChip[];
}

// Build a Seafarers BoardState from a scenario id. When `numPlayers >= 5`
// and the scenario declares a `hexes5_6` variant, the larger 5-6 player
// layout is used. Falls back to the 3-4 layout otherwise.
export function generateSeafarersBoard(
  scenarioId: string | undefined,
  rngState: number,
  numPlayers = 3,
): SeafarersBoardResult {
  const scenario = getScenario(scenarioId);
  const useLarge = numPlayers >= 5 && scenario.hexes5_6;
  const hexDefs = useLarge ? scenario.hexes5_6! : scenario.hexes;
  const portDefs = useLarge && scenario.ports5_6 ? scenario.ports5_6 : scenario.ports;
  const coords = hexDefs.map((h) => ({ q: h.q, r: h.r }));
  const graph = buildGraphFromCoords(coords);

  const hexes: Record<HexId, Hex> = {};
  let robberHex: HexId | null = null;
  let pirateHex: HexId | null = null;

  // Map scenario defs onto the graph hex ids.
  const defByKey = new Map(hexDefs.map((h) => [`${h.q},${h.r}`, h]));

  for (const hexId of graph.hexIds) {
    const coord = graph.hexCoords.get(hexId)!;
    const key = `${coord.q},${coord.r}`;
    const def = defByKey.get(key)!;
    const corners = graph.hexCorners.get(hexId)!;
    const center = hexCenter(graph, corners);
    hexes[hexId] = {
      id: hexId,
      coord,
      terrain: def.terrain,
      numberToken: def.token,
      corners,
      center,
    };
    if (def.terrain === 'desert' && robberHex === null) robberHex = hexId;
    if (def.terrain === 'sea' && pirateHex === null) pirateHex = hexId;
  }

  // Fallbacks: scenarios with no desert place the robber on any non-sea hex
  // outside play (we'd never use it, but the engine requires a HexId).
  if (robberHex === null) {
    robberHex = graph.hexIds.find((id) => hexes[id]!.terrain !== 'sea') ?? graph.hexIds[0]!;
  }
  if (pirateHex === null) {
    pirateHex = graph.hexIds.find((id) => hexes[id]!.terrain === 'sea') ?? graph.hexIds[0]!;
  }

  const ports = resolvePorts(portDefs, graph);

  // Identify islands so the rendering layer can highlight them and so the
  // settlement-handler intercept (phase 6) can award the right chip.
  const partialBoard: BoardState = {
    hexes,
    vertices: graph.vertices,
    edges: graph.edges,
    ports,
    robberHex,
    hexIds: graph.hexIds,
    vertexIds: graph.vertexIds,
    edgeIds: graph.edgeIds,
    pirateHex,
    islandOfHex: {},
  };
  const islands = identifyIslands(partialBoard);
  partialBoard.islandOfHex = islands.hexToIsland;

  const islandChips: IslandChip[] = islands.outerIslandIds.map((id) => ({
    islandId: id,
    vp: scenario.islandBonusVp?.[id] ?? scenario.defaultIslandBonusVp,
    firstSettler: null,
  }));

  return { board: partialBoard, rngState, islandChips };
}

function hexCenter(
  graph: BaseGraph,
  corners: ReturnType<BaseGraph['hexCorners']['get']> & {},
): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  for (const vid of corners) {
    cx += graph.vertices[vid]!.position.x;
    cy += graph.vertices[vid]!.position.y;
  }
  cx /= corners.length;
  cy /= corners.length;
  return { x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100 };
}

// Resolve a port anchor (q, r, direction) to an actual edge id. Direction 0
// is the upper-right edge (between corners 0 and 1) clockwise around a
// pointy-top hex. We look up the edge by finding the two corners (i, i+1) of
// the anchor hex.
function resolvePorts(
  portDefs: { q: number; r: number; direction: number; type: Port['type'] }[],
  graph: BaseGraph,
): Port[] {
  const out: Port[] = [];
  for (const p of portDefs) {
    const hexId = `${p.q},${p.r}`;
    const corners = graph.hexCorners.get(hexId);
    if (!corners) continue;
    const v1 = corners[p.direction]!;
    const v2 = corners[(p.direction + 1) % 6]!;
    const edge = Object.values(graph.edges).find(
      (e) =>
        (e.vertices[0] === v1 && e.vertices[1] === v2) ||
        (e.vertices[0] === v2 && e.vertices[1] === v1),
    );
    if (!edge) continue;
    out.push({ edge: edge.id, type: p.type });
  }
  // Dedupe in case two anchors resolved to the same edge.
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.edge) ? false : (seen.add(p.edge), true)));
}
