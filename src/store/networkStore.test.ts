import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseAction } from '@/ai';
import { getActingPlayerId } from '@/game/helpers';
import type { Action } from '@/game/types';
import { fakeHub, resetFakeHub } from '@/net/fakeRoom';

// Online play end to end over the in-memory network (src/net/fakeRoom.ts):
// every device is a fresh copy of the stores, as if on its own phone.
vi.mock('@/net/room', () => import('@/net/fakeRoom'));

async function device(uuid: string) {
  vi.resetModules();
  localStorage.setItem('catan.uuid', uuid);
  const netModule = await import('@/store/networkStore');
  const { useGameStore } = await import('@/store/gameStore');
  return {
    net: () => netModule.useNetworkStore.getState(),
    game: () => useGameStore.getState(),
    joinTimeoutMs: netModule.JOIN_TIMEOUT_MS,
  };
}
type Device = Awaited<ReturnType<typeof device>>;

/** Let every message in flight (and the replies they trigger) land. */
async function flush() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

async function hostWithGuest() {
  const host = await device('host-uuid');
  host.net().createRoom('Hana');
  const code = host.net().roomCode!;
  const guest = await device('guest-uuid');
  guest.net().joinRoom(code, 'Gus');
  await flush();
  return { host, guest, code };
}

// Identity lives in localStorage; give each test its own (newer Node ships a
// global localStorage that shadows jsdom's and doesn't work without a file).
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (k) => items.get(k) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (k) => void items.delete(k),
    setItem: (k, v) => void items.set(k, String(v)),
  };
}

beforeEach(() => {
  resetFakeHub();
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('joining a room', () => {
  it('a guest finds the host and takes a seat, typed code and all', async () => {
    const host = await device('host-uuid');
    host.net().createRoom('Hana');
    const code = host.net().roomCode!;
    const guest = await device('guest-uuid');
    guest.net().joinRoom(` ${code.toLowerCase()} `, 'Gus');
    expect(guest.net().connection).toBe('connecting');
    expect(guest.net().lobby.seats).toEqual([]);
    await flush();
    expect(guest.net().connection).toBe('lobby');
    expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'Gus']);
    expect(guest.net().lobby).toEqual(host.net().lobby);
    expect(host.net().onlineUuids.has('guest-uuid')).toBe(true);
    expect(guest.net().joinStartedAt).toBeNull();
  });

  it('a code nobody hosts ends in "room not found", never an empty lobby', async () => {
    const guest = await device('guest-uuid');
    vi.useFakeTimers();
    guest.net().joinRoom('ZZZZ', 'Gus');
    await vi.advanceTimersByTimeAsync(guest.joinTimeoutMs - 1000);
    expect(guest.net().connection).toBe('connecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(guest.net().connection).toBe('error');
    expect(guest.net().joinFailure).toMatchObject({
      code: 'ZZZZ', reason: 'notFound', peersSeen: 0, relays: { connected: 5, total: 5 },
    });
    expect(guest.net().errorMessage).toMatch(/No room with code ZZZZ was found/);
  });

  it('other devices on the code but no host is reported as such', async () => {
    const a = await device('a-uuid');
    const b = await device('b-uuid');
    vi.useFakeTimers();
    a.net().joinRoom('QQQQ', 'Ann');
    b.net().joinRoom('QQQQ', 'Bo');
    await vi.advanceTimersByTimeAsync(a.joinTimeoutMs);
    for (const d of [a, b]) {
      expect(d.net().connection).toBe('error');
      expect(d.net().joinFailure).toMatchObject({ reason: 'noHost', peersSeen: 1 });
    }
  });

  it('no reachable relay is reported as a network problem; retrying once they are back finds the room', async () => {
    const host = await device('host-uuid');
    host.net().createRoom('Hana');
    const code = host.net().roomCode!;
    const guest = await device('guest-uuid');
    vi.useFakeTimers();
    fakeHub().relaysUp = false;
    guest.net().joinRoom(code, 'Gus');
    await vi.advanceTimersByTimeAsync(guest.joinTimeoutMs);
    expect(guest.net().joinFailure).toMatchObject({ code, reason: 'noRelays', relays: { connected: 0, total: 5 } });
    expect(guest.net().errorMessage).toMatch(/couldn't reach any of the matchmaking relays/);

    fakeHub().relaysUp = true;
    guest.net().retryJoin();
    await vi.advanceTimersByTimeAsync(0);
    expect(guest.net().connection).toBe('lobby');
    expect(guest.net().joinFailure).toBeNull();
    expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'Gus']);
    // The old search's timer is gone: no late "not found".
    await vi.advanceTimersByTimeAsync(guest.joinTimeoutMs * 2);
    expect(guest.net().connection).toBe('lobby');
  });

  it('cancelling a search stops it', async () => {
    const guest = await device('guest-uuid');
    vi.useFakeTimers();
    guest.net().joinRoom('ZZZZ', 'Gus');
    guest.net().leaveRoom();
    await vi.advanceTimersByTimeAsync(guest.joinTimeoutMs * 2);
    expect(guest.net().connection).toBe('disconnected');
    expect(guest.net().joinFailure).toBeNull();
  });
});

describe('playing online', () => {
  /** The next move for the acting seat, dispatched from the device that owns it (the host for AI seats). */
  async function playMove(host: Device, guest: Device) {
    const state = host.game().game!;
    const acting = getActingPlayerId(state);
    const owner = host.net().uuidForPlayer(acting) === 'guest-uuid' ? guest : host;
    let action: Action = chooseAction(owner.game().game!, acting) ?? { type: 'endTurn', playerId: acting };
    if (action.type === 'rollDice') action = { ...action, dice: [3, 4] };
    owner.game().dispatch(action);
    await flush();
  }

  it('the host starts the game for everyone, and moves reach every device', async () => {
    const { host, guest } = await hostWithGuest();
    host.net().hostAddAISeat();
    host.net().hostStartGame();
    await flush();
    expect(guest.net().connection).toBe('in-game');
    expect(guest.net().role).toBe('guest');
    expect(guest.game().game).toEqual(host.game().game);
    for (let i = 0; i < 12; i++) {
      await playMove(host, guest);
      expect(guest.game().game).toEqual(host.game().game);
    }
    expect(host.game().game!.phase).not.toBe('setupRound1');
  });

  it('a player who drops out mid-game gets the game back on rejoining; anyone else spectates', async () => {
    const { host, guest, code } = await hostWithGuest();
    host.net().hostAddAISeat();
    host.net().hostStartGame();
    await flush();
    await playMove(host, guest);
    guest.net().leaveRoom();
    await flush();
    expect(host.net().onlineUuids.has('guest-uuid')).toBe(false);

    const back = await device('guest-uuid');
    back.net().joinRoom(code, 'Gus');
    await flush();
    expect(back.net().connection).toBe('in-game');
    expect(back.net().role).toBe('guest');
    expect(back.game().game).toEqual(host.game().game);

    const stranger = await device('stranger-uuid');
    stranger.net().joinRoom(code, 'Sam');
    await flush();
    expect(stranger.net().role).toBe('spectator');
    expect(stranger.game().game).toEqual(host.game().game);
  });
});
