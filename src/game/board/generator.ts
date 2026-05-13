import type {
  BoardState,
  Hex,
  HexId,
  Port,
  PortType,
  Terrain,
  EdgeId,
  Vertex,
} from '../types';
import { buildBaseGraph, type BaseGraph } from './graph';
import { shuffle } from '../rng';

const TERRAIN_DISTRIBUTION: Terrain[] = [
  'wood', 'wood', 'wood', 'wood',
  'brick', 'brick', 'brick',
  'sheep', 'sheep', 'sheep', 'sheep',
  'wheat', 'wheat', 'wheat', 'wheat',
  'ore', 'ore', 'ore',
  'desert',
];

const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

const PORT_TYPES: PortType[] = [
  'generic', 'generic', 'generic', 'generic',
  'wood', 'brick', 'sheep', 'wheat', 'ore',
];

const NUM_PORTS = 9;
const MAX_NUMBER_PLACEMENT_ATTEMPTS = 200;

export function generateBoard(rngState: number): { board: BoardState; rngState: number } {
  const graph = buildBaseGraph();
  let rng = rngState;

  // 1. Assign terrains
  let terrains: Terrain[];
  [terrains, rng] = shuffle(rng, TERRAIN_DISTRIBUTION);
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
    if (terrain === 'desert') robberHex = id;
  });
  if (robberHex === null) throw new Error('No desert hex generated');

  // 2. Assign number tokens, retrying if 6/8 are adjacent
  const nonDesertHexes = graph.hexIds.filter((id) => hexes[id]!.terrain !== 'desert');
  const hexAdj = buildHexAdjacencyFromGraph(graph);

  let placed = false;
  for (let attempt = 0; attempt < MAX_NUMBER_PLACEMENT_ATTEMPTS; attempt++) {
    let tokens: number[];
    [tokens, rng] = shuffle(rng, NUMBER_TOKENS);
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
    [tokens, rng] = shuffle(rng, NUMBER_TOKENS);
    nonDesertHexes.forEach((id, i) => (hexes[id]!.numberToken = tokens[i]!));
  }

  // 3. Place ports on coastal edges
  const coastalEdges = graph.edgeIds.filter((eid) => graph.edges[eid]!.hexes.length === 1);
  const sortedCoastal = sortCoastalEdgesByAngle(coastalEdges, graph.vertices, graph.edges);
  const portEdges = pickEvenlySpaced(sortedCoastal, NUM_PORTS);

  let portTypes: PortType[];
  [portTypes, rng] = shuffle(rng, PORT_TYPES);
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
