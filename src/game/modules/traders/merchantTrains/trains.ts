import type {
  BoardState,
  EdgeId,
  GameState,
  HexId,
  MerchantTrain,
  TradeWagon,
  VertexId,
  WagonPlacement,
  WagonStartPoint,
} from '../../../types';

// Merchant Trains (2025 rulebook p. 13-14): trains of wagons leave the
// watering hole from three start corners (NW, NE, S — never N, SE, SW), the
// first wagon on the edge leading away from the hex. A wagon goes on an edge
// without a wagon (roads are fine) and either starts a new train on a free
// start edge or is added nose-to-tail at the front of a train. Trains never
// branch. A train's front reaching an intersection already on another
// train: meeting that train's front, the two merge and one train goes on
// from there; meeting any other part of a train, the arriving train ends.
// A train also ends when its front can't be extended.

const START_LABELS = ['NW', 'NE', 'S'] as const;

// Every watering hole: one at 3-4 players (`state.wateringHoleHexId`), two
// at 5-6 (`state.wateringHoleHexIds`; "six locations for starting a
// merchant train, three at each watering hole", T&B 5-6 p. 7).
export function wateringHoles(
  state: Pick<GameState, 'wateringHoleHexId' | 'wateringHoleHexIds'>,
): HexId[] {
  if (state.wateringHoleHexIds && state.wateringHoleHexIds.length > 0) {
    return state.wateringHoleHexIds;
  }
  return state.wateringHoleHexId ? [state.wateringHoleHexId] : [];
}

// The start points of several watering holes, in hole order.
export function resolveAllWagonStarts(board: BoardState, holes: HexId[]): WagonStartPoint[] {
  return holes.flatMap((h) => resolveWagonStarts(board, h));
}

// The three start points of the watering hole, found geometrically from
// the hex's corners (pixel y grows downward). Each corner has one edge that
// isn't a side of the watering hole: the start edge, leading away from it.
export function resolveWagonStarts(
  board: BoardState,
  wateringHoleHexId: HexId,
): WagonStartPoint[] {
  const hex = board.hexes[wateringHoleHexId];
  if (!hex) return [];
  const out: WagonStartPoint[] = [];
  for (const label of START_LABELS) {
    const corner = hex.corners.find((vid) => {
      const v = board.vertices[vid];
      if (!v) return false;
      return cornerLabel(v.position, hex.center) === label;
    });
    if (!corner) continue;
    const v = board.vertices[corner]!;
    const edge = v.edges.find(
      (eid) => !board.edges[eid]!.hexes.includes(wateringHoleHexId),
    );
    if (!edge) continue;
    const e = board.edges[edge]!;
    const head = e.vertices[0] === corner ? e.vertices[1] : e.vertices[0];
    out.push({ label, corner, edge, head });
  }
  return out;
}

// Which corner of a pointy-top hex a vertex is: N / S straight above /
// below the centre, the other four to the sides.
function cornerLabel(
  p: { x: number; y: number },
  c: { x: number; y: number },
): 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW' {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  if (Math.abs(dx) < 1e-3 * Math.max(1, Math.abs(dy))) return dy < 0 ? 'N' : 'S';
  if (dx > 0) return dy < 0 ? 'NE' : 'SE';
  return dy < 0 ? 'NW' : 'SW';
}

function otherEnd(board: BoardState, edgeId: EdgeId, from: VertexId): VertexId {
  const e = board.edges[edgeId]!;
  return e.vertices[0] === from ? e.vertices[1] : e.vertices[0];
}

// Wagons go where roads could: an edge of at least one land hex.
function edgeOnLand(state: GameState, edgeId: EdgeId): boolean {
  const e = state.board.edges[edgeId];
  if (!e) return false;
  return e.hexes.some((h) => {
    const t = state.board.hexes[h]?.terrain;
    return t !== undefined && t !== 'sea';
  });
}

function wagonEdges(state: GameState): Set<EdgeId> {
  return new Set((state.wagons ?? []).map((w) => w.edge));
}

// Free edges a train's front could take next.
function openEdgesAt(
  state: GameState,
  vertex: VertexId,
  occupied: Set<EdgeId>,
): EdgeId[] {
  const v = state.board.vertices[vertex];
  if (!v) return [];
  return v.edges.filter((eid) => !occupied.has(eid) && edgeOnLand(state, eid));
}

// Every legal place for the next wagon: free start edges (a new train) and
// the free edges at the front of every train still running. Empty when the
// supply is out or the scenario isn't Merchant Trains.
export function legalWagonPlacements(state: GameState): WagonPlacement[] {
  if (!state.wateringHoleHexId) return [];
  if ((state.wagonSupply ?? 0) <= 0) return [];
  const occupied = wagonEdges(state);
  const out: WagonPlacement[] = [];
  for (const s of state.wagonStarts ?? []) {
    if (!occupied.has(s.edge)) out.push({ edge: s.edge, train: null });
  }
  for (const t of state.merchantTrains ?? []) {
    if (t.ended) continue;
    for (const eid of openEdgesAt(state, t.head, occupied)) {
      out.push({ edge: eid, train: t.id });
    }
  }
  return out;
}

