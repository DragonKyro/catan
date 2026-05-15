import { create } from 'zustand';
import type { Action, GameState, PlayerColor, PlayerId } from '@/game/types';
import { createGame } from '@/game/createGame';
import {
  bindRoom,
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

const DEFAULT_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white', 'purple', 'pink'];
const DEFAULT_VP = 10;
const MAX_SEATS = 6;
const MIN_SEATS = 3;
const SYSTEM_NAME = 'System';

interface NetStore {
  connection: ConnectionState;
  role: LocalRole;
  myUuid: string;
  myDisplayName: string;
  roomCode: string | null;
  hostUuid: string | null;
  lobby: LobbyState;
  uuidByPeerId: Record<string, string>;
  onlineUuids: Set<string>;
  chat: ChatMessage[];

  setDisplayName: (name: string) => void;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  leaveRoom: () => void;

  hostAddAISeat: () => void;
  hostRemoveSeat: (slot: number) => void;
  hostSetVP: (vp: number) => void;
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
      // Authoritative from host — overwrite ours.
      set({
        lobby: state,
        hostUuid: state.seats[0]?.uuid ?? null,
        connection: get().connection === 'connecting' ? 'lobby' : get().connection,
      });
    });

    b.recvStart((initialState) => {
      // Host kicked off the game; cache seat→UUID mapping then enter.
      cacheSeatToUuidFromLobby(get().lobby);
      useGameStore.getState().setGameState(initialState);
      set({
        connection: 'in-game',
        chat: [...get().chat, sysMessage('Game started', get().myUuid)],
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
    role: 'solo',
    myUuid,
    myDisplayName: myDisplayName || 'Player',
    roomCode: null,
    hostUuid: null,
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
        seed: Math.floor(Math.random() * 0xffffffff),
      };
      const b = bindRoom(code);
      attachBindings(b, true);
      set({
        connection: 'lobby',
        role: 'host',
        myDisplayName: name,
        roomCode: code,
        hostUuid: uuid,
        lobby: initialLobby,
        onlineUuids: new Set([uuid]),
        chat: [],
      });
    },

    joinRoom: (code, name) => {
      saveDisplayName(name);
      const b = bindRoom(code.toUpperCase());
      attachBindings(b, false);
      set({
        connection: 'connecting',
        role: 'guest',
        myDisplayName: name,
        roomCode: code.toUpperCase(),
        chat: [],
      });
      // Send hello to whatever peers we discover; we'll get the lobby back.
      // Onpeerjoin handlers will send the hello automatically when peers arrive.
      // Defer flipping to 'lobby' until we've actually seen the lobby state.
      // Allow a small grace period; if a lobby arrives, recvLobby handles it.
      setTimeout(() => {
        if (get().connection === 'connecting') {
          // No peers yet — treat as a "no such room" timeout but still let user wait.
          // We don't error out; we just wait. The UI will show "connecting".
        }
      }, 100);
    },

    leaveRoom: () => {
      try {
        bindings?.leave();
      } catch {
        /* ignore */
      }
      bindings = null;
      seatToUuid = [];
      set({
        connection: 'disconnected',
        role: 'solo',
        roomCode: null,
        hostUuid: null,
        lobby: emptyLobby(),
        uuidByPeerId: {},
        onlineUuids: new Set([get().myUuid]),
        chat: [],
      });
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

    hostStartGame: () => {
      if (get().role !== 'host') return;
      const lobby = get().lobby;
      if (lobby.seats.length < MIN_SEATS) return;
      cacheSeatToUuidFromLobby(lobby);
      const game = createGame({
        playerNames: lobby.seats.map((s) => s.name),
        playerTypes: lobby.seats.map((s) => (s.isAI ? 'ai' : 'human')),
        seed: lobby.seed,
        settings: { victoryPointsToWin: lobby.victoryPointsToWin },
      });
      useGameStore.getState().setGameState(game);
      set({
        connection: 'in-game',
        chat: [...get().chat, sysMessage('Game started', get().myUuid)],
      });
      bindings?.sendStart(game);
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
