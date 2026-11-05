import type {
  BoardState,
  CommodityLocationId,
  Edge,
  EdgeId,
  HexId,
  Vertex,
  VertexId,
} from '../../../types';
import { edgeKey, vertexKey } from '../../../board/coords';
import type { TradersBarbariansDef } from '../board/scenarios/types';

// Board facts the T&B generator resolves for the Traders & Barbarians
// scenario.
export interface TradersBarbariansBoardSetup {
  locations: Array<{
    id: CommodityLocationId;
    hex: HexId;
    plaza: VertexId;
    paths: EdgeId[];
    xEdges: EdgeId[];
  }>;
  // The barbarians' start edges.
  barbarians: EdgeId[];
  // Commodity-hex corners between two "X" edges: no road can ever leave
  // them (their third edge is open sea), so no starting settlement goes
  // there either — it could take no starting road.
  setupBlocked: VertexId[];
}

// Add each commodity hex's centre plaza and its 4 interior paths to the
// board graph, as ordinary vertices / edges, and resolve the "X" edges and
// the barbarians' start edges.
//
// The plaza is a vertex at the hex centre with `hexes: []` — it is no
// hex's corner, so it has no adjacent land and `hasSettleableLand` already
// refuses a settlement there ("You may not build a settlement in the center
// of a commodity hex"). Each path is an edge corner → plaza lying on the
// commodity hex (`hexes: [hex]`), so the normal road rules (connect to your
// road / building, not past a rival's building) and road rendering apply
// unchanged. Corners gain the path as an extra edge and the plaza as a
// neighbour; the distance rule is unaffected since nobody builds there.
export function resolveTradersBarbariansBoard(
  def: TradersBarbariansDef,
  input: BoardState,
): { board: BoardState; setup: TradersBarbariansBoardSetup } {
  const vertices: Record<VertexId, Vertex> = { ...input.vertices };
  const edges: Record<EdgeId, Edge> = { ...input.edges };
  const vertexIds = [...input.vertexIds];
  const edgeIds = [...input.edgeIds];
  const touchedVertices = new Set<VertexId>();
  const locations: TradersBarbariansBoardSetup['locations'] = [];
  const setupBlocked: VertexId[] = [];

  for (const loc of def.locations) {
    const hexId = `${loc.q},${loc.r}`;
    const hex = input.hexes[hexId];
    if (!hex) throw new Error(`Traders & Barbarians: no hex at ${hexId}`);
    const plaza = vertexKey(hex.center);
    if (vertices[plaza]) throw new Error(`Traders & Barbarians: plaza ${plaza} already exists`);
    vertices[plaza] = {
      id: plaza,
      position: { x: hex.center.x, y: hex.center.y },
      hexes: [],
      edges: [],
      neighborVertices: [],
    };
    vertexIds.push(plaza);
    touchedVertices.add(plaza);
    const paths: EdgeId[] = [];
    for (const c of loc.pathCorners) {
      const corner = hex.corners[c];
      if (!corner) throw new Error(`Traders & Barbarians: ${hexId} has no corner ${c}`);
      const id = edgeKey(corner, plaza);
      const sorted: [VertexId, VertexId] = corner < plaza ? [corner, plaza] : [plaza, corner];
      edges[id] = { id, vertices: sorted, hexes: [hexId], neighborEdges: [] };
      edgeIds.push(id);
      paths.push(id);
      vertices[corner] = {
        ...vertices[corner]!,
        edges: [...vertices[corner]!.edges, id],
        neighborVertices: [...vertices[corner]!.neighborVertices, plaza],
      };
      vertices[plaza] = {
        ...vertices[plaza]!,
        edges: [...vertices[plaza]!.edges, id],
        neighborVertices: [...vertices[plaza]!.neighborVertices, corner],
      };
      touchedVertices.add(corner);
    }
    const xEdges = loc.xEdges.map((d) => {
      const id = edgeKey(hex.corners[d]!, hex.corners[(d + 1) % 6]!);
      if (!edges[id]) throw new Error(`Traders & Barbarians: ${hexId} has no edge ${d}`);
      return id;
    });
    for (let c = 0; c < 6; c++) {
      // Corner c lies between edge c - 1 (corners c-1..c) and edge c (c..c+1).
      if (loc.xEdges.includes(c as 0) && loc.xEdges.includes(((c + 5) % 6) as 0)) {
        setupBlocked.push(hex.corners[c]!);
      }
    }
    locations.push({ id: loc.id, hex: hexId, plaza, paths, xEdges });
  }

  // Edges sharing a vertex with a new path gain it as a neighbour.
  for (const v of touchedVertices) {
    for (const eid of vertices[v]!.edges) {
      const e = edges[eid]!;
      const near = new Set<EdgeId>();
      for (const end of e.vertices) {
        for (const other of vertices[end]!.edges) if (other !== eid) near.add(other);
      }
      edges[eid] = { ...e, neighborEdges: [...near] };
    }
  }

  const barbarians = def.barbarians.map(([a, b]) => {
    const ha = input.hexes[`${a.q},${a.r}`];
    const hb = input.hexes[`${b.q},${b.r}`];
    if (!ha || !hb) throw new Error('Traders & Barbarians: barbarian hex missing');
    const common = ha.corners.filter((v) => hb.corners.includes(v));
    if (common.length !== 2) throw new Error('Traders & Barbarians: barbarian hexes are not neighbours');
    return edgeKey(common[0]!, common[1]!);
  });

  return {
    board: { ...input, vertices, edges, vertexIds, edgeIds },
    setup: { locations, barbarians, setupBlocked },
  };
}
