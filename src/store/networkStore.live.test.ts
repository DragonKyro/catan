// @vitest-environment node
//
// Online play against the real Firebase project (catan-33623), each "device"
// with its own Firebase app and anonymous sign-in. Skipped unless
// FIREBASE_LIVE=1:
//
//   FIREBASE_LIVE=1 npx vitest run src/store/networkStore.live.test.ts
//
// The rules don't let clients delete rooms, so it prints the room codes it
// used; remove them afterwards with `firebase database:remove /rooms/<CODE>`.
// Each run also leaves a few anonymous users in Firebase Auth (harmless).

import { afterAll, describe, expect, it, vi } from 'vitest';
import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, ref, remove } from 'firebase/database';
import { execSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chooseAction } from '@/ai';
import { getActingPlayerId } from '@/game/helpers';
import type { Action } from '@/game/types';

const LIVE = process.env.FIREBASE_LIVE === '1';

vi.mock('@/net/firebaseRoom', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/net/firebaseRoom')>();
  let transport: ReturnType<typeof real.createFirebaseTransport> | null = null;
  return {
    ...real,
    getTransport: () =>
      (transport ??= real.createFirebaseTransport({
        appName: `device-${Math.random().toString(36).slice(2)}`,
        persistence: 'memory',
      })),
  };
});

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
vi.stubGlobal('localStorage', memoryStorage());

const run = `${Date.now().toString(36)}`;
const rooms: string[] = [];

async function device(name: string) {
  vi.resetModules();
  const uuid = `live-${run}-${name}`;
  localStorage.setItem('catan.uuid', uuid);
  const netModule = await import('@/store/networkStore');
  const { useGameStore } = await import('@/store/gameStore');
  const { useLogStore } = await import('@/store/logStore');
  return {
    uuid,
    name,
    net: () => netModule.useNetworkStore.getState(),
    game: () => useGameStore.getState(),
    log: () => useLogStore.getState(),
  };
}
type Device = Awaited<ReturnType<typeof device>>;

const until = (f: () => void, timeout = 20000) => vi.waitFor(f, { timeout, interval: 50 });

function inStep(devices: Device[]) {
  const [first, ...rest] = devices;
  for (const d of rest) {
    expect(d.log().actions.length).toBe(first!.log().actions.length);
    expect(d.game().game).toEqual(first!.game().game);
  }
}

let seed = 7;
const die = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return 1 + (seed % 6);
};

async function playMove(devices: Device[]) {
  const host = devices[0]!;
  const state = host.game().game!;
  const acting = getActingPlayerId(state);
  const owner = devices.find((d) => host.net().uuidForPlayer(acting) === d.uuid) ?? host;
  let action: Action = chooseAction(owner.game().game!, acting) ?? { type: 'endTurn', playerId: acting };
  if (action.type === 'rollDice') action = { ...action, dice: [die(), die()] };
  const before = owner.log().actions.length;
  owner.game().dispatch(action);
  const target = owner.log().actions.length;
  expect(target).toBe(before + 1);
  await until(() => devices.forEach((d) => expect(d.log().actions.length).toBe(target)));
}

