import type {
  GameState,
  BankTradeAction,
  ProposeTradeAction,
  AcceptTradeAction,
  CancelTradeAction,
  CounterTradeAction,
  RejectTradeAction,
  PlayerId,
  Resource,
  ResourceBank,
} from '../types';
import { RESOURCES } from '../types';
import { currentPlayerId, updatePlayer, getPlayer, isPairedPlayer2 } from '../helpers';
import { addResources, subtractResources } from '../resources';

export function getBankTradeRate(state: GameState, playerId: string, give: Resource): number {
  const player = getPlayer(state, playerId);
  let rate = 4;
  if (player.ports.includes(give)) rate = 2;
  else if (player.ports.includes('generic')) rate = 3;
  // Forgotten Tribe: commercial harbor tokens unconditionally cap the rate
  // at 2:1 for any resource — better than a generic port, equal to a
  // matching 2:1 port.
  if ((player.commercialHarbors ?? 0) > 0) rate = Math.min(rate, 2);
  // C&K Merchant token: 2:1 on the resource the merchant's hex produces.
  if (state.merchant?.ownerId === playerId) {
    const hex = state.board.hexes[state.merchant.hexId];
    if (hex && hex.terrain === give) rate = Math.min(rate, 2);
  }
  // C&K Merchant Fleet card (this turn only): 2:1 on the chosen item.
  if (
    state.merchantFleetActive?.kind === 'resource' &&
    state.merchantFleetActive.which === give
  ) {
    rate = Math.min(rate, 2);
  }
  return rate;
}

export function handleBankTrade(state: GameState, action: BankTradeAction): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot trade in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (action.give === action.receive) throw new Error('Cannot trade resource for itself');
  const count = action.count ?? 1;
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Trade count must be a positive integer');
  }

  const player = getPlayer(state, action.playerId);
  const rate = getBankTradeRate(state, action.playerId, action.give);
  const totalGive = rate * count;
  if (player.resources[action.give] < totalGive) {
    throw new Error(`Need ${totalGive} ${action.give} to trade for ${count}`);
  }
  if (state.bank[action.receive] < count) {
    throw new Error(`Bank does not have ${count} ${action.receive}`);
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: addResources(
      subtractResources(p.resources, { [action.give]: totalGive }),
      { [action.receive]: count },
    ),
  }));
  next = {
    ...next,
    bank: addResources(subtractResources(next.bank, { [action.receive]: count }), {
      [action.give]: totalGive,
    }),
  };
  next = recordTradeResources(next, action.playerId, [action.give], [action.receive]);
  return next;
}

// Add `given` and `received` resources to the actor's per-turn trade log,
// deduping so we keep these as set-like arrays. The AI uses this to skip
// reverse trades (don't give what you just received).
function recordTradeResources(
  state: GameState,
  playerId: PlayerId,
  given: Resource[],
  received: Resource[],
): GameState {
  const log = { ...(state.tradeResourcesThisTurn ?? {}) };
  const existing = log[playerId] ?? { given: [], received: [] };
  const mergedGiven = [...existing.given];
  for (const r of given) {
    if (!mergedGiven.includes(r)) mergedGiven.push(r);
  }
  const mergedReceived = [...existing.received];
  for (const r of received) {
    if (!mergedReceived.includes(r)) mergedReceived.push(r);
  }
  log[playerId] = { given: mergedGiven, received: mergedReceived };
  return { ...state, tradeResourcesThisTurn: log };
}

// === Player-to-player trade ===

function totalOf(partial: Partial<ResourceBank>): number {
  let t = 0;
  for (const r of RESOURCES) t += partial[r] ?? 0;
  return t;
}

function hasAll(bank: ResourceBank, demand: Partial<ResourceBank>): boolean {
  for (const r of RESOURCES) {
    if ((demand[r] ?? 0) > bank[r]) return false;
  }
  return true;
}

export function handleProposeTrade(
  state: GameState,
  action: ProposeTradeAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot propose trade in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) {
    throw new Error('Only the current player can propose a trade');
  }
  // 5+ player paired-player rule: Player 2 may only trade with the supply.
  if (isPairedPlayer2(state)) {
    throw new Error('Player 2 may only trade with the supply, not other players');
  }
  if (state.pendingTrade) {
    throw new Error('A trade is already pending — cancel it first');
  }
  if (totalOf(action.give) === 0 || totalOf(action.receive) === 0) {
    throw new Error('Trade must have something on both sides');
  }
  const player = getPlayer(state, action.playerId);
  if (!hasAll(player.resources, action.give)) {
    throw new Error("You don't have the resources you're offering");
  }
  // Record the trade shape in proposedTradesThisTurn so the AI doesn't
  // re-propose the same {give, receive} after a rejection — opponents'
  // hands didn't change, so the second attempt would just stall the turn.
  const priorProposed = state.proposedTradesThisTurn?.[action.playerId] ?? [];
  const nextProposed: Record<
    PlayerId,
    Array<{ give: Partial<ResourceBank>; receive: Partial<ResourceBank> }>
  > = { ...(state.proposedTradesThisTurn ?? {}) };
  nextProposed[action.playerId] = [
    ...priorProposed,
    { give: { ...action.give }, receive: { ...action.receive } },
  ];
  return {
    ...state,
    pendingTrade: {
      proposerId: action.playerId,
      give: { ...action.give },
      receive: { ...action.receive },
      rejectedBy: [],
    },
    tradesProposedThisTurn: state.tradesProposedThisTurn + 1,
    proposedTradesThisTurn: nextProposed,
  };
}

