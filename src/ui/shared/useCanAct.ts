import type { GameState, PlayerId } from '@/game/types';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';

// May this device act for `playerId` right now? Solo / hot-seat: yes (the
// pass-device handoff decides who's looking). Online: only the device bound
// to that seat — any other peer dispatching the action would apply it
// locally and then be rejected by everyone else, splitting the game. Never
// for AI seats (AIDriver plays them) or spectators.
export function useCanAct(game: GameState | null, playerId: PlayerId | null): boolean {
  const role = useNetworkStore((s) => s.role);
  if (!game || !playerId) return false;
  if (role === 'spectator') return false;
  if (game.players.find((p) => p.id === playerId)?.isAI) return false;
  if (role === 'solo') return true;
  return getMyPlayerId(game) === playerId;
}
