// Trystero's Nostr strategy (@trystero-p2p/nostr) uses WebSocket connections
// to public Nostr relays on port 443 for peer discovery. This works on mobile
// carriers, corporate networks, hotel WiFi, and anywhere else that allows
// HTTPS — which is virtually everywhere. (The earlier `torrent` strategy used
// BitTorrent trackers, which most mobile carriers and many home routers block.)
//
// Trystero 0.26+ is required: 0.20 reconnected a dropped relay socket but
// never re-sent the room subscription on it, so a phone whose page had been in
// the background could still announce itself but never hear anyone again
// (the guest saw nobody; the host never saw the guest). 0.26 resubscribes,
// caps the reconnect backoff at 60 s, and pauses / resumes on offline / online.
import {
  getRelaySockets,
  joinRoom,
  pauseRelayReconnection,
  resumeRelayReconnection,
} from '@trystero-p2p/nostr';
import type {
  HelloMessage,
  LobbyState,
  StartMessage,
  ActionEnvelope,
  SnapshotMessage,
  SnapshotRequestMessage,
  ChatMessage,
} from './types';

export const APP_ID = 'catan-friends-v1';

// Relays used for discovery: every device derives the same list from APP_ID
// (Trystero's built-in list, shuffled by app id), so more of them means more
// shared relays still working as public relays come and go. Trystero's
// default is 5. Changing this (or APP_ID) changes which relays devices meet
// on, so old and new builds wouldn't find each other.
const RELAY_REDUNDANCY = 8;

/** Base config for every room this app joins (game rooms and the network test). */
export const ROOM_CONFIG = { appId: APP_ID, relayConfig: { redundancy: RELAY_REDUNDANCY } } as const;

/** Relay WebSockets currently open, out of those this page uses. */
export interface RelayStatus {
  connected: number;
  total: number;
}

export interface RoomBindings {
  sendHello: (msg: HelloMessage, target?: string) => void;
  recvHello: (cb: (msg: HelloMessage, peerId: string) => void) => void;
  sendLobby: (state: LobbyState, target?: string) => void;
  recvLobby: (cb: (state: LobbyState, peerId: string) => void) => void;
  sendStart: (msg: StartMessage) => void;
  recvStart: (cb: (msg: StartMessage, peerId: string) => void) => void;
  sendAction: (envelope: ActionEnvelope) => void;
  recvAction: (cb: (envelope: ActionEnvelope, peerId: string) => void) => void;
  sendSnapshotRequest: (msg: SnapshotRequestMessage, target?: string) => void;
  recvSnapshotRequest: (cb: (msg: SnapshotRequestMessage, peerId: string) => void) => void;
  sendSnapshot: (msg: SnapshotMessage, target: string) => void;
  recvSnapshot: (cb: (msg: SnapshotMessage, peerId: string) => void) => void;
  sendChat: (msg: ChatMessage) => void;
  recvChat: (cb: (msg: ChatMessage, peerId: string) => void) => void;
  onPeerJoin: (cb: (peerId: string) => void) => void;
  onPeerLeave: (cb: (peerId: string) => void) => void;
  /** For diagnostics: relay connections, and peers connected in this room. */
  relayStatus: () => RelayStatus;
  peerCount: () => number;
  leave: () => void;
}

// Trystero payloads must be JSON values; our message interfaces are, but TS
// interfaces don't satisfy its index-signature type, so we erase the generic
// and cast at the typed boundary below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

/** Every relay this page has opened, open or not (keyed by URL). */
export function relaySockets(): Record<string, WebSocket> {
  return (getRelaySockets() ?? {}) as Record<string, WebSocket>;
}

export function relayStatus(): RelayStatus {
  const sockets = Object.values(relaySockets());
  return {
    connected: sockets.filter((s) => s.readyState === WebSocket.OPEN).length,
    total: sockets.length,
  };
}

// Phones pause pages in the background and may drop their sockets meanwhile
// (e.g. while the host is in another app sending the room code). While hidden,
// hold relay reconnection but let it through every HIDDEN_RETRY_MS (desktop
// tabs keep running in the background and should stay reachable); on return,
// reconnect at once instead of waiting out the backoff.
const HIDDEN_RETRY_MS = 30_000;
let watchingVisibility = false;

function watchPageVisibility(): void {
  if (watchingVisibility || typeof document === 'undefined') return;
  watchingVisibility = true;
  let hiddenRetry: ReturnType<typeof setInterval> | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseRelayReconnection();
      hiddenRetry ??= setInterval(() => {
        resumeRelayReconnection();
        // Re-pause after the release settles (it clears asynchronously).
        setTimeout(() => document.visibilityState === 'hidden' && pauseRelayReconnection(), 0);
      }, HIDDEN_RETRY_MS);
    } else {
      if (hiddenRetry !== null) clearInterval(hiddenRetry);
      hiddenRetry = null;
      resumeRelayReconnection();
    }
  });
}

// Create or join a Trystero room and return typed send/receive bindings for
// every channel the app uses. The room code is also used as a password so
// E2E encryption keeps messages private from other rooms on the relays.
export function bindRoom(roomCode: string): RoomBindings {
  watchPageVisibility();
  const room = joinRoom({ ...ROOM_CONFIG, password: roomCode }, roomCode);

  const channel = <T,>(name: string) => {
    const action = room.makeAction<AnyData>(name);
    return {
      send: (data: T, target?: string) => {
        action.send(data as AnyData, target ? { target } : undefined).catch((e: Error) =>
          console.warn(`[net] ${name} send failed:`, e.message),
        );
      },
      recv: (cb: (data: T, peerId: string) => void) => {
        action.onMessage = (data, ctx) => cb(data as T, ctx.peerId);
      },
    };
  };
  const hello = channel<HelloMessage>('hello');
  const lobby = channel<LobbyState>('lobby');
  const start = channel<StartMessage>('start');
  const action = channel<ActionEnvelope>('action');
  const snapReq = channel<SnapshotRequestMessage>('snapReq');
  const snap = channel<SnapshotMessage>('snap');
  const chat = channel<ChatMessage>('chat');

  return {
    sendHello: hello.send,
    recvHello: hello.recv,
    sendLobby: lobby.send,
    recvLobby: lobby.recv,
    sendStart: (m) => start.send(m),
    recvStart: start.recv,
    sendAction: (e) => action.send(e),
    recvAction: action.recv,
    sendSnapshotRequest: snapReq.send,
    recvSnapshotRequest: snapReq.recv,
    sendSnapshot: snap.send,
    recvSnapshot: snap.recv,
    sendChat: (m) => chat.send(m),
    recvChat: chat.recv,
    onPeerJoin: (cb) => {
      room.onPeerJoin = cb;
    },
    onPeerLeave: (cb) => {
      room.onPeerLeave = cb;
    },
    relayStatus,
    peerCount: () => Object.keys(room.getPeers()).length,
    leave: () => {
      room.leave().catch((e: Error) => console.warn('[net] leave failed:', e.message));
    },
  };
}
