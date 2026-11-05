import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseAction } from '@/ai';
import { getActingPlayerId } from '@/game/helpers';
import type { Action, GameState, Resource } from '@/game/types';
import { fakeServer, releaseWrites, resetFakeServer } from '@/net/fakeTransport';

// Online play end to end over an in-memory server (src/net/fakeTransport.ts):
// every device is a fresh copy of the stores, as if on its own phone.
vi.mock('@/net/firebaseRoom', () => import('@/net/fakeTransport'));
// Whole games over the fake server: slow-ish, and slower still when the full suite runs in parallel.
vi.setConfig({ testTimeout: 60000 });

async function device(uuid: string) {
  vi.resetModules();
  localStorage.setItem('catan.uuid', uuid);
  const netModule = await import('@/store/networkStore');
  const { useGameStore } = await import('@/store/gameStore');
  const { useLogStore } = await import('@/store/logStore');
  return {
    uuid,
    net: () => netModule.useNetworkStore.getState(),
    game: () => useGameStore.getState(),
    log: () => useLogStore.getState(),
    setGame: (g: GameState) => useGameStore.setState({ game: g }),
  };
}
type Device = Awaited<ReturnType<typeof device>>;

/** Let every write in flight (and the events it triggers) land. */
async function flush() {
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function hostRoom(name = 'Hana') {
  const host = await device('host-uuid');
  await host.net().createRoom(name);
  await flush();
  return { host, code: host.net().roomCode! };
}

async function joinAs(uuid: string, name: string, code: string) {
  const d = await device(uuid);
  await d.net().joinRoom(code, name);
  await flush();
  return d;
}

// Seeded dice so games are repeatable.
function diceRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return 1 + (s % 6);
  };
  return (): [number, number] => [next(), next()];
}

/** The acting seat's next move, made on the device that owns it (the host for AI seats). */
async function playMove(devices: Device[], roll: () => [number, number]) {
  const host = devices[0]!;
  const state = host.game().game!;
  const acting = getActingPlayerId(state);
  const owner = devices.find((d) => host.net().uuidForPlayer(acting) === d.uuid) ?? host;
  let action: Action = chooseAction(owner.game().game!, acting) ?? { type: 'endTurn', playerId: acting };
  if (action.type === 'rollDice') action = { ...action, dice: roll() };
  owner.game().dispatch(action);
  await flush();
}

