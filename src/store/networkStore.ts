import { create } from 'zustand';
import type { Action, AiLevel, GameState, PlayerColor, PlayerId } from '@/game/types';
import { createGame } from '@/game/createGame';
import { DEFAULT_AI_LEVEL } from '@/ai/nn/levels';
import {
  bindRoom,
  relayStatus,
  type RelayStatus,
  type RoomBindings,
  type LobbyState,
  type LobbySeat,
  type ChatMessage,
  type ConnectionState,
  type LocalRole,
  generateRoomCode,
  getOrCreateUuid,
  getSavedDisplayName,
  saveDisplayName,
} from '@/net';
import {
  registerBroadcastHandler,
  registerOnlinePredicate,
  useGameStore,
} from './gameStore';

const DEFAULT_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white', 'purple', 'pink', 'teal', 'gold'];
const DEFAULT_VP = 10;
const MAX_SEATS = 8;
const MIN_SEATS = 3;
const SYSTEM_NAME = 'System';
// How long a guest looks for the host before reporting the room as not
// found. Discovery via the Nostr relays usually takes a few seconds; the rest
// is headroom for a host whose phone is just coming back from the background.
export const JOIN_TIMEOUT_MS = 25000;

/** Why a guest's join gave up, for the error screen (and debugging). */
export interface JoinFailure {
  code: string;
  /** noRelays: this device reached no relay, so it couldn't look at all.
   *  noHost:   other devices answered on this code, but none is hosting.
   *  notFound: relays reached, nobody answered. */
  reason: 'noRelays' | 'noHost' | 'notFound';
  relays: RelayStatus;
  peersSeen: number;
  waitedMs: number;
}

const JOIN_FAILURE_TEXT: Record<JoinFailure['reason'], (code: string) => string> = {
  notFound: (code) =>
    `No room with code ${code} was found. Check the code, and make sure the host still has the room open `
    + 'with the screen on (phones pause web pages in the background).',
  noHost: (code) =>
    `Found other devices using code ${code}, but none of them is hosting a room. `
    + 'The host may have left, or the code is wrong.',
  noRelays: () =>
    "This device couldn't reach any of the matchmaking relays, so it couldn't look for the room. "
    + 'Check its internet connection; some Wi-Fi and work networks block them (try mobile data).',
};

interface NetStore {
  connection: ConnectionState;
  errorMessage: string | null;
  role: LocalRole;
  myUuid: string;
  myDisplayName: string;
  roomCode: string | null;
  hostUuid: string | null;
  /** Set while a guest is looking for a room. */
  joinStartedAt: number | null;
  joinFailure: JoinFailure | null;
  lobby: LobbyState;
  uuidByPeerId: Record<string, string>;
  onlineUuids: Set<string>;
  chat: ChatMessage[];

  setDisplayName: (name: string) => void;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  /** Look for the room of the last failed join again. */
  retryJoin: () => void;
  leaveRoom: () => void;
  /** This page's relay connections right now (not reactive; poll it). */
  relayStatus: () => RelayStatus;
  clearError: () => void;

  hostAddAISeat: () => void;
  hostRemoveSeat: (slot: number) => void;
  hostSetVP: (vp: number) => void;
  hostSetAiLevel: (level: AiLevel) => void;
  hostStartGame: () => void;

  sendChat: (text: string) => void;
  uuidForPlayer: (playerId: PlayerId) => string | null;
  isOnlinePlayer: (playerId: PlayerId) => boolean;
}

// Internal (non-reactive) — the live Trystero room bindings + a map from
// player slot index → UUID derived from lobby. Stored outside React state to
// avoid serializing Trystero callbacks etc.
let bindings: RoomBindings | null = null;
let seatToUuid: (string | null)[] = []; // index = playerId 'pN' slot
let joinTimeoutId: ReturnType<typeof setTimeout> | null = null;
// Peers that connected while this guest was still looking for the host.
let peersSeenWhileJoining = 0;

