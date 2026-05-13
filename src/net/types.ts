import type { Action, GameState, PlayerColor } from '@/game/types';

export type ConnectionState = 'disconnected' | 'connecting' | 'lobby' | 'in-game';
export type LocalRole = 'solo' | 'host' | 'guest' | 'spectator';

export interface LobbySeat {
  // null UUID means this seat is open (humans only) or AI (when isAI is true).
  uuid: string | null;
  name: string;
  isAI: boolean;
  color: PlayerColor;
}

export interface LobbyState {
  seats: LobbySeat[];
  victoryPointsToWin: number;
  seed: number;
}

export interface ChatMessage {
  id: string;
  senderUuid: string;
  senderName: string;
  text: string;
  timestamp: number;
  kind: 'user' | 'system';
}

// === Wire messages ===

export interface HelloMessage {
  uuid: string;
  displayName: string;
}

export interface ActionEnvelope {
  action: Action;
  byUuid: string;
}

export interface SnapshotMessage {
  gameState: GameState;
  chat: ChatMessage[];
  hostUuid: string;
  // Seat → UUID mapping so newcomers can tell which seat is theirs (or
  // determine they're a spectator if their UUID isn't on any seat).
  seatUuids: (string | null)[];
}

export interface SnapshotRequestMessage {
  uuid: string;
}