function expectInStep(devices: Device[]) {
  const [first, ...rest] = devices;
  const clock = (d: Device) => ({
    startTime: d.log().startTime,
    lastActionT: d.log().lastActionT,
    playerTime: d.log().playerTimeTotals,
    stepTimes: d.log().timeline.map((t) => t.t),
  });
  for (const d of rest) {
    expect(d.game().game).toEqual(first!.game().game);
    expect(d.log().actions).toEqual(first!.log().actions);
    // Same clock and time stats everywhere: they come from the room, not from when a device replayed it.
    expect(clock(d)).toEqual(clock(first!));
  }
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
  resetFakeServer();
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('joining a room', () => {
  it('a guest finds the room and takes a seat, typed code and all', async () => {
    const { host, code } = await hostRoom();
    expect(host.net().connection).toBe('lobby');
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    const guest = await device('guest-uuid');
    const joining = guest.net().joinRoom(` ${code.toLowerCase()} `, 'Gus');
    expect(guest.net().connection).toBe('connecting');
    expect(guest.net().lobby.seats).toEqual([]);
    await joining;
    await flush();
    expect(guest.net().connection).toBe('lobby');
    expect(guest.net().role).toBe('guest');
    expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'Gus']);
    expect(guest.net().lobby).toEqual(host.net().lobby);
    expect(host.net().onlineUuids.has('guest-uuid')).toBe(true);
    expect(host.net().chat.map((m) => m.text)).toContain('Gus joined');
  });

  it('a code with no room is reported at once, never as an empty lobby', async () => {
    const guest = await device('guest-uuid');
    await guest.net().joinRoom('ZZZZ', 'Gus');
    expect(guest.net().connection).toBe('error');
    expect(guest.net().joinFailure).toMatchObject({ code: 'ZZZZ', reason: 'notFound' });
    expect(guest.net().errorMessage).toMatch(/no room with code ZZZZ/);
  });

  it('an unreachable server is reported as a network problem; retrying once it is back finds the room', async () => {
    const { host, code } = await hostRoom();
    const guest = await device('guest-uuid');
    fakeServer().up = false;
    await guest.net().joinRoom(code, 'Gus');
    expect(guest.net().joinFailure).toMatchObject({ code, reason: 'unreachable' });
    expect(guest.net().errorMessage).toMatch(/Couldn't reach the game server/);

    fakeServer().up = true;
    guest.net().retryJoin();
    await flush();
    expect(guest.net().connection).toBe('lobby');
    expect(guest.net().joinFailure).toBeNull();
    expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'Gus']);
  });

  it('making a room clears rooms over a week old that nobody is in', async () => {
    // Over a week past the end of the day they were made.
    const age = 8 * 24 * 60 * 60 * 1000 + 1000;
    const { host: a, code: stale } = await hostRoom('Ann');
    a.net().leaveRoom();
    const { code: busy } = await hostRoom('Bea'); // still connected
    const { host: c, code: fresh } = await hostRoom('Cy');
    c.net().leaveRoom();
    await flush();
    fakeServer().rooms.get(stale)!.meta.createdAt -= age;
    fakeServer().rooms.get(busy)!.meta.createdAt -= age;
    await hostRoom('Dee');
    expect(fakeServer().rooms.has(stale)).toBe(false);
    expect(fakeServer().rooms.has(busy)).toBe(true);
    expect(fakeServer().rooms.has(fresh)).toBe(true);
    const late = await device('late-uuid');
    await late.net().joinRoom(stale, 'Lu');
    expect(late.net().errorMessage).toMatch(/cleared a week after/);
  });

  it('cancelling a join stops it', async () => {
    const { code } = await hostRoom();
    const guest = await device('guest-uuid');
    const joining = guest.net().joinRoom(code, 'Gus');
    guest.net().leaveRoom();
    await joining;
    await flush();
    expect(guest.net().connection).toBe('disconnected');
    expect(fakeServer().rooms.get(code)!.listeners.size).toBe(1); // just the host
  });

  it('a guest leaving the lobby frees their seat; the host removes seats and AI', async () => {
    const { host, code } = await hostRoom();
    const guest = await joinAs('guest-uuid', 'Gus', code);
    host.net().hostAddAISeat();
    host.net().hostAddAISeat();
    await flush();
    expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'Gus', 'AI 1', 'AI 2']);
    guest.net().leaveRoom();
    await flush();
    expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'AI 1', 'AI 2']);
    expect(host.net().onlineUuids.has('guest-uuid')).toBe(false);
    host.net().hostRemoveSeat(1);
    await flush();
    expect(host.net().lobby.seats.map((s) => s.name)).toEqual(['Hana', 'AI 2']);
  });

  it('players pick their own colors (taken ones swap), the host colors AI seats, and the game uses them', async () => {
    const { host, code } = await hostRoom();
    const guest = await joinAs('guest-uuid', 'Gus', code);
    host.net().hostAddAISeat();
    await flush();
    const colors = () => host.net().lobby.seats.map((s) => s.color);
    expect(colors()).toEqual(['red', 'blue', 'orange']);
    guest.net().setSeatColor(1, 'teal');
    await flush();
    expect(colors()).toEqual(['red', 'teal', 'orange']);
    // The host's red is taken: the two swap.
    guest.net().setSeatColor(1, 'red');
    await flush();
    expect(colors()).toEqual(['teal', 'red', 'orange']);
    // Nobody recolors someone else's seat; the host may recolor an AI seat.
    guest.net().setSeatColor(0, 'gold');
    guest.net().setSeatColor(2, 'gold');
    await flush();
    expect(colors()).toEqual(['teal', 'red', 'orange']);
    host.net().setSeatColor(2, 'gold');
    await flush();
    expect(colors()).toEqual(['teal', 'red', 'gold']);
    expect(guest.net().lobby.seats.map((s) => s.color)).toEqual(colors());
    await host.net().hostStartGame();
    await flush();
    expect(guest.game().game!.players.map((p) => p.color)).toEqual(['teal', 'red', 'gold']);
  });

  it("the host's game choice reaches every device and sets the seat range and VP target", async () => {
    const { host, code } = await hostRoom();
    const guest = await joinAs('guest-uuid', 'Gus', code);
    const { lobbyStartProblem, lobbyVp } = await import('@/store/lobbyGame');
    host.net().hostSetGame({ ...host.net().lobby.game, seafarers: true, scenarioId: 'headingForNewShores' });
    await flush();
    expect(guest.net().lobby.game).toMatchObject({ seafarers: true, scenarioId: 'headingForNewShores' });
    expect(lobbyStartProblem(host.net().lobby)).toMatch(/needs 3–6 players \(2 seated\)/);
    expect(lobbyVp(host.net().lobby)).toBe(14);
    host.net().hostSetVP(12);
    await flush();
    expect(lobbyVp(guest.net().lobby)).toBe(12);
    // Starting is refused until the seats fit.
    await host.net().hostStartGame();
    await flush();
    expect(host.game().game).toBeNull();
  });
});