describe.skipIf(!LIVE)('online play on the real Firebase project', () => {
  const all: Device[] = [];

  afterAll(async () => {
    all.forEach((d) => d.net().leaveRoom());
    console.log(`[live] rooms used: ${rooms.join(', ')}`);
  });

  it('create, join, choose Seafarers, start, play, race, rejoin', async () => {
    const host = await device('host');
    all.push(host);
    await host.net().createRoom('Hana');
    await until(() => expect(host.net().connection).toBe('lobby'));
    const code = host.net().roomCode!;
    rooms.push(code);

    const guest = await device('guest');
    all.push(guest);
    await guest.net().joinRoom(code, 'Gus');
    await until(() => expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'Gus']));
    await until(() => expect(guest.net().connection).toBe('lobby'));
    await until(() => expect(host.net().onlineUuids.has(guest.uuid)).toBe(true));

    // Unknown code: an immediate, definite answer.
    const lost = await device('lost');
    await lost.net().joinRoom('Q9Q9', 'Lo');
    expect(lost.net().joinFailure).toMatchObject({ reason: 'notFound' });

    host.net().hostAddAISeat();
    host.net().hostAddAISeat();
    host.net().hostSetGame({ ...host.net().lobby.game, seafarers: true, scenarioId: 'headingForNewShores' });
    await until(() => {
      expect(guest.net().lobby.seats).toHaveLength(4);
      expect(guest.net().lobby.game.seafarers).toBe(true);
    });

    await host.net().hostStartGame();
    await until(() => expect(guest.net().connection).toBe('in-game'));
    expect(guest.net().role).toBe('guest');
    expect(guest.game().game!.settings.scenarioId).toBe('headingForNewShores');
    inStep([host, guest]);

    for (let i = 0; i < 40; i++) await playMove([host, guest]);
    inStep([host, guest]);

    // The guest drops out and comes back: full game and history.
    guest.net().leaveRoom();
    await until(() => expect(host.net().onlineUuids.has(guest.uuid)).toBe(false));
    const back = await device('guest');
    all.push(back);
    await back.net().joinRoom(code, 'Gus');
    await until(() => expect(back.net().connection).toBe('in-game'));
    await until(() => expect(back.log().actions.length).toBe(host.log().actions.length));
    expect(back.net().role).toBe('guest');
    inStep([host, back]);
    for (let i = 0; i < 10; i++) await playMove([host, back]);
    inStep([host, back]);

    // A stranger spectates.
    const stranger = await device('stranger');
    all.push(stranger);
    await stranger.net().joinRoom(code, 'Sam');
    await until(() => expect(stranger.log().actions.length).toBe(host.log().actions.length));
    expect(stranger.net().role).toBe('spectator');
    inStep([host, stranger]);
  }, 180000);

  it('the rules: write-once log slots, host-only start, no overwriting a live room', async () => {
    const { createFirebaseTransport } = await vi.importActual<typeof import('@/net/firebaseRoom')>('@/net/firebaseRoom');
    const a = createFirebaseTransport({ appName: `rules-a-${run}`, persistence: 'memory' });
    const b = createFirebaseTransport({ appName: `rules-b-${run}`, persistence: 'memory' });
    const noop = { lobby: () => {}, start: () => {}, action: () => {}, chat: () => {}, presence: () => {}, connected: () => {} };
    const code = `T${run.slice(-3).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;
    rooms.push(code);
    const lobby = { hostUuid: 'ua', seats: [], victoryPointsToWin: null, seed: 1, game: { seafarers: false, scenarioId: 'x', baseScenarioId: 'standard' } };
    const ca = await a.createRoom(code, { hostUuid: 'ua', createdAt: Date.now(), build: 'live-test' }, lobby, { uuid: 'ua', name: 'A' }, noop);
    expect(ca).not.toBeNull();
    // Someone else can't take over the code.
    expect(await b.createRoom(code, { hostUuid: 'ub', createdAt: Date.now(), build: 'live-test' }, lobby, { uuid: 'ub', name: 'B' }, noop)).toBeNull();
    const cb = (await b.joinRoom(code, { uuid: 'ub', name: 'B' }, noop))!;
    expect(cb).not.toBeNull();
    // Only the host starts; nobody writes moves before the start.
    const entry = { action: { type: 'endTurn', playerId: 'p0' } as Action, nonce: 'n1', at: Date.now() };
    await expect(ca!.appendAction(0, entry)).rejects.toThrow(/permission/i);
    const start = {
      options: { playerNames: ['A', 'B'], seed: 1 },
      seatUuids: ['ua', 'ub'],
      hostUuid: 'ua',
      startedAt: Date.now(),
      check: 'test',
    };
    await expect(cb.start(start)).rejects.toThrow(/permission/i);
    await ca!.start(start);
    // Both race for slot 0: exactly one wins; slot 1 is then free.
    const results = await Promise.all([
      ca!.appendAction(0, entry),
      cb.appendAction(0, { ...entry, nonce: 'n2' }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await cb.appendAction(1, { ...entry, nonce: 'n3' })).toBe(true);
    expect(await ca!.appendAction(1, { ...entry, nonce: 'n4' })).toBe(false);
    // The lobby is closed once the game has started.
    await expect(cb.updateLobby((l) => ({ ...l, seed: 2 }))).rejects.toThrow(/permission/i);
    ca!.leave();
    cb.leave();
  }, 60000);

  it('week-old rooms are cleared unless someone is still in them; younger codes stay private', async () => {
    const real = await vi.importActual<typeof import('@/net/firebaseRoom')>('@/net/firebaseRoom');
    const app = initializeApp(real.FIREBASE_CONFIG, `sweep-raw-${run}`);
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const uid = (await signInAnonymously(auth)).user.uid;
    const db = getDatabase(app);
    const DAY = 24 * 60 * 60 * 1000;
    const tag = run.slice(-3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
    const [idle, busy] = [`O${tag}`, `P${tag}`];
    // Clients can't plant an old day (that's the point), so plant it as admin with the CLI.
    const oldDay = Math.floor(Date.now() / DAY) - 9;
    const room = { meta: { hostUuid: 'raw', hostUid: uid, createdAt: oldDay * DAY + 3_600_000, build: 'live-test', v: 2 }, lobby: '{}' };
    const plant = {
      [`roomDays/${oldDay}`]: (oldDay + 1) * DAY,
      [`roomIndex/${oldDay}/${idle}`]: true,
      [`roomIndex/${oldDay}/${busy}`]: true,
      [`rooms/${idle}`]: room,
      [`rooms/${busy}`]: { ...room, presence: { raw: { uid, uuid: 'raw', name: 'Still here' } } },
    };
    const file = join(tmpdir(), `catan-plant-${run}.json`);
    writeFileSync(file, JSON.stringify(plant));
    execSync(`npx -y firebase-tools@latest database:update / "${file}" --project catan-33623 --force`, { stdio: 'ignore' });
    unlinkSync(file);

    // Anyone can see which days have rooms, but not a recent day's codes, and can't delete a live room.
    expect((await get(ref(db, `roomDays/${oldDay}`))).val()).toBe((oldDay + 1) * DAY);
    const host = real.createFirebaseTransport({ appName: `sweep-host-${run}`, persistence: 'memory' });
    const noop = { lobby: () => {}, start: () => {}, action: () => {}, chat: () => {}, presence: () => {}, connected: () => {} };
    const code = `S${tag}`;
    rooms.push(code);
    const lobby = { hostUuid: 'h', seats: [], victoryPointsToWin: null, seed: 1, game: { seafarers: false, scenarioId: 'x', baseScenarioId: 'standard' } };
    // Making a room sweeps: the idle week-old room goes, the busy one (and its day) stay.
    const c = await host.createRoom(code, { hostUuid: 'h', createdAt: Date.now(), build: 'live-test' }, lobby, { uuid: 'h', name: 'H' }, noop);
    expect(c).not.toBeNull();
    await expect(get(ref(db, `roomIndex/${Math.floor(Date.now() / DAY)}`))).rejects.toThrow(/permission/i);
    await expect(remove(ref(db, `rooms/${code}`))).rejects.toThrow(/permission/i);
    await vi.waitFor(async () => expect((await get(ref(db, `rooms/${idle}/meta`))).exists()).toBe(false), { timeout: 15000 });
    expect((await get(ref(db, `rooms/${busy}/meta`))).exists()).toBe(true);
    expect((await get(ref(db, `roomDays/${oldDay}`))).exists()).toBe(true);

    // Once the last device leaves, the next sweep clears it and its day.
    await remove(ref(db, `rooms/${busy}/presence/raw`));
    expect(await real.sweepStaleRooms(db)).toContain(busy);
    expect((await get(ref(db, `rooms/${busy}/meta`))).exists()).toBe(false);
    expect((await get(ref(db, `roomDays/${oldDay}`))).exists()).toBe(false);
    c!.leave();
  }, 90000);
});
