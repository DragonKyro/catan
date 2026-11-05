import type { BuyGoldAction, GameState, SpendGoldAction } from '../../../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../../helpers';
import { getBankTradeRate } from '../../../actions/trade';
import { addGold } from './gold';
import { GOLD_PER_RESOURCE, MAX_GOLD_SPENDS_PER_TURN } from '../constants';

// "You may spend 2 gold to take 1 resource card of your choice from the
// supply up to two times during your turn." (T&B p. 12)
export function handleSpendGold(state: GameState, action: SpendGoldAction): GameState {
  assertCoinTurn(state, action.playerId);
  const player = getPlayer(state, action.playerId);
  if ((player.gold ?? 0) < GOLD_PER_RESOURCE) {
    throw new Error(`You need ${GOLD_PER_RESOURCE} gold`);
  }
  if ((state.goldSpendsThisTurn ?? 0) >= MAX_GOLD_SPENDS_PER_TURN) {
    throw new Error(`You may buy with gold only ${MAX_GOLD_SPENDS_PER_TURN} times a turn`);
  }
  const r = action.resource;
  if (state.bank[r] <= 0) throw new Error(`The supply has no ${r}`);
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: { ...p.resources, [r]: p.resources[r] + 1 },
  }));
  next = {
    ...next,
    bank: { ...next.bank, [r]: next.bank[r] - 1 },
    goldSpendsThisTurn: (state.goldSpendsThisTurn ?? 0) + 1,
  };
  return addGold(next, action.playerId, -GOLD_PER_RESOURCE);
}

// "You may also trade resource cards with the supply for gold at the
// general 4:1 rate (3:1 or 2:1 if you have a building at a port)." A 2:1
// port only trades its own resource, exactly like a bank trade.
export function handleBuyGold(state: GameState, action: BuyGoldAction): GameState {
  assertCoinTurn(state, action.playerId);
  const rate = getBankTradeRate(state, action.playerId, action.give);
  const player = getPlayer(state, action.playerId);
  if (player.resources[action.give] < rate) {
    throw new Error(`You need ${rate} ${action.give} to buy 1 gold`);
  }
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: { ...p.resources, [action.give]: p.resources[action.give] - rate },
  }));
  next = { ...next, bank: { ...next.bank, [action.give]: next.bank[action.give] + rate } };
  return addGold(next, action.playerId, 1);
}

function assertCoinTurn(state: GameState, playerId: string): void {
  if (!state.coinsInPlay) throw new Error('Coins are not used in this game');
  if (state.phase !== 'main') throw new Error(`Cannot use coins in phase ${state.phase}`);
  if (playerId !== currentPlayerId(state)) throw new Error('Not your turn');
}