describe('playing online', () => {
  async function startGame(
    guests: [string, string][],
    aiSeats: number,
    setup?: (host: Device) => void,
    /** Pin Math.random while the room is made, which fixes the lobby's board seed. */
    fixedRandom?: number,
  ) {
    const pin = fixedRandom === undefined ? null : vi.spyOn(Math, 'random').mockReturnValue(fixedRandom);
    const { host, code } = await hostRoom();
    pin?.mockRestore();
    const devices: Device[] = [host];
    for (const [uuid, name] of guests) devices.push(await joinAs(uuid, name, code));
    for (let i = 0; i < aiSeats; i++) host.net().hostAddAISeat();
    await flush();
    setup?.(host);
    await flush();
    await host.net().hostStartGame();
    await flush();
    return { host, code, devices };
  }

  it('the host starts the game for everyone, and moves reach every device', async () => {
    const { host, devices } = await startGame([['guest-uuid', 'Gus']], 1);
    const guest = devices[1]!;
    expect(guest.net().connection).toBe('in-game');
    expect(guest.net().role).toBe('guest');
    expect(host.net().role).toBe('host');
    expect(guest.game().game!.players.map((p) => p.name)).toEqual(['Hana', 'Gus', 'AI 1']);
    expectInStep(devices);
    const roll = diceRng(1);
    for (let i = 0; i < 40; i++) {
      await playMove(devices, roll);
      expectInStep(devices);
    }
    expect(host.game().game!.phase).not.toBe('setupRound1');
    expect(host.log().actions).toHaveLength(40);
  });

  it("the room stores createGame's inputs, not the whole game, and compact moves", async () => {
    const { code, devices } = await startGame([['guest-uuid', 'Gus']], 1);
    const roll = diceRng(9);
    for (let i = 0; i < 30; i++) await playMove(devices, roll);
    const room = fakeServer().rooms.get(code)!;
    expect(room.start!.length).toBeLessThan(1000);
    expect(JSON.stringify(devices[0]!.game().game).length).toBeGreaterThan(20000);
    const sizes = [...room.actions.values()].map((v) => v.length);
    expect(Math.max(...sizes)).toBeLessThan(200);
  });

  it("a device can't act for someone else's seat, and nothing is written when it tries", async () => {
    const { host, code, devices } = await startGame([['guest-uuid', 'Gus']], 1);
    const guest = devices[1]!;
    const g = guest.game().game!;
    const hostSeat = g.players.find((p) => host.net().uuidForPlayer(p.id) === host.uuid)!.id;
    const aiSeat = g.players.find((p) => p.isAI)!.id;
    for (const seat of [hostSeat, aiSeat]) {
      guest.game().dispatch({ type: 'endTurn', playerId: seat });
      expect(guest.game().error).toMatch(/another player's seat/);
    }
    await flush();
    expect(fakeServer().rooms.get(code)!.actions.size).toBe(0);
    expectInStep(devices);
  });

  it('a player who drops out mid-game gets the game, and its history, back on rejoining; anyone else spectates', async () => {
    const { host, code, devices } = await startGame([['guest-uuid', 'Gus']], 1);
    const roll = diceRng(2);
    for (let i = 0; i < 10; i++) await playMove(devices, roll);
    devices[1]!.net().leaveRoom();
    await flush();
    expect(host.net().onlineUuids.has('guest-uuid')).toBe(false);
    expect(host.net().isOnlinePlayer('p1')).toBe(false);

    // Come back a while later: the game clock still counts from the real start.
    await new Promise((r) => setTimeout(r, 30));
    const back = await joinAs('guest-uuid', 'Gus', code);
    expect(back.net().connection).toBe('in-game');
    expect(back.net().role).toBe('guest');
    expectInStep([host, back]);
    expect(back.log().actions).toHaveLength(10);
    expect(back.log().startTime).toBeLessThan(Date.now() - 30);
    expect(host.net().isOnlinePlayer('p1')).toBe(true);

    const stranger = await joinAs('stranger-uuid', 'Sam', code);
    expect(stranger.net().role).toBe('spectator');
    expectInStep([host, stranger]);

    // Play goes on with the rejoined guest.
    for (let i = 0; i < 10; i++) await playMove([host, back], roll);
    expectInStep([host, back, stranger]);
  });

  it('the host reloading the page is the host again (and keeps running the AI)', async () => {
    const { host, code, devices } = await startGame([['guest-uuid', 'Gus']], 1);
    const roll = diceRng(3);
    for (let i = 0; i < 6; i++) await playMove(devices, roll);
    host.net().leaveRoom();
    const reloaded = await joinAs('host-uuid', 'Hana', code);
    expect(reloaded.net().role).toBe('host');
    for (let i = 0; i < 6; i++) await playMove([reloaded, devices[1]!], roll);
    expectInStep([reloaded, devices[1]!]);
  });

  it('two players answering the same trade at once: the first in wins, the other is taken back', async () => {
    const { host, devices } = await startGame([['b-uuid', 'Bo'], ['c-uuid', 'Cy']], 0);
    const roll = diceRng(4);
    // Play through setup to someone's main phase.
    for (let i = 0; i < 200; i++) {
      const g = host.game().game!;
      if (g.phase === 'main' && g.hasRolledThisTurn && !g.pendingTrade) break;
      await playMove(devices, roll);
    }
    const g = host.game().game!;
    expect(g.phase).toBe('main');
    // Everyone gets the same cards out of band so the trade is affordable.
    const full: Record<Resource, number> = { wood: 3, brick: 3, sheep: 3, wheat: 3, ore: 3 };
    const rich = { ...g, players: g.players.map((p) => ({ ...p, resources: { ...full } })) };
    devices.forEach((d) => d.setGame(structuredClone(rich)));

    const proposer = getActingPlayerId(rich);
    const owner = (id: string) => devices.find((d) => host.net().uuidForPlayer(id as never) === d.uuid)!;
    owner(proposer).game().dispatch({ type: 'proposeTrade', playerId: proposer, give: { wood: 1 }, receive: { ore: 1 } });
    await flush();
    expect(host.game().game!.pendingTrade).toBeTruthy();

    const others = rich.players.map((p) => p.id).filter((id) => id !== proposer);
    fakeServer().holdWrites = true;
    for (const id of others) owner(id).game().dispatch({ type: 'acceptTrade', playerId: id });
    // Each device shows its own accept straight away…
    for (const id of others) {
      expect(owner(id).game().game!.players.find((p) => p.id === id)!.resources.wood).toBe(4);
    }
    releaseWrites();
    await flush();
    // …but only the first one into the log stands.
    expectInStep(devices);
    const woods = others.map((id) => host.game().game!.players.find((p) => p.id === id)!.resources.wood);
    expect(woods.sort()).toEqual([3, 4]);
    const loser = others.find((id) => host.game().game!.players.find((p) => p.id === id)!.resources.wood === 3)!;
    expect(owner(loser).game().error).toMatch(/went through first/);
    expect(host.game().game!.pendingTrade).toBeUndefined();
  });

  it('a Seafarers game stays in step on every device, and a late joiner rebuilds it from the log', async () => {
    const { host, code, devices } = await startGame([['guest-uuid', 'Gus']], 2, (h) =>
      h.net().hostSetGame({ ...h.net().lobby.game, seafarers: true, scenarioId: 'headingForNewShores' }),
      0.5, // a board where the AI sails early
    );
    const g = host.game().game!;
    expect(g.settings.expansions).toEqual(['seafarers']);
    expect(g.settings.scenarioId).toBe('headingForNewShores');
    expect(g.settings.victoryPointsToWin).toBe(14);
    expectInStep(devices);
    const roll = diceRng(5);
    const sailed = () => host.game().game!.players.some((p) => p.ships.length > 0);
    for (let i = 0; i < 400 && !host.game().game!.winner && !(i >= 150 && sailed()); i++) {
      await playMove(devices, roll);
      if (i % 25 === 0) expectInStep(devices);
    }
    expectInStep(devices);
    expect(sailed()).toBe(true);

    const late = await joinAs('late-uuid', 'Lu', code);
    expect(late.net().role).toBe('spectator');
    expectInStep([host, late]);
  }, 180000);
});
