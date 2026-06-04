import type { GameState, PlaceMerchantAction } from '../../../types';
import { currentPlayerId } from '../../../helpers';

// Place the merchant on a land hex adjacent to one of your buildings.
// Merchant ownership grants +1 VP and a 2:1 trade rate on the resource the
// merchant's hex produces. Only legal in `placeMerchant` phase entered by
// playing the Merchant progress card.
export function handlePlaceMerchant(
  state: GameState,
  action: PlaceMerchantAction,
): GameState {
  if (state.phase !== 'placeMerchant') {
    throw new Error(`Cannot place merchant in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  const hex = state.board.hexes[action.hex];
  if (!hex) throw new Error('Unknown hex');
  if (hex.terrain === 'sea' || hex.terrain === 'desert' || hex.terrain === 'gold') {
    throw new Error('Merchant must sit on a resource-producing land hex');
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) throw new Error('Unknown player');
  // Must have a building adjacent to the hex.
  let adjacent = false;
  for (const v of Object.values(state.board.vertices)) {
    if (!v.hexes.includes(action.hex)) continue;
    if (player.settlements.includes(v.id) || player.cities.includes(v.id)) {
      adjacent = true;
      break;
    }
  }
  if (!adjacent) {
    throw new Error('Merchant hex must be adjacent to one of your buildings');
  }
  return {
    ...state,
    phase: 'main',
    merchant: { ownerId: action.playerId, hexId: action.hex },
  };
}
