import type {
  BoardState,
  Hex,
  HexId,
  HexCoord,
  Port,
  PortType,
  Terrain,
  EdgeId,
  Vertex,
} from '../types';
import { buildBaseGraph, buildGraphFromCoords, type BaseGraph } from './graph';
import { shuffle } from '../rng';

export type BoardVariant = '3-4' | '5-6';

const TERRAIN_DISTRIBUTION_BASE: Terrain[] = [
  'wood', 'wood', 'wood', 'wood',
  'brick', 'brick', 'brick',
  'sheep', 'sheep', 'sheep', 'sheep',
  'wheat', 'wheat', 'wheat', 'wheat',
  'ore', 'ore', 'ore',
  'desert',
];

const NUMBER_TOKENS_BASE = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

const PORT_TYPES_BASE: PortType[] = [
  'generic', 'generic', 'generic', 'generic',
  'wood', 'brick', 'sheep', 'wheat', 'ore',
];

const NUM_PORTS_BASE = 9;

// 5-6 player expansion: 30 hexes (vs 19), 28 number tokens, 11 ports.
// Terrain: 6 wood, 5 brick, 6 sheep, 6 wheat, 5 ore, 2 desert.
const TERRAIN_DISTRIBUTION_5_6: Terrain[] = [
  'wood', 'wood', 'wood', 'wood', 'wood', 'wood',
  'brick', 'brick', 'brick', 'brick', 'brick',
  'sheep', 'sheep', 'sheep', 'sheep', 'sheep', 'sheep',
  'wheat', 'wheat', 'wheat', 'wheat', 'wheat', 'wheat',
  'ore', 'ore', 'ore', 'ore', 'ore',
  'desert', 'desert',
];

const NUMBER_TOKENS_5_6 = [
  2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6,
  8, 8, 8, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12,
];

const PORT_TYPES_5_6: PortType[] = [
  'generic', 'generic', 'generic', 'generic', 'generic',
  'wood', 'brick', 'sheep', 'wheat', 'ore', 'wheat',
];

const NUM_PORTS_5_6 = 11;

// 30-hex symmetric hexagon: rows 3-4-5-6-5-4-3 = 30. Each row's q-range
// is chosen so the row's cartesian center sits at the same x as every
// other row (x_center ∝ q_center + r/2 = -0.5 here), giving the board
// horizontal mirror symmetry across r=0.
function buildCoords5_6(): HexCoord[] {
  const out: HexCoord[] = [];
  const rows: Array<[number, number, number]> = [
    [-3, 0, 2],
    [-2, -1, 2],
    [-1, -2, 2],
    [0, -3, 2],
    [1, -3, 1],
    [2, -3, 0],
    [3, -3, -1],
  ];
  for (const [r, qMin, qMax] of rows) {
    for (let q = qMin; q <= qMax; q++) out.push({ q, r });
  }
  return out;
}

const MAX_NUMBER_PLACEMENT_ATTEMPTS = 200;

