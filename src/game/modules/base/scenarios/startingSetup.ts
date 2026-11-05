import type {
  BoardState,
  EdgeId,
  Player,
  PlayerId,
  Resource,
  ResourceBank,
  VertexId,
} from '../../../types';
import { RESOURCES } from '../../../types';
import { edgeKey } from '../../../board/coords';
import { getPortAtVertex } from '../../../board/adjacency';
import { addResources, subtractResources } from '../../../resources';
import { pickOne } from '../../../rng';
import type { HexCornerRef, HexSideRef, StartingSetup, StartingSlot } from './types';

// Fixed starting pieces for the beginner boards (`BaseScenario.startingSetup`).
// createGame calls `placeStartingPieces` instead of running the placement
// rounds; the game then starts at the first roll.

export function cornerVertex(board: BoardState, ref: HexCornerRef): VertexId {
  const hex = board.hexes[`${ref.q},${ref.r}`];
  const v = hex?.corners[ref.corner];
  if (!v || !board.vertices[v]) throw new Error(`Starting set-up: no corner ${ref.q},${ref.r}/${ref.corner}`);
  return v;
}

export function sideEdge(board: BoardState, ref: HexSideRef): EdgeId {
  const hex = board.hexes[`${ref.q},${ref.r}`];
  const a = hex?.corners[ref.direction];
  const b = hex?.corners[(ref.direction + 1) % 6];
  const e = a && b ? edgeKey(a, b) : undefined;
  if (!e || !board.edges[e]) throw new Error(`Starting set-up: no side ${ref.q},${ref.r}/${ref.direction}`);
  return e;
}

export interface SeatedSlots {
  // Each seat's slot.
  bySeat: Record<PlayerId, StartingSlot>;
  // 5 players on the 5-6 board: the color nobody plays.
  inactive: StartingSlot | null;
  rngState: number;
}

// Which color slot each seat plays. A player whose chosen color is a slot's
// color sits there (so the board looks like the rulebook picture); the
// others take the remaining slots in turn order. 3 players drop
// `dropAt3`; 5 players leave one slot, drawn at random from the unclaimed
// ones, inactive (CATAN 5-6 rules p.5).
export function seatStartingSlots(
  setup: StartingSetup,
  players: readonly Pick<Player, 'id' | 'color'>[],
  playerOrder: readonly PlayerId[],
  rngState: number,
): SeatedSlots {
  const n = playerOrder.length;
  let slots = (n <= 4 ? setup.slots3_4 : setup.slots5_6) ?? [];
  if (n === 3 && setup.dropAt3) slots = slots.filter((s) => s.label !== setup.dropAt3);
  const spare = slots.length - n;
  if (spare !== 0 && !(spare === 1 && n >= 5)) {
    throw new Error(`This starting set-up has no layout for ${n} players.`);
  }

  const bySeat: Record<PlayerId, StartingSlot> = {};
  const claimed = new Set<StartingSlot>();
  for (const id of playerOrder) {
    const color = players.find((p) => p.id === id)?.color;
    const match = slots.find((s) => s.color === color && !claimed.has(s));
    if (match) {
      bySeat[id] = match;
      claimed.add(match);
    }
  }
  let rng = rngState;
  let inactive: StartingSlot | null = null;
  if (spare === 1) {
    [inactive, rng] = pickOne(rng, slots.filter((s) => !claimed.has(s)));
  }
  const free = slots.filter((s) => s !== inactive && !claimed.has(s));
  for (const id of playerOrder) {
    if (!bySeat[id]) bySeat[id] = free.shift()!;
  }
  return { bySeat, inactive, rngState: rng };
}

export interface StartingPiecesResult {
  players: Player[];
  bank: ResourceBank;
  rngState: number;
  // The inactive color's settlements (5 players), empty otherwise.
  inactiveSettlements: VertexId[];
}

// Place every seat's two settlements and two roads, note the harbors they
// stand on, and pay one resource per hex around the starred settlement.
export function placeStartingPieces(
  setup: StartingSetup,
  board: BoardState,
  players: readonly Player[],
  playerOrder: readonly PlayerId[],
  bank: ResourceBank,
  rngState: number,
): StartingPiecesResult {
  const seated = seatStartingSlots(setup, players, playerOrder, rngState);
  let nextBank = bank;
  const placed = players.map((p) => {
    const slot = seated.bySeat[p.id];
    if (!slot) return p;
    const settlements = slot.pieces.map((x) => cornerVertex(board, x.settlement));
    const roads = slot.pieces.map((x) => sideEdge(board, x.road));
    const ports = [...p.ports];
    for (const v of settlements) {
      const port = getPortAtVertex(board, v);
      if (port && !ports.includes(port)) ports.push(port);
    }
    const grants: Partial<Record<Resource, number>> = {};
    for (const h of board.vertices[settlements[slot.star]!]!.hexes) {
      const t = board.hexes[h]!.terrain;
      if ((RESOURCES as readonly string[]).includes(t)) {
        grants[t as Resource] = (grants[t as Resource] ?? 0) + 1;
      }
    }
    nextBank = subtractResources(nextBank, grants);
    return {
      ...p,
      settlements: [...p.settlements, ...settlements],
      roads: [...p.roads, ...roads],
      ports,
      resources: addResources(p.resources, grants),
    };
  });
  const inactiveSettlements = seated.inactive
    ? seated.inactive.pieces.map((x) => cornerVertex(board, x.settlement))
    : [];
  return { players: placed, bank: nextBank, rngState: seated.rngState, inactiveSettlements };
}