export function samePlacement(a: WagonPlacement, b: WagonPlacement): boolean {
  return a.edge === b.edge && a.train === b.train;
}

export function placementKey(p: WagonPlacement): string {
  return `${p.edge}|${p.train ?? 'new'}`;
}

export function isLegalWagonPlacement(
  state: GameState,
  p: WagonPlacement,
): boolean {
  return legalWagonPlacements(state).some((q) => samePlacement(p, q));
}

// The intersection a placement's wagon would face.
export function placementFront(
  state: GameState,
  p: WagonPlacement,
): VertexId | null {
  if (p.train === null) {
    return (state.wagonStarts ?? []).find((s) => s.edge === p.edge)?.head ?? null;
  }
  const t = (state.merchantTrains ?? []).find((x) => x.id === p.train);
  if (!t || !state.board.edges[p.edge]) return null;
  return otherEnd(state.board, p.edge, t.head);
}

// Put a wagon down (no legality check — callers check first) and update the
// trains: merges, trains that ran into another one, and fronts left without
// a free edge. Draws the wagon from the supply.
export function applyWagonPlacement(
  state: GameState,
  p: WagonPlacement,
): GameState {
  const board = state.board;
  let trains: MerchantTrain[] = [...(state.merchantTrains ?? [])];
  let trainId: number;
  let head: VertexId;
  if (p.train === null) {
    const start = (state.wagonStarts ?? []).find((s) => s.edge === p.edge);
    if (!start) throw new Error('Not a merchant-train start edge');
    trainId = trains.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    head = start.head;
    trains.push({ id: trainId, start: start.corner, head, ended: false });
  } else {
    const t = trains.find((x) => x.id === p.train);
    if (!t) throw new Error('Unknown merchant train');
    trainId = t.id;
    head = otherEnd(board, p.edge, t.head);
    trains = trains.map((x) => (x.id === trainId ? { ...x, head } : x));
  }
  const placed: TradeWagon = { edge: p.edge, front: head, train: trainId };
  const wagons: TradeWagon[] = [...(state.wagons ?? []), placed];

  // Did the front run into another train at `head`?
  const headEdges = new Set(board.vertices[head]?.edges ?? []);
  const touching = wagons.filter((w) => w !== placed && headEdges.has(w.edge));
  if (touching.length > 0) {
    const met = trains.find(
      (u) => u.id !== trainId && !u.ended && u.head === head,
    );
    // Head to head (and nothing else there): merge — the other train goes
    // on from this intersection. Anything else (another train's middle or
    // tail, or this train's own wagons): the arriving train ends.
    const onlyThatFront =
      met !== undefined &&
      touching.every((w) => w.train === met.id && w.front === head);
    trains = trains.map((x) =>
      x.id === trainId
        ? { ...x, ended: true, ...(onlyThatFront ? { mergedInto: met!.id } : {}) }
        : x,
    );
  }

  // Trains whose front has no free edge left are finished.
  const occupied = new Set(wagons.map((w) => w.edge));
  const next: GameState = {
    ...state,
    wagons,
    wagonSupply: Math.max(0, (state.wagonSupply ?? 0) - 1),
  };
  trains = trains.map((t) =>
    !t.ended && openEdgesAt(next, t.head, occupied).length === 0
      ? { ...t, ended: true }
      : t,
  );
  return { ...next, merchantTrains: trains };
}

// Short human label for a placement ("new train (NW)", "train 2").
export function placementLabel(state: GameState, p: WagonPlacement): string {
  if (p.train === null) {
    const s = (state.wagonStarts ?? []).find((x) => x.edge === p.edge);
    // Two watering holes (5-6): say which one.
    const holes = wateringHoles(state);
    if (s && holes.length > 1) {
      const hole = holes.find((h) => state.board.hexes[h]?.corners.includes(s.corner));
      const ys = holes.map((h) => state.board.hexes[h]?.center.y ?? 0);
      const y = hole ? state.board.hexes[hole]?.center.y ?? 0 : 0;
      const where = y <= Math.min(...ys) ? 'upper hole' : 'lower hole';
      return `new train (${where}, ${s.label})`;
    }
    return `new train (${s?.label ?? '?'})`;
  }
  return `train ${p.train}`;
}

// Letter tags for the current legal placements (A, B, C …), in the order
// legalWagonPlacements lists them. Shared by the board ghosts, the voting
// dialog and the log so "location C" means the same thing everywhere.
export function placementTags(
  state: GameState,
): Array<{ placement: WagonPlacement; tag: string }> {
  return legalWagonPlacements(state).map((placement, i) => ({
    placement,
    tag: tagFor(i),
  }));
}

function tagFor(i: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return i < letters.length ? letters[i]! : `${letters[i % 26]}${Math.floor(i / 26)}`;
}
