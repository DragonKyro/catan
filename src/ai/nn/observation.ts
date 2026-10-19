// Catan learned agent — what one seat is allowed to know, as agent input.
//
// `observe(state, viewerId, knowledge)` is the ONLY place the learned-agent
// pipeline reads GameState; the encoder (and the action decoder to come) take
// a CatanObservation, so a policy built on them can't see anything a real
// player in that seat couldn't.
//
//   visible   the whole board (terrain, numbers, ports, robber, every
//             building and road), the bank, the dev deck's size, hand sizes,
//             dev-card counts, public VP, knights and other dev cards played,
//             Longest Road / Largest Army, this turn's roll and flags, any
//             trade offer on the table.
//   own       the viewer's hand, its dev cards (incl. VP cards and those
//             bought this turn), its true VP.
//   inferred  from knowledge.ts: every dice roll so far, and per opponent
//             what their hand can be (card counting through hidden steals).
//   hidden    opponents' actual resources and dev cards, the deck order, the
//             RNG. Opponents' resources are read only as hand-size totals.
//
// Players are listed by seat offset from the viewer in turn order:
// 0 = viewer, 1 = the next seat to play after the viewer, and so on.
//
// Only the base game is in scope (`supportsNeuralAi`); expansions and Fun
// Maps keep the heuristic AI.

import type {
  BoardState, DevCardType, EdgeId, GamePhase, GameSettings, GameState, HexId, PlayerId, PortType, Resource,
  ResourceBank, VertexId,
} from '@/game/types';
import { RESOURCES } from '@/game/types';
import { isPairedPlayer2 } from '@/game/helpers';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { calculateLongestRoad } from '@/game/scoring/longestRoad';
import { boardIndex, type BoardIndex } from './board';
import {
  DEV_TYPES, PLAYABLE_DEV, estimateHands, type CatanKnowledge, type HandEstimate, type PlayableDev,
} from './knowledge';

/** Rule sets the learned agent is trained for: the base game on the standard board, any player count. */
export function supportsNeuralAi(settings: GameSettings): boolean {
  return settings.expansions.length === 0
    && (settings.baseScenarioId ?? 'standard') === 'standard'
    && !settings.customMap
    && !settings.tradersVariants?.friendlyRobber
    && !settings.tradersVariants?.strongestPorts;
}

export type DevCounts = Record<DevCardType, number>;

export interface ObservedPlayer {
  id: PlayerId;
  /** Seats after the viewer in turn order (0 = the viewer). */
  offset: number;
  handSize: number;
  /** The viewer's own hand; null for opponents. */
  hand: ResourceBank | null;
  /** What the viewer can infer about this hand (exact for the viewer). */
  estimate: HandEstimate;
  /** Dev cards held, any type (VP cards included) — the count is public. */
  devCardCount: number;
  /** The viewer's own dev cards; null for opponents. */
  devCards: { playable: DevCounts; boughtThisTurn: DevCounts; victoryPoints: number } | null;
  /** Dev cards played face-up so far. */
  played: Record<PlayableDev, number>;
  devBought: number;
  publicVp: number;
  /** The viewer's own VP including hidden VP cards; null for opponents. */
  trueVp: number | null;
  settlements: VertexId[];
  cities: VertexId[];
  roads: EdgeId[];
  ports: PortType[];
  longestRoad: number;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
}

/** A multi-part answer in progress, carried between policy calls (never game
 *  state): discards one card at a time, the robber's hex before its victim,
 *  Road Building's edges one at a time. */
export interface CatanDraft {
  discard?: Partial<ResourceBank>;
  robberHex?: HexId;
  roadBuilding?: EdgeId[];
}

/** What the viewer has to decide right now. */
export type CatanDecision =
  | { type: 'setupSettlement'; round: 1 | 2 }
  | { type: 'setupRoad'; round: 1 | 2; settlement: VertexId }
  /** Start of turn: roll, or play a knight first. */
  | { type: 'roll'; canKnight: boolean }
  | { type: 'main'; canPlayDev: boolean; playerTrades: boolean }
  /** Discard `required` cards in all, one at a time; `chosen` so far. */
  | { type: 'discard'; required: number; chosen: ResourceBank }
  | { type: 'robberHex'; reason: 'sevenRoll' | 'knight' }
  /** Robber placed on `hex`: steal from one of these seats (offsets). */
  | { type: 'robberVictim'; hex: HexId; candidates: number[] }
  /** Road Building: `placed` edges so far (0 or 1). */
  | { type: 'roadBuilding'; placed: EdgeId[] }
  /** Accept / reject an offer. `give` / `get` are from the viewer's side.
   *  `counter`: the viewer is the turn player answering a counter-offer. */
  | { type: 'tradeResponse'; proposerOffset: number; give: ResourceBank; get: ResourceBank; counter: boolean };