export function handleAcceptTrade(
  state: GameState,
  action: AcceptTradeAction,
): GameState {
  if (!state.pendingTrade) throw new Error('No trade to accept');
  if (action.playerId === state.pendingTrade.proposerId) {
    throw new Error("You can't accept your own trade");
  }
  // 5+ player paired-player rule: Player 2 may only trade with the supply.
  // P2 can't be the acceptor of a player trade. (P1's pending offer was
  // also cleared on the P1→P2 handoff, but guard anyway in case a stale
  // offer survives some other path.)
  if (isPairedPlayer2(state) && action.playerId === currentPlayerId(state)) {
    throw new Error('Player 2 may only trade with the supply, not other players');
  }
  const acceptor = getPlayer(state, action.playerId);
  const proposer = getPlayer(state, state.pendingTrade.proposerId);
  if (!hasAll(acceptor.resources, state.pendingTrade.receive)) {
    throw new Error("You don't have the resources the proposer wants");
  }
  if (!hasAll(proposer.resources, state.pendingTrade.give)) {
    throw new Error('The proposer no longer has the offered resources');
  }
  let next: GameState = updatePlayer(state, proposer.id, (p) => ({
    ...p,
    resources: addResources(
      subtractResources(p.resources, state.pendingTrade!.give),
      state.pendingTrade!.receive,
    ),
  }));
  next = updatePlayer(next, acceptor.id, (p) => ({
    ...p,
    resources: addResources(
      subtractResources(p.resources, state.pendingTrade!.receive),
      state.pendingTrade!.give,
    ),
  }));
  // Record resources moved for both sides so the AI can detect (and avoid)
  // reverse / roundabout trades on its next move.
  const trade = state.pendingTrade;
  const proposerGave = (Object.keys(trade.give) as Resource[]).filter(
    (r) => (trade.give[r] ?? 0) > 0,
  );
  const proposerGot = (Object.keys(trade.receive) as Resource[]).filter(
    (r) => (trade.receive[r] ?? 0) > 0,
  );
  next = recordTradeResources(next, proposer.id, proposerGave, proposerGot);
  next = recordTradeResources(next, acceptor.id, proposerGot, proposerGave);
  return { ...next, pendingTrade: undefined };
}

export function handleCancelTrade(
  state: GameState,
  action: CancelTradeAction,
): GameState {
  if (!state.pendingTrade) throw new Error('No trade to cancel');
  const isProposer = action.playerId === state.pendingTrade.proposerId;
  const isCurrent = action.playerId === currentPlayerId(state);
  // Either the proposer of the current pending trade or the active turn
  // player may cancel. The latter matters after a counter: the original
  // proposer is no longer `proposerId`, but they should still be able to
  // walk away from the negotiation.
  if (!isProposer && !isCurrent) {
    throw new Error('Only the proposer or current player can cancel');
  }
  return { ...state, pendingTrade: undefined };
}

export function handleRejectTrade(
  state: GameState,
  action: RejectTradeAction,
): GameState {
  if (!state.pendingTrade) throw new Error('No trade to reject');
  if (action.playerId === state.pendingTrade.proposerId) {
    throw new Error("You can't reject your own trade");
  }
  if (state.pendingTrade.rejectedBy.includes(action.playerId)) return state;
  const newRejected = [...state.pendingTrade.rejectedBy, action.playerId];
  // Auto-cancel once every non-proposer has rejected — no point keeping the
  // pending trade alive when nobody can/will accept.
  const others = state.players.filter(
    (p) => p.id !== state.pendingTrade!.proposerId,
  );
  if (others.every((p) => newRejected.includes(p.id))) {
    return { ...state, pendingTrade: undefined };
  }
  return {
    ...state,
    pendingTrade: { ...state.pendingTrade, rejectedBy: newRejected },
  };
}

export function handleCounterTrade(
  state: GameState,
  action: CounterTradeAction,
): GameState {
  if (state.phase !== 'main') {
    throw new Error(`Cannot counter in phase ${state.phase}`);
  }
  if (!state.pendingTrade) throw new Error('No trade to counter');
  if (action.playerId === state.pendingTrade.proposerId) {
    throw new Error("You can't counter your own trade");
  }
  // 5+ player paired-player rule: when Player 2 is acting they can't be the
  // counter-proposer in a player trade. Counters from other players against
  // P1's offer are still allowed (those happen while P1 is the active seat).
  if (isPairedPlayer2(state) && action.playerId === currentPlayerId(state)) {
    throw new Error('Player 2 may only trade with the supply, not other players');
  }
  if (totalOf(action.give) === 0 || totalOf(action.receive) === 0) {
    throw new Error('Counter must have something on both sides');
  }
  const counterer = getPlayer(state, action.playerId);
  if (!hasAll(counterer.resources, action.give)) {
    throw new Error("You don't have the resources you're offering");
  }
  // Replace the pending trade. The counterer becomes the new proposer; the
  // original proposer is implicit (still the current player) and can accept.
  return {
    ...state,
    pendingTrade: {
      proposerId: action.playerId,
      give: { ...action.give },
      receive: { ...action.receive },
      rejectedBy: [],
    },
  };
}
