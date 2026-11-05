import type { GameState, HexId, PlaceMerchantAction, PlayerId } from '../../../types';
import { currentPlayerId } from '../../../helpers';
import { resumeFlow } from '../flow';

// Merchant (p.7, p.14): "Place it on any land hex next to one of your
// buildings." Any land hex counts — even the desert, which gives its owner
// the 1 VP but no 2:1 trade (gold fields are excluded, p.12).
export function canPlaceMerchantOn(state: GameState, playerId: PlayerId, hexId: HexId): boolean {
  const hex = state.board.hexes[hexId];
  if (!hex || hex.terrain === 'sea' || hex.terrain === 'gold') return false;
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  return hex.corners.some((v) => p.settlements.includes(v) || p.cities.includes(v));
}

export function merchantSites(state: GameState, playerId: PlayerId): HexId[] {
  return state.board.hexIds.filter((h) => canPlaceMerchantOn(state, playerId, h));
}

// Take control of the merchant and put it on a hex (placeMerchant phase,
// entered by playing the Merchant card). Worth 1 VP while you control it,
// and 2:1 trades in that hex's resource.
export function handlePlaceMerchant(state: GameState, action: PlaceMerchantAction): GameState {
  if (state.phase !== 'placeMerchant') {
    throw new Error(`Cannot place merchant in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (!canPlaceMerchantOn(state, action.playerId, action.hex)) {
    throw new Error('The merchant goes on a land hex next to one of your buildings');
  }
  return resumeFlow({ ...state, merchant: { ownerId: action.playerId, hexId: action.hex } });
}