export interface CatanObservation {
  viewerId: PlayerId;
  playerCount: number;
  boardVariant: '3-4' | '5-6' | '7-8';
  vpToWin: number;
  /** Entirely public. */
  board: BoardState;
  index: BoardIndex;
  bank: ResourceBank;
  /** Starting count of each resource in the bank. */
  bankSize: number;
  devDeckSize: number;
  /** The starting dev deck's make-up. */
  devDeckTotals: DevCounts;
  /** Dev cards the viewer hasn't seen: still in the deck or in opponents' hands. */
  unseenDev: DevCounts;
  /** Every dice total rolled so far, in order. */
  rolls: number[];
  /** This turn's roll, once rolled. */
  lastRoll: number | null;
  players: ObservedPlayer[];
  phase: GamePhase;
  /** Offset of the seat whose turn it is (and of the 5+ player turn holder). */
  currentOffset: number;
  turnHolderOffset: number;
  hasRolled: boolean;
  hasPlayedDevCard: boolean;
  pairedPlayer2: boolean;
  tradesProposedThisTurn: number;
  pendingTrade: { proposerOffset: number; give: ResourceBank; receive: ResourceBank; rejectedBy: number[] } | null;
  /** Resources the viewer has given / received by trade this turn. */
  tradedThisTurn: { given: Resource[]; received: Resource[] };
  /** Offers the viewer has already made this turn. */
  offeredThisTurn: Array<{ give: ResourceBank; receive: ResourceBank }>;
  largestArmy: { holderOffset: number; size: number } | null;
  longestRoad: { holderOffset: number; length: number } | null;
  decision: CatanDecision | null;
}

export interface ObserveOptions {
  draft?: CatanDraft | null;
}

const bank = (b: Partial<ResourceBank> = {}): ResourceBank => ({
  wood: b.wood ?? 0, brick: b.brick ?? 0, sheep: b.sheep ?? 0, wheat: b.wheat ?? 0, ore: b.ore ?? 0,
});
const devCounts = (cards: readonly DevCardType[] = []): DevCounts => {
  const out: DevCounts = { knight: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0, victoryPoint: 0 };
  for (const c of cards) out[c] += 1;
  return out;
};
const handTotal = (b: ResourceBank) => RESOURCES.reduce((s, r) => s + b[r], 0);

export function observe(
  state: GameState,
  viewerId: PlayerId,
  knowledge: CatanKnowledge,
  opts: ObserveOptions = {},
): CatanObservation {
  if (knowledge.viewerId !== viewerId) throw new Error(`observe: knowledge belongs to ${knowledge.viewerId}, not ${viewerId}`);
  const n = state.players.length;
  const order = state.playerOrder;
  const viewerPos = order.indexOf(viewerId);
  if (viewerPos === -1) throw new Error(`observe: ${viewerId} is not seated`);
  const offsetOf = (id: PlayerId) => (order.indexOf(id) - viewerPos + n) % n;
  const estimates = estimateHands(knowledge);

  const players: ObservedPlayer[] = [];
  for (let off = 0; off < n; off++) {
    const id = order[(viewerPos + off) % n]!;
    const p = state.players.find((x) => x.id === id)!;
    const seat = knowledge.playerIds.indexOf(id);
    const mine = off === 0;
    const dc = p.devCards;
    players.push({
      id,
      offset: off,
      handSize: handTotal(p.resources),
      hand: mine ? bank(p.resources) : null,
      estimate: estimates[seat]!,
      devCardCount: dc.unplayed.length + dc.boughtThisTurn.length + dc.victoryPoints,
      devCards: mine
        ? { playable: devCounts(dc.unplayed), boughtThisTurn: devCounts(dc.boughtThisTurn), victoryPoints: dc.victoryPoints }
        : null,
      played: { ...knowledge.devPlayed[seat]! },
      devBought: knowledge.devBought[seat]!,
      publicVp: calculateVictoryPoints(state, id, false),
      trueVp: mine ? calculateVictoryPoints(state, id, true) : null,
      settlements: p.settlements.slice(),
      cities: p.cities.slice(),
      roads: p.roads.slice(),
      ports: p.ports.slice(),
      longestRoad: calculateLongestRoad(state, id),
      hasLongestRoad: p.hasLongestRoad,
      hasLargestArmy: p.hasLargestArmy,
    });
  }

  // Unseen dev cards: the starting deck minus every card played face-up and
  // every card the viewer holds.
  const unseenDev: DevCounts = { ...knowledge.devDeckTotals };
  for (const p of players) for (const c of PLAYABLE_DEV) unseenDev[c] -= p.played[c];
  const me = players[0]!;
  for (const c of DEV_TYPES) {
    unseenDev[c] -= me.devCards!.playable[c] + me.devCards!.boughtThisTurn[c];
  }
  unseenDev.victoryPoint -= me.devCards!.victoryPoints;

  const pt = state.pendingTrade;
  const turnHolder = order[state.turnHolderIndex ?? state.currentPlayerIndex]!;
  const traded = state.tradeResourcesThisTurn?.[viewerId];
  return {
    viewerId,
    playerCount: n,
    boardVariant: state.boardVariant ?? '3-4',
    vpToWin: state.settings.victoryPointsToWin,
    board: state.board,
    index: boardIndex(state.board),
    bank: bank(state.bank),
    // Cards are conserved, so bank + every hand is the starting bank.
    bankSize: (handTotal(state.bank) + players.reduce((s, p) => s + p.handSize, 0)) / RESOURCES.length,
    devDeckSize: state.devCardDeck.length,
    devDeckTotals: { ...knowledge.devDeckTotals },
    unseenDev,
    rolls: knowledge.rolls.slice(),
    lastRoll: state.hasRolledThisTurn && state.lastRoll ? state.lastRoll.total : null,
    players,
    phase: state.phase,
    currentOffset: offsetOf(order[state.currentPlayerIndex]!),
    turnHolderOffset: offsetOf(turnHolder),
    hasRolled: state.hasRolledThisTurn,
    hasPlayedDevCard: state.hasPlayedDevCardThisTurn,
    pairedPlayer2: isPairedPlayer2(state),
    tradesProposedThisTurn: state.tradesProposedThisTurn,
    pendingTrade: pt
      ? { proposerOffset: offsetOf(pt.proposerId), give: bank(pt.give), receive: bank(pt.receive), rejectedBy: pt.rejectedBy.map(offsetOf) }
      : null,
    tradedThisTurn: { given: traded?.given.slice() ?? [], received: traded?.received.slice() ?? [] },
    offeredThisTurn: (state.proposedTradesThisTurn?.[viewerId] ?? []).map((t) => ({ give: bank(t.give), receive: bank(t.receive) })),
    largestArmy: state.largestArmy ? { holderOffset: offsetOf(state.largestArmy.holder), size: state.largestArmy.size } : null,
    longestRoad: state.longestRoad ? { holderOffset: offsetOf(state.longestRoad.holder), length: state.longestRoad.length } : null,
    decision: decisionFor(state, viewerId, offsetOf, opts.draft ?? null),
  };
}

