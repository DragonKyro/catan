import type {
  GameState,
  BankTradeAction,
  ProposeTradeAction,
  AcceptTradeAction,
  CancelTradeAction,
  CounterTradeAction,
  RejectTradeAction,
  Resource,
  ResourceBank,
} from '../types';
import { RESOURCES } from '../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../helpers';
import { addResources, subtractResources } from '../resources';

export function getBankTradeRate(state: GameState, playerId: string, give: Resource): number {
  const player = getPlayer(state, playerId);
  if (player.ports.includes(give)) return 2;
  if (player.ports.includes('generic')) return 3;
  return 4;
}

export function handleBankTrade(state: GameState, action: BankTradeAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot trade in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (action.give === action.receive) throw new Error('Cannot trade resource for itself');

  const player = getPlayer(state, action.playerId);
  const rate = getBankTradeRate(state, action.playerId, action.give);
  if (player.resources[action.give] < rate) {
    throw new Error(`Need ${rate} ${action.give} to trade`);
  }
  if (state.bank[action.receive] < 1) {
    throw new Error(`Bank is out of ${action.receive}`);
  }

  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: addResources(
      subtractResources(p.resources, { [action.give]: rate }),
      { [action.receive]: 1 },
    ),
  }));
  next = {
    ...next,
    bank: addResources(subtractResources(next.bank, { [action.receive]: 1 }), {
      [action.give]: rate,
    }),
  };
  return next;
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
  return {
    ...state,
    pendingTrade: {
      proposerId: action.playerId,
      give: { ...action.give },
      receive: { ...action.receive },
      rejectedBy: [],
    },
    tradesProposedThisTurn: state.tradesProposedThisTurn + 1,
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
  return {
    ...state,
    pendingTrade: {
      ...state.pendingTrade,
      rejectedBy: [...state.pendingTrade.rejectedBy, action.playerId],
    },
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
