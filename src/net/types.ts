import type { Action, PlayerColor, AiLevel } from '@/game/types';
import type { CreateGameOptions } from '@/game/createGame';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'lobby'
  | 'in-game'
  | 'error';
export type LocalRole = 'solo' | 'host' | 'guest' | 'spectator';

export interface LobbySeat {
  // null UUID means this seat is open (humans only) or AI (when isAI is true).
  uuid: string | null;
  name: string;
  isAI: boolean;
  color: PlayerColor;
}

/** The Traders & Barbarians variants, which go with any rules (Event Cards: not with Cities & Knights). */
export interface LobbyVariants {
  friendlyRobber: boolean;
  strongestPorts: boolean;
  eventCards: boolean;
}

/**
 * What the online game will be: the base game (on `baseScenarioId`, any Fun
 * Map), Seafarers (on `scenarioId`), Cities & Knights (on `baseScenarioId`,
 * the maps C&K allows), Traders & Barbarians (on `tradersScenarioId`) or
 * Explorers & Pirates (its own map). At most one of `seafarers` /
 * `citiesKnights` / `traders` / `explorersPirates` is on (they don't combine
 * yet); the variants stack on any but Explorers & Pirates. See
 * store/lobbyGame.ts.
 */
export interface LobbyGame {
  seafarers: boolean;
  scenarioId: string;
  baseScenarioId: string;
  citiesKnights: boolean;
  traders: boolean;
  tradersScenarioId: string;
  // Optional so a lobby written by an older build still reads (normalized
  // to false).
  explorersPirates?: boolean;
  variants: LobbyVariants;
}

export interface LobbyState {
  hostUuid: string;
  seats: LobbySeat[];
  /** null = the scenario's recommended target for the seat count. */
  victoryPointsToWin: number | null;
  seed: number;
  /** AI seats' strength (only used where the trained AI plays: base game, standard map). */
  aiLevel?: AiLevel;
  game: LobbyGame;
  /** Set by the host, atomically with the final seat list, as the game starts. */
  started?: boolean;
}

export interface ChatMessage {
  id: string;
  senderUuid: string;
  senderName: string;
  text: string;
  timestamp: number;
  kind: 'user' | 'system';
}

// === What a room stores ===

/** Written once, by the host, when the room is made. */
export interface RoomMeta {
  hostUuid: string;
  createdAt: number;
  /** The app build that made the room (devices on other builds may not stay in step). */
  build: string;
}

/**
 * How the game began. It carries createGame's inputs rather than the
 * starting GameState (a few hundred bytes instead of 30-100 KB): createGame
 * is deterministic, so every device builds the same game from them, then
 * applies the action log.
 */
export interface StartRecord {
  options: CreateGameOptions;
  // Seat → UUID, so each device can tell which seat is theirs (or that
  // they're a spectator when their UUID isn't on any seat).
  seatUuids: (string | null)[];
  hostUuid: string;
  /** When the host started the game (ms since epoch); the game clock counts from here. */
  startedAt: number;
  /** Checksum of the starting GameState, so a device that built a different one (another app version) can tell. */
  check: string;
}

/** One move in the room's action log. */
export interface LoggedAction {
  action: Action;
  /** Short random id, so the author recognises its own move in the log. */
  nonce: string;
  /** When the move was made (ms since epoch, the author's clock): the game clock and per-player time stats. */
  at: number;
}

/** A device currently connected to the room. */
export interface Presence {
  uuid: string;
  name: string;
}
