import type {
  BoardState,
  CastleState,
  EdgeId,
  FishingGround,
  HexId,
} from '../../../types';
import { assembleBoardFromLayout } from '../../../board/scenarioAssembly';
import { getTradersScenario } from './scenarios';
import type {
  TradersScenario,
  ScenarioEdgeRef,
  FishingGroundDef,
  BarbarianCastleDef,
} from './scenarios/types';
import { BARBARIAN_BASE_STRENGTH } from '../constants';

export interface TradersBoardResult {
  board: BoardState;
  rngState: number;
  // Concrete river-edge ids (bridge sites). Roads forbidden here at the
  // engine level — see placement.ts and the buildBridge handler.
  riverEdges: EdgeId[];
  // Fishing on Catan extras. Both undefined for Rivers / future scenarios
  // that don't use them.
  lakeHexId: HexId | null;
  fishingGrounds: FishingGround[];
  // Merchant Trains: the watering hole hex id (origin of every train).
  // null when the scenario doesn't have one.
  wateringHoleHexId: HexId | null;
  // Barbarian Attack: resolved castle states with concrete barbarian
  // paths. Empty array when the scenario doesn't have castles.
  castles: CastleState[];
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
  const lakeHexId = scenario.lake
    ? `${scenario.lake.q},${scenario.lake.r}`
    : findHexByTerrain(assembled.board, 'lake');
  const fishingGrounds = resolveFishingGrounds(
    scenario.fishingGrounds ?? [],
    assembled.board,
  );
  const wateringHoleHexId = scenario.wateringHole
    ? `${scenario.wateringHole.q},${scenario.wateringHole.r}`
    : findHexByTerrain(assembled.board, 'wateringHole');
  const castles = resolveCastles(scenario.castles ?? [], assembled.board);
  // Fishing on Catan: the robber starts off-board. We can't represent
  // "no robber hex" in BoardState, so we keep robberHex pointing at the
  // lake (or whatever the assembly picked) and rely on `state.robberActive`
  // to flag whether the robber is on the board. createGame wires this.
  return {
    board: assembled.board,
    rngState: assembled.rngState,
    riverEdges,
    lakeHexId: lakeHexId && assembled.board.hexes[lakeHexId] ? lakeHexId : null,
    fishingGrounds,
    wateringHoleHexId:
      wateringHoleHexId && assembled.board.hexes[wateringHoleHexId]
        ? wateringHoleHexId
        : null,
    castles,
  };
}

function findHexByTerrain(
  board: BoardState,
  terrain: BoardState['hexes'][string]['terrain'],
): HexId | null {
  for (const id of board.hexIds) {
    if (board.hexes[id]?.terrain === terrain) return id;
  }
  return null;
}

function resolveFishingGrounds(
  defs: FishingGroundDef[],
  board: BoardState,
): FishingGround[] {
  const out: FishingGround[] = [];
  for (const def of defs) {
    const hex = board.hexes[`${def.q},${def.r}`];
    if (!hex) continue;
    const vertex = hex.corners[def.corner];
    if (!vertex) continue;
    out.push({ vertex, token: def.token });
  }
  return out;
}

function pickLayout(scenario: TradersScenario, numPlayers: number) {
  if (numPlayers === 3 || numPlayers === 4) return scenario.layout3p ?? null;
  return null;
}

// Resolve declarative castle definitions into runtime `CastleState`s by
// BFS-walking through the sea ring from the castle hex to the declared
// `pathStart`. Sea is the only traversable terrain in the middle of the
// path; the castle hex itself is allowed as the start (it's the final
// path entry when reversed).
function resolveCastles(
  defs: BarbarianCastleDef[],
  board: BoardState,
): CastleState[] {
  const out: CastleState[] = [];
  for (const def of defs) {
    const castleHexId = `${def.castle.q},${def.castle.r}`;
    const startHexId = `${def.pathStart.q},${def.pathStart.r}`;
    if (!board.hexes[castleHexId] || !board.hexes[startHexId]) continue;
    const path = bfsHexPath(board, castleHexId, startHexId);
    if (!path) continue;
    out.push({
      id: def.id,
      hexId: castleHexId,
      barbarianPath: path,
      barbarianPosition: 0,
      barbarianStrength: def.strength ?? BARBARIAN_BASE_STRENGTH,
      defenderVp: {},
    });
  }
  return out;
}

// BFS from `castle` outward over sea hexes (castle is allowed only as the
// starting cell, not as an intermediate). Returns the path with `start` as
// the FIRST entry and `castle` as the LAST entry — i.e. the order the
// barbarian walks. Returns null when no path exists.
function bfsHexPath(
  board: BoardState,
  castleHexId: HexId,
  startHexId: HexId,
): HexId[] | null {
  type Node = { hexId: HexId; parent: Node | null };
  const visited = new Set<HexId>([castleHexId]);
  const root: Node = { hexId: castleHexId, parent: null };
  const queue: Node[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    if (node.hexId === startHexId) {
      // Reconstruct path castle -> start, then reverse to start -> castle.
      const back: HexId[] = [];
      let cur: Node | null = node;
      while (cur) {
        back.push(cur.hexId);
        cur = cur.parent;
      }
      return back; // [start, ..., castle]
    }
    for (const neighborId of axialNeighbors(node.hexId)) {
      if (visited.has(neighborId)) continue;
      const hex = board.hexes[neighborId];
      if (!hex) continue;
      // Intermediate hexes must be sea. The start hex (which is the BFS
      // target) is checked explicitly above before this terrain gate.
      if (neighborId !== startHexId && hex.terrain !== 'sea') continue;
      visited.add(neighborId);
      queue.push({ hexId: neighborId, parent: node });
    }
  }
  return null;
}

// Six axial neighbours of (q, r). Returns hex-id strings (the board uses
// `${q},${r}` as its hex id).
function axialNeighbors(hexId: HexId): HexId[] {
  const [qStr, rStr] = hexId.split(',');
  const q = Number(qStr);
  const r = Number(rStr);
  return [
    `${q + 1},${r}`,
    `${q - 1},${r}`,
    `${q},${r + 1}`,
    `${q},${r - 1}`,
    `${q + 1},${r - 1}`,
    `${q - 1},${r + 1}`,
  ];
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