function clearJoinTimeout(): void {
  if (joinTimeoutId !== null) {
    clearTimeout(joinTimeoutId);
    joinTimeoutId = null;
  }
}

function emptyLobby(): LobbyState {
  return { seats: [], victoryPointsToWin: DEFAULT_VP, seed: Math.floor(Math.random() * 0xffffffff) };
}

function freeColor(seats: LobbySeat[]): PlayerColor {
  for (const c of DEFAULT_COLORS) {
    if (!seats.some((s) => s.color === c)) return c;
  }
  return DEFAULT_COLORS[seats.length % DEFAULT_COLORS.length]!;
}

function sysMessage(text: string, myUuid: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderUuid: myUuid,
    senderName: SYSTEM_NAME,
    text,
    timestamp: Date.now(),
    kind: 'system',
  };
}

function userMessage(text: string, uuid: string, name: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderUuid: uuid,
    senderName: name,
    text,
    timestamp: Date.now(),
    kind: 'user',
  };
}

export const useNetworkStore = create<NetStore>((set, get) => {
  // Register the broadcast hook + online predicate once at module init.
  registerOnlinePredicate(() => {
    const c = get().connection;
    return c === 'lobby' || c === 'in-game';
  });
  registerBroadcastHandler((action: Action) => {
    if (!bindings) return;
    const me = get().myUuid;
    bindings.sendAction({ action, byUuid: me });
  });

  const myUuid = getOrCreateUuid();
  const myDisplayName = getSavedDisplayName();

  // Wire incoming-action handler with role check
  function attachBindings(b: RoomBindings, asHost: boolean): void {
    bindings = b;

    b.recvHello((msg, peerId) => {
      const s = get();
      // Track peerId -> UUID
      set({
        uuidByPeerId: { ...s.uuidByPeerId, [peerId]: msg.uuid },
        onlineUuids: new Set([...s.onlineUuids, msg.uuid]),
      });
      // System chat
      if (s.chat.every((c) => c.senderUuid !== msg.uuid || c.kind !== 'system')) {
        set({ chat: [...get().chat, sysMessage(`${msg.displayName} joined`, get().myUuid)] });
      }

      // If we're the host and still in lobby, add this UUID to a free seat.
      if (asHost && get().connection === 'lobby') {
        const lobby = get().lobby;
        const existing = lobby.seats.findIndex((seat) => seat.uuid === msg.uuid);
        if (existing >= 0) return; // already seated (rejoin)
        if (lobby.seats.length < MAX_SEATS) {
          const seats: LobbySeat[] = [
            ...lobby.seats,
            { uuid: msg.uuid, name: msg.displayName, isAI: false, color: freeColor(lobby.seats) },
          ];
          const newLobby = { ...lobby, seats };
          set({ lobby: newLobby });
          b.sendLobby(newLobby);
        }
      }

      // If we're the host and a game is in progress, send a snapshot.
      // Otherwise the lowest-peerId-among-connected sends; for simplicity in
      // this version, the host alone is the snapshot source.
      if (asHost && get().connection === 'in-game') {
        const gs = useGameStore.getState().game;
        if (gs) {
          b.sendSnapshot(
            {
              gameState: gs,
              chat: get().chat,
              hostUuid: get().myUuid,
              seatUuids: seatToUuid,
            },
            peerId,
          );
        }
      }
    });

    b.recvLobby((state) => {
      clearJoinTimeout();
      // Authoritative from host — overwrite ours.
      set({
        lobby: state,
        hostUuid: state.seats[0]?.uuid ?? null,
        connection: get().connection === 'connecting' ? 'lobby' : get().connection,
        errorMessage: null,
        joinStartedAt: null,
      });
    });

    b.recvStart((msg) => {
      clearJoinTimeout();
      // Carry the seat→UUID mapping directly from the start payload so we
      // don't depend on the 'lobby' channel landing first (the two channels
      // are unordered and the lobby broadcast can lose the race with start).
      seatToUuid = msg.seatUuids.slice();
      const me = get().myUuid;
      const isPlayer = seatToUuid.some((u) => u === me);
      useGameStore.getState().setGameState(msg.gameState);
      set({
        connection: 'in-game',
        role: isPlayer ? 'guest' : 'spectator',
        hostUuid: msg.hostUuid,
        chat: [...get().chat, sysMessage('Game started', me)],
        errorMessage: null,
        joinStartedAt: null,
      });
    });

    b.recvAction((env) => {
      // Soft verify: the sending UUID must own the seat for this action.
      const expectedUuid = get().uuidForPlayer(env.action.playerId);
      if (expectedUuid && expectedUuid !== env.byUuid) {
        console.warn('[net] dropping action: UUID/seat mismatch', env);
        return;
      }
      useGameStore.getState().applyLocal(env.action);
    });

    b.recvSnapshot((msg) => {
      clearJoinTimeout();
      // Snapshot is authoritative — use its seat mapping.
      seatToUuid = msg.seatUuids.slice();
      const me = get().myUuid;
      const isPlayer = seatToUuid.some((u) => u === me);
      useGameStore.getState().setGameState(msg.gameState);
      set({
        connection: 'in-game',
        role: isPlayer ? 'guest' : 'spectator',
        hostUuid: msg.hostUuid,
        chat: [...msg.chat, sysMessage(isPlayer ? 'Rejoined game' : 'Spectating', me)],
        errorMessage: null,
        joinStartedAt: null,
      });
    });

    b.recvSnapshotRequest((_msg, peerId) => {
      // Any peer with state can fulfill; host preferred. We always answer.
      const gs = useGameStore.getState().game;
      if (gs) {
        b.sendSnapshot(
          {
            gameState: gs,
            chat: get().chat,
            hostUuid: get().hostUuid ?? get().myUuid,
            seatUuids: seatToUuid,
          },
          peerId,
        );
      }
    });

    b.recvChat((msg) => {
      set({ chat: [...get().chat, msg] });
    });

    b.onPeerJoin((peerId) => {
      if (get().connection === 'connecting') peersSeenWhileJoining++;
      // Send our hello so they can map us.
      b.sendHello({ uuid: get().myUuid, displayName: get().myDisplayName }, peerId);
      // Also send current lobby state if host.
      if (asHost && get().connection === 'lobby') {
        b.sendLobby(get().lobby, peerId);
      }
    });

    b.onPeerLeave((peerId) => {
      const s = get();
      const uuid = s.uuidByPeerId[peerId];
      if (!uuid) return;
      const { [peerId]: _drop, ...rest } = s.uuidByPeerId;
      // A single UUID may be reachable via multiple peers (e.g., two windows
      // sharing localStorage). Only mark it offline / emit a disconnect if no
      // other peerId still maps to that UUID.
      const stillOnline = Object.values(rest).includes(uuid);
      const online = new Set(s.onlineUuids);
      if (!stillOnline) online.delete(uuid);
      const name =
        s.lobby.seats.find((seat) => seat.uuid === uuid)?.name ?? 'A player';
      set({
        uuidByPeerId: rest,
        onlineUuids: online,
        chat: stillOnline
          ? s.chat
          : [...s.chat, sysMessage(`${name} disconnected`, s.myUuid)],
      });
    });
  }

  function cacheSeatToUuidFromLobby(lobby: LobbyState): void {
    seatToUuid = lobby.seats.map((s) => s.uuid);
  }

  return {
    connection: 'disconnected',
    errorMessage: null,
    role: 'solo',
    myUuid,
    myDisplayName: myDisplayName || 'Player',
    roomCode: null,
    hostUuid: null,
    joinStartedAt: null,
    joinFailure: null,
    lobby: emptyLobby(),
    uuidByPeerId: {},
    onlineUuids: new Set(),
    chat: [],

    setDisplayName: (name) => {
      saveDisplayName(name);
      set({ myDisplayName: name });
    },

    createRoom: (name) => {
      saveDisplayName(name);
      const code = generateRoomCode();
      const uuid = get().myUuid;
      const initialLobby: LobbyState = {
        seats: [{ uuid, name, isAI: false, color: DEFAULT_COLORS[0]! }],
        victoryPointsToWin: DEFAULT_VP,
        aiLevel: DEFAULT_AI_LEVEL,
        seed: Math.floor(Math.random() * 0xffffffff),
      };
      try {
        const b = bindRoom(code);
        attachBindings(b, true);
      } catch (err) {
        console.error('[net] failed to create room', err);
        set({
          connection: 'error',
          errorMessage:
            'Could not reach the matchmaking relays. Check your internet connection.',
        });
        return;
      }
      set({
        connection: 'lobby',
        role: 'host',
        myDisplayName: name,
        roomCode: code,
        hostUuid: uuid,
        joinStartedAt: null,
        joinFailure: null,
        lobby: initialLobby,
        onlineUuids: new Set([uuid]),
        chat: [],
        errorMessage: null,
      });
    },

    joinRoom: (code, name) => {
      saveDisplayName(name);
      const upper = code.trim().toUpperCase();
      clearJoinTimeout();
      try {
        bindings?.leave();
      } catch {
        /* ignore */
      }
      bindings = null;
      peersSeenWhileJoining = 0;
      try {
        const b = bindRoom(upper);
        attachBindings(b, false);
      } catch (err) {
        console.error('[net] failed to join room', err);
        set({
          connection: 'error',
          errorMessage:
            'Could not reach the matchmaking relays. Check your internet connection.',
        });
        return;
      }
      const startedAt = Date.now();
      set({
        connection: 'connecting',
        role: 'guest',
        myDisplayName: name,
        roomCode: upper,
        lobby: emptyLobby(),
        chat: [],
        errorMessage: null,
        joinStartedAt: startedAt,
        joinFailure: null,
      });
      // If no host has answered with a lobby/start/snapshot by then, report
      // the room as not found (with what this device could see) rather than
      // sitting in an empty-looking room.
      joinTimeoutId = setTimeout(() => {
        joinTimeoutId = null;
        if (get().connection !== 'connecting') return;
        const relays = bindings?.relayStatus() ?? relayStatus();
        const failure: JoinFailure = {
          code: upper,
          reason: relays.connected === 0 ? 'noRelays' : peersSeenWhileJoining > 0 ? 'noHost' : 'notFound',
          relays,
          peersSeen: peersSeenWhileJoining,
          waitedMs: Date.now() - startedAt,
        };
        try {
          bindings?.leave();
        } catch {
          /* ignore */
        }
        bindings = null;
        set({
          connection: 'error',
          errorMessage: JOIN_FAILURE_TEXT[failure.reason](upper),
          joinFailure: failure,
          joinStartedAt: null,
        });
      }, JOIN_TIMEOUT_MS);
    },

    retryJoin: () => {
      const code = get().joinFailure?.code ?? get().roomCode;
      if (code) get().joinRoom(code, get().myDisplayName);
    },

    relayStatus: () => bindings?.relayStatus() ?? relayStatus(),

    leaveRoom: () => {
      clearJoinTimeout();
      try {
        bindings?.leave();
      } catch {
        /* ignore */
      }
      bindings = null;
      seatToUuid = [];
      set({
        connection: 'disconnected',
        errorMessage: null,
        role: 'solo',
        roomCode: null,
        hostUuid: null,
        joinStartedAt: null,
        joinFailure: null,
        lobby: emptyLobby(),
        uuidByPeerId: {},
        onlineUuids: new Set([get().myUuid]),
        chat: [],
      });
    },

    clearError: () => {
      set({ connection: 'disconnected', errorMessage: null, joinFailure: null, roomCode: null });
    },

    hostAddAISeat: () => {
      if (get().role !== 'host') return;
      const lobby = get().lobby;
      if (lobby.seats.length >= MAX_SEATS) return;
      const seats: LobbySeat[] = [
        ...lobby.seats,
        {
          uuid: null,
          name: `AI ${lobby.seats.filter((s) => s.isAI).length + 1}`,
          isAI: true,
          color: freeColor(lobby.seats),
        },
      ];
      const newLobby = { ...lobby, seats };
      set({ lobby: newLobby });
      bindings?.sendLobby(newLobby);
    },

    hostRemoveSeat: (slot) => {
      if (get().role !== 'host') return;
      const lobby = get().lobby;
      if (slot === 0) return; // can't remove host
      if (slot < 0 || slot >= lobby.seats.length) return;
      const seats = lobby.seats.filter((_, i) => i !== slot);
      const newLobby = { ...lobby, seats };
      set({ lobby: newLobby });
      bindings?.sendLobby(newLobby);
    },

    hostSetVP: (vp) => {
      if (get().role !== 'host') return;
      const newLobby = { ...get().lobby, victoryPointsToWin: vp };
      set({ lobby: newLobby });
      bindings?.sendLobby(newLobby);
    },

    hostSetAiLevel: (level) => {
      if (get().role !== 'host') return;
      const newLobby = { ...get().lobby, aiLevel: level };
      set({ lobby: newLobby });
      bindings?.sendLobby(newLobby);
    },

    hostStartGame: () => {
      if (get().role !== 'host') return;
      const lobby = get().lobby;
      if (lobby.seats.length < MIN_SEATS) return;
      cacheSeatToUuidFromLobby(lobby);
      const game = createGame({
        playerNames: lobby.seats.map((s) => s.name),
        playerTypes: lobby.seats.map((s) => (s.isAI ? 'ai' : 'human')),
        seed: lobby.seed,
        settings: { victoryPointsToWin: lobby.victoryPointsToWin, aiLevel: lobby.aiLevel ?? DEFAULT_AI_LEVEL },
      });
      useGameStore.getState().setGameState(game);
      set({
        connection: 'in-game',
        chat: [...get().chat, sysMessage('Game started', get().myUuid)],
      });
      bindings?.sendStart({
        gameState: game,
        seatUuids: seatToUuid.slice(),
        hostUuid: get().myUuid,
      });
    },

    sendChat: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const msg = userMessage(trimmed, get().myUuid, get().myDisplayName);
      set({ chat: [...get().chat, msg] });
      bindings?.sendChat(msg);
    },

    uuidForPlayer: (playerId) => {
      // 'p0' → seatToUuid[0]
      const idx = Number(playerId.slice(1));
      return seatToUuid[idx] ?? null;
    },

    isOnlinePlayer: (playerId: PlayerId): boolean => {
      const state = get();
      const uuid = state.uuidForPlayer(playerId);
      if (!uuid) return false;
      return state.onlineUuids.has(uuid);
    },
  };
});

// Helper: are we currently controlling player `pid`?
export function isMyPlayer(playerId: PlayerId): boolean {
  const s = useNetworkStore.getState();
  if (s.connection === 'disconnected' || s.role === 'solo') return true;
  const uuid = s.uuidForPlayer(playerId);
  return uuid === s.myUuid;
}

// Helper: the player UUID for our local seat, or null if spectator / not started.
export function getMyPlayerId(game: GameState | null): PlayerId | null {
  if (!game) return null;
  const s = useNetworkStore.getState();
  if (s.connection === 'disconnected' || s.role === 'solo') {
    return null; // hot-seat: many players on one device, no single "me"
  }
  // Find seat for our UUID
  for (let i = 0; i < game.players.length; i++) {
    if (s.uuidForPlayer(`p${i}`) === s.myUuid) return `p${i}`;
  }
  return null;
}
