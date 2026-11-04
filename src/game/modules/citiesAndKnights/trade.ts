import type {
  AcceptTradeAction,
  BankTradeCKAction,
  Commodity,
  CommodityBank,
  CounterTradeAction,
  GameState,
  PlayerId,
  ProposeTradeAction,
  TradeGood,
} from '../../types';
import { COMMODITIES, RESOURCES } from '../../types';
import { currentPlayerId, getPlayer, isPairedPlayer2, updatePlayer } from '../../helpers';
import {
  getBankTradeRate,
  handleAcceptTrade,
  handleCounterTrade,
  handleProposeTrade,
} from '../../actions/trade';
import { addResources, subtractResources } from '../../resources';
import { addCommodities, subtractCommodities } from '../../commodities';
import { merchantGuildActive } from './improvements/state';
import { holdsSelection, selectionSize } from './cards';

const NO_COMMODITIES: CommodityBank = { paper: 0, cloth: 0, coin: 0 };

export function isCommodity(good: TradeGood): good is Commodity {
  return (COMMODITIES as readonly string[]).includes(good);
}

// Supply trade rate for giving `give` under Cities & Knights (p.7-8, p.14):
//   - resources: the usual 4:1 / 3:1 / 2:1 harbor rates, 2:1 on the
//     merchant's hex resource, and Merchant Fleet;
//   - commodities: 4:1, 3:1 with a generic harbor (2:1 resource harbors
//     don't apply), 2:1 with the Merchant Guild (trade level 3) or a
//     Merchant Fleet naming that commodity.
export function ckBankTradeRate(state: GameState, playerId: PlayerId, give: TradeGood): number {
  if (!isCommodity(give)) return getBankTradeRate(state, playerId, give);
  const player = getPlayer(state, playerId);
  let rate = player.ports.includes('generic') ? 3 : 4;
  if (merchantGuildActive(state, playerId)) rate = 2;
  const fleet = state.merchantFleetActive;
  if (fleet?.kind === 'commodity' && fleet.which === give) rate = Math.min(rate, 2);
  return rate;
}

function held(state: GameState, playerId: PlayerId, good: TradeGood): number {
  const p = getPlayer(state, playerId);
  return isCommodity(good) ? (p.commodities ?? NO_COMMODITIES)[good] : p.resources[good];
}

function inSupply(state: GameState, good: TradeGood): number {
  return isCommodity(good) ? (state.commodityBank ?? NO_COMMODITIES)[good] : state.bank[good];
}

