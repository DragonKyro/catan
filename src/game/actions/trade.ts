import type {
  GameState,
  CounterOffer,
  PendingTrade,
  BankTradeAction,
  ProposeTradeAction,
  AcceptTradeAction,
  ConfirmTradeAction,
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
import { addGold } from '../modules/traders/coins/gold';

export function getBankTradeRate(state: GameState, playerId: string, give: Resource): number {
  const player = getPlayer(state, playerId);
  // Explorers & Pirates trades 3:1 with the supply (state.supplyTradeRate).
  let rate = state.supplyTradeRate ?? 4;
  if (player.ports.includes(give)) rate = 2;
  else if (player.ports.includes('generic')) rate = Math.min(rate, 3);
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

// Traders & Barbarians: "You may use coins in trades with other players."
// Gold amounts on an offer, validated against `state.coinsInPlay`; zero
// (and absent from the pending trade) everywhere else.
function offerGold(
  state: GameState,
  offer: { giveGold?: number; receiveGold?: number },
): { giveGold: number; receiveGold: number } {
  const giveGold = offer.giveGold ?? 0;
  const receiveGold = offer.receiveGold ?? 0;
  if (giveGold === 0 && receiveGold === 0) return { giveGold, receiveGold };
  if (!state.coinsInPlay) throw new Error('Coins are not used in this game');
  for (const g of [giveGold, receiveGold]) {
    if (!Number.isInteger(g) || g < 0) throw new Error('Invalid gold amount');
  }
  return { giveGold, receiveGold };
}

function goldFields(g: { giveGold: number; receiveGold: number }): {
  giveGold?: number;
  receiveGold?: number;
} {
  return {
    ...(g.giveGold > 0 ? { giveGold: g.giveGold } : {}),
    ...(g.receiveGold > 0 ? { receiveGold: g.receiveGold } : {}),
  };
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
  const gold = offerGold(state, action);
  if (
    totalOf(action.give) + gold.giveGold === 0 ||
    totalOf(action.receive) + gold.receiveGold === 0
  ) {
    throw new Error('Trade must have something on both sides');
  }
  const player = getPlayer(state, action.playerId);
  if (!hasAll(player.resources, action.give)) {
    throw new Error("You don't have the resources you're offering");
  }
  if ((player.gold ?? 0) < gold.giveGold) {
    throw new Error("You don't have the gold you're offering");
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
      ...goldFields(gold),
      rejectedBy: [],
    },
    tradesProposedThisTurn: state.tradesProposedThisTurn + 1,
    proposedTradesThisTurn: nextProposed,
  };
}

/** Has `id` answered the pending offer (a yes, a no, or a counter-offer)? */
export function hasAnsweredTrade(trade: PendingTrade, id: PlayerId): boolean {
  return trade.rejectedBy.includes(id)
    || (trade.acceptedBy ?? []).includes(id)
    || (trade.counters ?? []).some((c) => c.by === id);
}

/** `trade` without `id`'s yes, no and counter (before they answer again). */
function withoutAnswer(trade: PendingTrade, id: PlayerId): PendingTrade {
  const counters = (trade.counters ?? []).filter((c) => c.by !== id);
  const accepted = (trade.acceptedBy ?? []).filter((x) => x !== id);
  return {
    ...trade,
    rejectedBy: trade.rejectedBy.filter((x) => x !== id),
    ...(trade.acceptedBy ? { acceptedBy: accepted } : {}),
    ...(trade.counters ? { counters } : {}),
  };
}

/**
 * `with`'s counter-offer as an offer from the proposer that `with` has
 * accepted: the proposer gives what the counter asks for and gets what it
 * gives. Completing it is then the ordinary confirm (base and C&K alike).
 */
export function counterAsOffer(trade: PendingTrade, c: CounterOffer): PendingTrade {
  return {
    proposerId: trade.proposerId,
    give: { ...c.receive },
    receive: { ...c.give },
    ...(c.receiveGold ? { giveGold: c.receiveGold } : {}),
    ...(c.giveGold ? { receiveGold: c.giveGold } : {}),
    ...(c.receiveCommodities ? { giveCommodities: c.receiveCommodities } : {}),
    ...(c.giveCommodities ? { receiveCommodities: c.giveCommodities } : {}),
    rejectedBy: [],
    acceptedBy: [c.by],
  };
}

/**
 * A confirm of a counter-offer, rewritten as the confirm of that counter's
 * terms (or the state as it is for an ordinary confirm). Shared by the base
 * and the Cities & Knights confirm handlers.
 */
export function stateForConfirm(state: GameState, action: ConfirmTradeAction): GameState {
  if (!action.counter) return state;
  const trade = state.pendingTrade;
  if (!trade) throw new Error('No trade to confirm');
  if (action.playerId !== trade.proposerId) throw new Error('Only the proposer picks who to trade with');
  const c = (trade.counters ?? []).find((x) => x.by === action.with);
  if (!c) throw new Error("That player hasn't made a counter-offer");
  return { ...state, pendingTrade: counterAsOffer(trade, c) };
}

/**
 * Accept the pending trade: a yes. The acceptor joins `acceptedBy` (dropping
 * any no or counter of theirs) and nothing moves until the proposer picks a
 * partner (`confirmTrade`).
 */
export function handleAcceptTrade(
  state: GameState,
  action: AcceptTradeAction,
): GameState {
  const trade = state.pendingTrade;
  if (!trade) throw new Error('No trade to accept');
  if (action.playerId === trade.proposerId) {
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
  const proposer = getPlayer(state, trade.proposerId);
  if (!hasAll(acceptor.resources, trade.receive)) {
    throw new Error("You don't have the resources the proposer wants");
  }
  if (!hasAll(proposer.resources, trade.give)) {
    throw new Error('The proposer no longer has the offered resources');
  }
  if ((acceptor.gold ?? 0) < (trade.receiveGold ?? 0)) {
    throw new Error("You don't have the gold the proposer wants");
  }
  if ((proposer.gold ?? 0) < (trade.giveGold ?? 0)) {
    throw new Error('The proposer no longer has the offered gold');
  }
  const accepted = trade.acceptedBy ?? [];
  if (accepted.includes(action.playerId)) return state;
  const rest = withoutAnswer(trade, action.playerId);
  return {
    ...state,
    pendingTrade: { ...rest, acceptedBy: [...(rest.acceptedBy ?? []), action.playerId] },
  };
}

/** The proposer trades with one of the players who accepted their offer, or takes a counter-offer. */
export function handleConfirmTrade(input: GameState, action: ConfirmTradeAction): GameState {
  const state = stateForConfirm(input, action);
  const trade = state.pendingTrade;
  if (!trade) throw new Error('No trade to confirm');
  if (action.playerId !== trade.proposerId) {
    throw new Error('Only the proposer picks who to trade with');
  }
  if (!(trade.acceptedBy ?? []).includes(action.with)) {
    throw new Error("That player hasn't accepted this trade");
  }
  return completeTrade(state, action.with);
}

/**
 * Swap the pending trade's cards (and gold) between its proposer and
 * `partnerId`, and clear it. Every base check runs again here, since the
 * proposer may have built since their offer went out.
 */
export function completeTrade(state: GameState, partnerId: PlayerId): GameState {
  const trade = state.pendingTrade;
  if (!trade) throw new Error('No trade to complete');
  const acceptor = getPlayer(state, partnerId);
  const proposer = getPlayer(state, trade.proposerId);
  if (!hasAll(acceptor.resources, trade.receive)) {
    throw new Error(`${acceptor.name} no longer has the resources the trade asks for`);
  }
  if (!hasAll(proposer.resources, trade.give)) {
    throw new Error('The proposer no longer has the offered resources');
  }
  const giveGold = trade.giveGold ?? 0;
  const receiveGold = trade.receiveGold ?? 0;
  if ((acceptor.gold ?? 0) < receiveGold) {
    throw new Error(`${acceptor.name} no longer has the gold the trade asks for`);
  }
  if ((proposer.gold ?? 0) < giveGold) {
    throw new Error('The proposer no longer has the offered gold');
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
  const proposerGave = (Object.keys(trade.give) as Resource[]).filter(
    (r) => (trade.give[r] ?? 0) > 0,
  );
  const proposerGot = (Object.keys(trade.receive) as Resource[]).filter(
    (r) => (trade.receive[r] ?? 0) > 0,
  );
  next = recordTradeResources(next, proposer.id, proposerGave, proposerGot);
  next = recordTradeResources(next, acceptor.id, proposerGot, proposerGave);
  // Coins change hands too (and the wealth tiles follow).
  if (giveGold !== receiveGold) {
    next = addGold(next, proposer.id, receiveGold - giveGold);
    next = addGold(next, acceptor.id, giveGold - receiveGold);
  }
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

/** Everyone but the proposer said no (and nobody has a counter standing): the offer closes. */
function closesIfAllRejected(state: GameState, trade: PendingTrade): GameState {
  const others = state.players.filter((p) => p.id !== trade.proposerId);
  if (others.every((p) => trade.rejectedBy.includes(p.id)) && (trade.counters ?? []).length === 0) {
    return { ...state, pendingTrade: undefined };
  }
  return { ...state, pendingTrade: trade };
}

export function handleRejectTrade(
  state: GameState,
  action: RejectTradeAction,
): GameState {
  if (!state.pendingTrade) throw new Error('No trade to reject');
  if (action.playerId === state.pendingTrade.proposerId) {
    throw new Error("You can't reject your own trade");
  }
  const trade = state.pendingTrade;
  if (trade.rejectedBy.includes(action.playerId)) return state;
  // A no after a yes takes the yes back; after a counter it withdraws it.
  const rest = withoutAnswer(trade, action.playerId);
  // Auto-cancel once every non-proposer has said no — no point keeping the
  // pending trade alive when nobody can/will accept.
  return closesIfAllRejected(state, { ...rest, rejectedBy: [...rest.rejectedBy, action.playerId] });
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
  const gold = offerGold(state, action);
  if (
    totalOf(action.give) + gold.giveGold === 0 ||
    totalOf(action.receive) + gold.receiveGold === 0
  ) {
    throw new Error('Counter must have something on both sides');
  }
  const counterer = getPlayer(state, action.playerId);
  if (!hasAll(counterer.resources, action.give)) {
    throw new Error("You don't have the resources you're offering");
  }
  if ((counterer.gold ?? 0) < gold.giveGold) {
    throw new Error("You don't have the gold you're offering");
  }
  return addCounter(state, {
    by: action.playerId,
    give: { ...action.give },
    receive: { ...action.receive },
    ...goldFields(gold),
  });
}

/**
 * Put `c` beside the pending offer (replacing any earlier counter of its
 * maker's, and their yes / no): the offer stays open to everyone else, and
 * the proposer may take the counter instead. Only the proposer's (the active
 * player's) offer can be countered.
 */
export function addCounter(state: GameState, c: CounterOffer): GameState {
  const trade = state.pendingTrade!;
  if (trade.proposerId !== currentPlayerId(state)) throw new Error('Only the active player\'s offer can be countered');
  const rest = withoutAnswer(trade, c.by);
  const made = state.countersThisTurn?.[c.by] ?? 0;
  return {
    ...state,
    pendingTrade: { ...rest, counters: [...(rest.counters ?? []), c] },
    countersThisTurn: { ...state.countersThisTurn, [c.by]: made + 1 },
  };
}