function decisionFor(
  state: GameState,
  viewerId: PlayerId,
  offsetOf: (id: PlayerId) => number,
  draft: CatanDraft | null,
): CatanDecision | null {
  const acting = state.playerOrder[state.currentPlayerIndex]!;
  const viewer = state.players.find((p) => p.id === viewerId)!;
  switch (state.phase) {
    case 'setupRound1':
    case 'setupRound2': {
      if (acting !== viewerId || !state.setupState) return null;
      const round = state.phase === 'setupRound1' ? 1 : 2;
      if (state.setupState.step === 'settlement') return { type: 'setupSettlement', round };
      return { type: 'setupRoad', round, settlement: state.setupState.lastPlacedSettlement! };
    }
    case 'rollOrPlayKnight':
      if (acting !== viewerId) return null;
      return { type: 'roll', canKnight: !state.hasPlayedDevCardThisTurn && viewer.devCards.unplayed.includes('knight') };
    case 'discard': {
      const required = state.discardState?.required[viewerId];
      if (required === undefined) return null;
      return { type: 'discard', required, chosen: bank(draft?.discard) };
    }
    case 'moveRobber': {
      if (acting !== viewerId) return null;
      const hex = draft?.robberHex;
      if (!hex) return { type: 'robberHex', reason: state.pendingRobberMove?.reason === 'knight' ? 'knight' : 'sevenRoll' };
      const corners = state.board.hexes[hex]!.corners;
      const candidates = state.players
        .filter((p) => p.id !== viewerId && handTotal(p.resources) > 0
          && corners.some((v) => p.settlements.includes(v) || p.cities.includes(v)))
        .map((p) => offsetOf(p.id))
        .sort((a, b) => a - b);
      return { type: 'robberVictim', hex, candidates };
    }
    case 'main': {
      const pt = state.pendingTrade;
      if (pt) {
        if (pt.proposerId === viewerId) return null; // waiting on answers
        const answer = { proposerOffset: offsetOf(pt.proposerId), give: bank(pt.receive), get: bank(pt.give) };
        // A counter-offer is answered by the turn player alone.
        if (pt.proposerId !== acting) return acting === viewerId ? { type: 'tradeResponse', ...answer, counter: true } : null;
        if (pt.rejectedBy.includes(viewerId)) return null;
        return { type: 'tradeResponse', ...answer, counter: false };
      }
      if (acting !== viewerId) return null;
      if (draft?.roadBuilding) return { type: 'roadBuilding', placed: draft.roadBuilding.slice() };
      return { type: 'main', canPlayDev: !state.hasPlayedDevCardThisTurn, playerTrades: !isPairedPlayer2(state) };
    }
    default:
      return null;
  }
}
