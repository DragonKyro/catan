import type { GameState, BankTradeAction, Resource } from '../types';
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
