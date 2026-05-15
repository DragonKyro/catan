import { joinRoom, type Room } from 'trystero/torrent';
import type {
  HelloMessage,
  LobbyState,
  ActionEnvelope,
  SnapshotMessage,
  SnapshotRequestMessage,
  ChatMessage,
} from './types';
import type { GameState } from '@/game/types';

const APP_ID = 'catan-friends-v1';

export interface RoomBindings {
  room: Room;
  sendHello: (msg: HelloMessage, target?: string) => void;
  recvHello: (cb: (msg: HelloMessage, peerId: string) => void) => void;
  sendLobby: (state: LobbyState, target?: string) => void;
  recvLobby: (cb: (state: LobbyState, peerId: string) => void) => void;
  sendStart: (state: GameState) => void;
  recvStart: (cb: (state: GameState, peerId: string) => void) => void;
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
  leave: () => void;
}

// Create or join a Trystero room and return typed send/receive bindings for
// every channel the app uses. The room code is also used as a password so
// E2E encryption keeps messages private from other rooms on the BT network.
export function bindRoom(roomCode: string): RoomBindings {
  const room = joinRoom({ appId: APP_ID, password: roomCode }, roomCode);

  // Trystero requires payloads to be JSON-indexable objects; we erase the
  // generic and cast at our typed boundary below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyData = any;
  const [sendHello, recvHello] = room.makeAction<AnyData>('hello');
  const [sendLobby, recvLobby] = room.makeAction<AnyData>('lobby');
  const [sendStart, recvStart] = room.makeAction<AnyData>('start');
  const [sendAction, recvAction] = room.makeAction<AnyData>('action');
  const [sendSnapshotRequest, recvSnapshotRequest] =
    room.makeAction<AnyData>('snapReq');
  const [sendSnapshot, recvSnapshot] = room.makeAction<AnyData>('snap');
  const [sendChat, recvChat] = room.makeAction<AnyData>('chat');

  return {
    room,
    sendHello: (m, t) => void sendHello(m as never, t),
    recvHello: (cb) => recvHello((data, peerId) => cb(data as HelloMessage, peerId)),
    sendLobby: (s, t) => void sendLobby(s as never, t),
    recvLobby: (cb) => recvLobby((data, peerId) => cb(data as LobbyState, peerId)),
    sendStart: (s) => void sendStart(s as never),
    recvStart: (cb) => recvStart((data, peerId) => cb(data as GameState, peerId)),
    sendAction: (e) => void sendAction(e as never),
    recvAction: (cb) =>
      recvAction((data, peerId) => cb(data as ActionEnvelope, peerId)),
    sendSnapshotRequest: (m, t) => void sendSnapshotRequest(m as never, t),
    recvSnapshotRequest: (cb) =>
      recvSnapshotRequest((data, peerId) =>
        cb(data as SnapshotRequestMessage, peerId),
      ),
    sendSnapshot: (m, target) => void sendSnapshot(m as never, target),
    recvSnapshot: (cb) =>
      recvSnapshot((data, peerId) => cb(data as SnapshotMessage, peerId)),
    sendChat: (m) => void sendChat(m as never),
    recvChat: (cb) => recvChat((data, peerId) => cb(data as ChatMessage, peerId)),
    onPeerJoin: (cb) => room.onPeerJoin(cb),
    onPeerLeave: (cb) => room.onPeerLeave(cb),
    leave: () => room.leave(),
  };
}