// Bank trade with a commodity on either side (`bankTradeCK`): resources for
// commodities, commodities for resources or other commodities.
export function handleBankTradeCK(state: GameState, action: BankTradeCKAction): GameState {
  if (state.phase !== 'main') throw new Error(`Cannot trade in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const goods = [...RESOURCES, ...COMMODITIES] as readonly string[];
  if (!goods.includes(action.give) || !goods.includes(action.receive)) {
    throw new Error('Trade resources or commodities');
  }
  if (action.give === action.receive) throw new Error('Cannot trade a card for itself');
  const count = action.count ?? 1;
  if (!Number.isInteger(count) || count < 1) throw new Error('Trade count must be a positive integer');
  const rate = ckBankTradeRate(state, action.playerId, action.give);
  const giveN = rate * count;
  if (held(state, action.playerId, action.give) < giveN) {
    throw new Error(`Need ${giveN} ${action.give} to trade for ${count}`);
  }
  if (inSupply(state, action.receive) < count) {
    throw new Error(`The supply does not have ${count} ${action.receive}`);
  }
  let next = moveGood(state, action.playerId, action.give, -giveN);
  next = moveGood(next, action.playerId, action.receive, count);
  return next;
}

// Change a player's holding of `good` by `delta`, mirroring it in the supply.
function moveGood(state: GameState, playerId: PlayerId, good: TradeGood, delta: number): GameState {
  const d = { [good]: Math.abs(delta) };
  if (isCommodity(good)) {
    const next = updatePlayer(state, playerId, (p) => ({
      ...p,
      commodities: delta > 0
        ? addCommodities(p.commodities ?? NO_COMMODITIES, d)
        : subtractCommodities(p.commodities ?? NO_COMMODITIES, d),
    }));
    const bank = next.commodityBank ?? NO_COMMODITIES;
    return {
      ...next,
      commodityBank: delta > 0 ? subtractCommodities(bank, d) : addCommodities(bank, d),
    };
  }
  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    resources: delta > 0 ? addResources(p.resources, d) : subtractResources(p.resources, d),
  }));
  return { ...next, bank: delta > 0 ? subtractResources(next.bank, d) : addResources(next.bank, d) };
}

// ----- Player trades with commodities (p.7) -----
// The base handlers move resources; these wrappers add the commodity
// columns of the offer. Offers without commodities go straight to the base.

function hasCommodities(c: Partial<CommodityBank> | undefined): boolean {
  return selectionSize({}, c) > 0;
}

function cleanCommodities(c: Partial<CommodityBank> | undefined): Partial<CommodityBank> | undefined {
  if (!c) return undefined;
  const out: Partial<CommodityBank> = {};
  for (const k of COMMODITIES) if ((c[k] ?? 0) > 0) out[k] = c[k];
  return Object.keys(out).length > 0 ? out : undefined;
}

export function handleProposeTradeCK(state: GameState, action: ProposeTradeAction): GameState {
  const giveC = cleanCommodities(action.giveCommodities);
  const receiveC = cleanCommodities(action.receiveCommodities);
  if (!giveC && !receiveC) return handleProposeTrade(state, action);
  if (state.phase !== 'main') throw new Error(`Cannot propose trade in phase ${state.phase}`);
  if (action.playerId !== currentPlayerId(state)) {
    throw new Error('Only the current player can propose a trade');
  }
  if (isPairedPlayer2(state)) {
    throw new Error('Player 2 may only trade with the supply, not other players');
  }
  if (state.pendingTrade) throw new Error('A trade is already pending — cancel it first');
  if (selectionSize(action.give, giveC) === 0 || selectionSize(action.receive, receiveC) === 0) {
    throw new Error('Trade must have something on both sides');
  }
  if (!holdsSelection(state, action.playerId, action.give, giveC)) {
    throw new Error("You don't have the cards you're offering");
  }
  return {
    ...state,
    pendingTrade: {
      proposerId: action.playerId,
      give: { ...action.give },
      receive: { ...action.receive },
      ...(giveC ? { giveCommodities: giveC } : {}),
      ...(receiveC ? { receiveCommodities: receiveC } : {}),
      rejectedBy: [],
    },
    tradesProposedThisTurn: state.tradesProposedThisTurn + 1,
  };
}

export function handleCounterTradeCK(state: GameState, action: CounterTradeAction): GameState {
  const giveC = cleanCommodities(action.giveCommodities);
  const receiveC = cleanCommodities(action.receiveCommodities);
  if (!giveC && !receiveC) return handleCounterTrade(state, action);
  if (state.phase !== 'main') throw new Error(`Cannot counter in phase ${state.phase}`);
  if (!state.pendingTrade) throw new Error('No trade to counter');
  if (action.playerId === state.pendingTrade.proposerId) {
    throw new Error("You can't counter your own trade");
  }
  if (isPairedPlayer2(state) && action.playerId === currentPlayerId(state)) {
    throw new Error('Player 2 may only trade with the supply, not other players');
  }
  if (selectionSize(action.give, giveC) === 0 || selectionSize(action.receive, receiveC) === 0) {
    throw new Error('Counter must have something on both sides');
  }
  if (!holdsSelection(state, action.playerId, action.give, giveC)) {
    throw new Error("You don't have the cards you're offering");
  }
  return {
    ...state,
    pendingTrade: {
      proposerId: action.playerId,
      give: { ...action.give },
      receive: { ...action.receive },
      ...(giveC ? { giveCommodities: giveC } : {}),
      ...(receiveC ? { receiveCommodities: receiveC } : {}),
      rejectedBy: [],
    },
  };
}

export function handleAcceptTradeCK(state: GameState, action: AcceptTradeAction): GameState {
  const trade = state.pendingTrade;
  if (!trade || (!hasCommodities(trade.giveCommodities) && !hasCommodities(trade.receiveCommodities))) {
    return handleAcceptTrade(state, action);
  }
  if (action.playerId === trade.proposerId) throw new Error("You can't accept your own trade");
  if (!holdsSelection(state, action.playerId, {}, trade.receiveCommodities)) {
    throw new Error("You don't have the commodities the proposer wants");
  }
  if (!holdsSelection(state, trade.proposerId, {}, trade.giveCommodities)) {
    throw new Error('The proposer no longer has the offered commodities');
  }
  // Resources (and every base check) first; then the commodity columns.
  let next = handleAcceptTrade(state, action);
  const giveC = trade.giveCommodities ?? {};
  const receiveC = trade.receiveCommodities ?? {};
  next = updatePlayer(next, trade.proposerId, (p) => ({
    ...p,
    commodities: addCommodities(subtractCommodities(p.commodities ?? NO_COMMODITIES, giveC), receiveC),
  }));
  next = updatePlayer(next, action.playerId, (p) => ({
    ...p,
    commodities: addCommodities(subtractCommodities(p.commodities ?? NO_COMMODITIES, receiveC), giveC),
  }));
  return next;
}
