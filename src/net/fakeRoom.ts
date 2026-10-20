// Test-only: an in-memory stand-in for room.ts (vi.mock('@/net/room', ...)).
// Each "device" in a test is its own module graph (vi.resetModules) with its
// own stores; they all bind into one hub on globalThis, so a host and guests
// in one test find and message each other the way peers on the relays do.
// Messages go through JSON (as on the wire) and arrive asynchronously.
// `fakeHub().relaysUp = false` models a device that can't reach any relay:
// rooms bound while it's down see nobody. Not imported by production code.

import type { RelayStatus, RoomBindings } from './room';

type Handler = (data: unknown, from: string) => void;

interface FakePeer {
  id: string;
  code: string;
  handlers: Map<string, Handler>;
  onJoin: (peerId: string) => void;
  onLeave: (peerId: string) => void;
}

interface Hub {
  peers: Map<string, FakePeer>;
  relaysUp: boolean;
  nextId: number;
}

const RELAYS = 5;
const HUB_KEY = '__catanFakeNetHub';

export function fakeHub(): Hub {
  const g = globalThis as unknown as Record<string, Hub | undefined>;
  return (g[HUB_KEY] ??= { peers: new Map(), relaysUp: true, nextId: 0 });
}

export function resetFakeHub(): void {
  delete (globalThis as unknown as Record<string, Hub | undefined>)[HUB_KEY];
}

const later = (f: () => void) => {
  void Promise.resolve().then(f);
};

export const APP_ID = 'catan-friends-v1';
export const ROOM_CONFIG = { appId: APP_ID, relayConfig: { redundancy: RELAYS } } as const;
export const relaySockets = (): Record<string, WebSocket> => ({});
export const relayStatus = (): RelayStatus => ({ connected: fakeHub().relaysUp ? RELAYS : 0, total: RELAYS });

export function bindRoom(code: string): RoomBindings {
  const hub = fakeHub();
  const me: FakePeer = { id: `peer-${hub.nextId++}`, code, handlers: new Map(), onJoin: () => {}, onLeave: () => {} };
  const others = () => [...hub.peers.values()].filter((p) => p.code === code && p.id !== me.id);
  if (hub.relaysUp) {
    for (const p of others()) {
      later(() => p.onJoin(me.id));
      later(() => me.onJoin(p.id));
    }
    hub.peers.set(me.id, me);
  }

  const send = (channel: string) => (data: unknown, target?: string) => {
    if (!hub.peers.has(me.id)) return;
    const wire = JSON.stringify(data);
    for (const p of others()) {
      if (target && p.id !== target) continue;
      later(() => {
        if (hub.peers.has(p.id)) p.handlers.get(channel)?.(JSON.parse(wire), me.id);
      });
    }
  };
  const recv = <T,>(channel: string) => (cb: (data: T, from: string) => void) => {
    me.handlers.set(channel, cb as Handler);
  };

  return {
    sendHello: send('hello'),
    recvHello: recv('hello'),
    sendLobby: send('lobby'),
    recvLobby: recv('lobby'),
    sendStart: send('start'),
    recvStart: recv('start'),
    sendAction: send('action'),
    recvAction: recv('action'),
    sendSnapshotRequest: send('snapReq'),
    recvSnapshotRequest: recv('snapReq'),
    sendSnapshot: send('snap'),
    recvSnapshot: recv('snap'),
    sendChat: send('chat'),
    recvChat: recv('chat'),
    onPeerJoin: (cb) => {
      me.onJoin = cb;
    },
    onPeerLeave: (cb) => {
      me.onLeave = cb;
    },
    relayStatus,
    peerCount: () => (hub.peers.has(me.id) ? others().length : 0),
    leave: () => {
      if (!hub.peers.delete(me.id)) return;
      for (const p of others()) later(() => p.onLeave(me.id));
    },
  };
}
