import type { BoardState, Hex, HexId, Port } from '../types';
import { buildGraphFromCoords, type BaseGraph } from './graph';
import { materializeLayout } from './layoutMaterializer';
import type {
  ScenarioHexDef,
  ScenarioLayout,
  ScenarioPortDef,
} from './scenarioTypes';

// Shared scenario→BoardState assembly. Both the Seafarers generator and the
// base-game Fun Maps generator call this to turn a ScenarioLayout (or already-
// materialized defs) into a populated BoardState. Expansion-specific extras
// (islandChips, tribeTokens, fog, pirate fleet, cloth, wonders, volcano) are
// layered on by the calling generator after this returns.

export interface AssembleResult {
  board: BoardState;
  rngState: number;
  hexDefs: ScenarioHexDef[];
}

// Assemble a board from a ScenarioLayout: materialize pools, build the hex
// graph, place hexes/ports/robber/pirate.
export function assembleBoardFromLayout(
  layout: ScenarioLayout,
  rngState: number,
): AssembleResult {
  const m = materializeLayout(layout, rngState);
  return assembleBoardFromDefs(
    m.hexDefs,
    m.portDefs,
    { robberHint: layout.robberStart, pirateHint: layout.pirateStart },
    m.rngState,
  );
}

// Same as above but starting from already-materialized defs (used by the
// legacy fixed-content Seafarers scenarios that still ship per-hex blueprints).
export function assembleBoardFromDefs(
  hexDefs: ScenarioHexDef[],
  portDefs: ScenarioPortDef[],
  options: {
    robberHint?: { q: number; r: number };
    pirateHint?: { q: number; r: number };
  },
  rngState: number,
): AssembleResult {
  const coords = hexDefs.map((h) => ({ q: h.q, r: h.r }));
  const graph = buildGraphFromCoords(coords);

  const hexes: Record<HexId, Hex> = {};
  let robberHex: HexId | null = null;
  let pirateHex: HexId | null = null;
  const defByKey = new Map(hexDefs.map((h) => [`${h.q},${h.r}`, h]));

  for (const hexId of graph.hexIds) {
    const coord = graph.hexCoords.get(hexId)!;
    const def = defByKey.get(`${coord.q},${coord.r}`)!;
    const corners = graph.hexCorners.get(hexId)!;
    hexes[hexId] = {
      id: hexId,
      coord,
      terrain: def.terrain,
      numberToken: def.token,
      corners,
      center: hexCenter(graph, corners),
    };
    if (def.terrain === 'desert' && robberHex === null) robberHex = hexId;
    if (def.terrain === 'sea' && pirateHex === null) pirateHex = hexId;
  }

  if (options.robberHint) {
    const id = `${options.robberHint.q},${options.robberHint.r}`;
    if (hexes[id]) robberHex = id;
  }
  if (options.pirateHint) {
    const id = `${options.pirateHint.q},${options.pirateHint.r}`;
    if (hexes[id]) pirateHex = id;
  }

  // Fallbacks: ensure robberHex is always set (engine invariant). pirateHex
  // stays null when there's no sea — the caller decides whether to keep it
  // as undefined on the BoardState (base game) or fall back (Seafarers).
  if (robberHex === null) {
    robberHex =
      graph.hexIds.find((id) => hexes[id]!.terrain !== 'sea') ?? graph.hexIds[0]!;
  }

  const ports = resolvePorts(portDefs, graph);

  const board: BoardState = {
    hexes,
    vertices: graph.vertices,
    edges: graph.edges,
    ports,
    robberHex,
    hexIds: graph.hexIds,
    vertexIds: graph.vertexIds,
    edgeIds: graph.edgeIds,
  };
  if (pirateHex !== null) board.pirateHex = pirateHex;

  return { board, rngState, hexDefs };
}

export function hexCenter(
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
// pointy-top hex.
export function resolvePorts(
  portDefs: ScenarioPortDef[],
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
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.edge) ? false : (seen.add(p.edge), true)));
}