export function generateBoard(
  rngState: number,
  variant: BoardVariant = '3-4',
): { board: BoardState; rngState: number } {
  const graph =
    variant === '5-6' ? buildGraphFromCoords(buildCoords5_6()) : buildBaseGraph();
  const terrainDistribution =
    variant === '5-6' ? TERRAIN_DISTRIBUTION_5_6 : TERRAIN_DISTRIBUTION_BASE;
  const numberTokensSource =
    variant === '5-6' ? NUMBER_TOKENS_5_6 : NUMBER_TOKENS_BASE;
  const portTypesSource =
    variant === '5-6' ? PORT_TYPES_5_6 : PORT_TYPES_BASE;
  const numPorts = variant === '5-6' ? NUM_PORTS_5_6 : NUM_PORTS_BASE;
  let rng = rngState;

  // 1. Assign terrains
  let terrains: Terrain[];
  [terrains, rng] = shuffle(rng, terrainDistribution);
  const hexes: Record<HexId, Hex> = {};
  let robberHex: HexId | null = null;
  graph.hexIds.forEach((id, i) => {
    const terrain = terrains[i]!;
    const corners = graph.hexCorners.get(id)!;
    let cx = 0;
    let cy = 0;
    for (const vid of corners) {
      cx += graph.vertices[vid]!.position.x;
      cy += graph.vertices[vid]!.position.y;
    }
    cx /= corners.length;
    cy /= corners.length;
    hexes[id] = {
      id,
      coord: graph.hexCoords.get(id)!,
      terrain,
      numberToken: null,
      corners,
      center: { x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100 },
    };
    // For multi-desert boards (5-6p), put the robber on the first desert
    // encountered — players move it on the first 7 anyway.
    if (terrain === 'desert' && robberHex === null) robberHex = id;
  });
  if (robberHex === null) throw new Error('No desert hex generated');

  // 2. Assign number tokens, retrying if 6/8 are adjacent
  const nonDesertHexes = graph.hexIds.filter((id) => hexes[id]!.terrain !== 'desert');
  const hexAdj = buildHexAdjacencyFromGraph(graph);

  let placed = false;
  for (let attempt = 0; attempt < MAX_NUMBER_PLACEMENT_ATTEMPTS; attempt++) {
    let tokens: number[];
    [tokens, rng] = shuffle(rng, numberTokensSource);
    const proposed = new Map<HexId, number>();
    nonDesertHexes.forEach((id, i) => proposed.set(id, tokens[i]!));

    if (!hasAdjacentSixOrEight(proposed, hexAdj)) {
      for (const id of nonDesertHexes) hexes[id]!.numberToken = proposed.get(id)!;
      placed = true;
      break;
    }
  }
  if (!placed) {
    // Fallback: accept whatever we have on the final attempt — extremely unlikely
    let tokens: number[];
    [tokens, rng] = shuffle(rng, numberTokensSource);
    nonDesertHexes.forEach((id, i) => (hexes[id]!.numberToken = tokens[i]!));
  }

  // 3. Place ports on coastal edges
  const coastalEdges = graph.edgeIds.filter((eid) => graph.edges[eid]!.hexes.length === 1);
  const sortedCoastal = sortCoastalEdgesByAngle(coastalEdges, graph.vertices, graph.edges);
  const portEdges = pickEvenlySpaced(sortedCoastal, numPorts);

  let portTypes: PortType[];
  [portTypes, rng] = shuffle(rng, portTypesSource);
  const ports: Port[] = portEdges.map((edge, i) => ({ edge, type: portTypes[i]! }));

  const board: BoardState = {
    hexes,
    vertices: graph.vertices,
    edges: graph.edges,
    ports,
    robberHex: robberHex!,
    hexIds: graph.hexIds,
    vertexIds: graph.vertexIds,
    edgeIds: graph.edgeIds,
  };

  return { board, rngState: rng };
}

function buildHexAdjacencyFromGraph(graph: BaseGraph): Map<HexId, HexId[]> {
  const adj = new Map<HexId, Set<HexId>>();
  for (const h of graph.hexIds) adj.set(h, new Set());
  for (const e of Object.values(graph.edges)) {
    if (e.hexes.length === 2) {
      const [h1, h2] = e.hexes;
      adj.get(h1!)!.add(h2!);
      adj.get(h2!)!.add(h1!);
    }
  }
  const out = new Map<HexId, HexId[]>();
  for (const [k, v] of adj) out.set(k, [...v]);
  return out;
}

function hasAdjacentSixOrEight(
  proposed: Map<HexId, number>,
  hexAdj: Map<HexId, HexId[]>,
): boolean {
  for (const [hexId, token] of proposed) {
    if (token !== 6 && token !== 8) continue;
    for (const neighbor of hexAdj.get(hexId) ?? []) {
      const n = proposed.get(neighbor);
      if (n === 6 || n === 8) return true;
    }
  }
  return false;
}

function sortCoastalEdgesByAngle(
  edges: EdgeId[],
  vertices: Record<string, Vertex>,
  edgeMap: Record<EdgeId, { vertices: [string, string] }>,
): EdgeId[] {
  return edges.slice().sort((a, b) => angleOf(a) - angleOf(b));

  function angleOf(eid: EdgeId): number {
    const [v1, v2] = edgeMap[eid]!.vertices;
    const p1 = vertices[v1]!.position;
    const p2 = vertices[v2]!.position;
    return Math.atan2((p1.y + p2.y) / 2, (p1.x + p2.x) / 2);
  }
}

function pickEvenlySpaced<T>(items: T[], n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor((i * items.length) / n);
    out.push(items[idx]!);
  }
  return out;
}
