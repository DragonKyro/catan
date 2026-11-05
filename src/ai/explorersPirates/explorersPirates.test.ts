import { describe, expect, it } from 'vitest';
import type { Action, GameState, PlayerId, ResourceBank } from '@/game/types';
import { applyAction } from '@/game/engine';
import { emptyBank } from '@/game/resources';
import { getActingPlayerId } from '@/game/helpers';
import { exploreHex } from '@/game/modules/explorersPirates/explore';
import {
  harborsOf,
  legalShipSteps,
  shipById,
  shipsOf,
  type EpGame,
} from '@/game/modules/explorersPirates/state';
import {
  cornerOf,
  edgeOf,
  epGame,
  epMainPhase,
  patchEpState,
  putShip,
  runEpSetup,
  setHidden,
  setPlayer,
} from '@/game/modules/explorersPirates/testSupport';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { tryCounterTrade, tryExtractCounter } from '@/ai/trade';
import { reportNeeds } from '@/ai/value';
import { planShip } from './ships';
import { shipReach } from './planner';

// Decisions of the Explorers & Pirates AI on hand-built positions.

function bare(s: GameState): EpGame {
  const cleared = patchEpState(s, () => ({ ships: [], harbors: {} }));
  return {
    ...cleared,
    players: cleared.players.map((p) => ({ ...p, settlements: [], roads: [], resources: emptyBank(), gold: 0 })),
  } as EpGame;
}

function give(s: GameState, pid: PlayerId, res: Partial<ResourceBank>): EpGame {
  return setPlayer(s, pid, { resources: { ...s.players.find((p) => p.id === pid)!.resources, ...res } });
}

function toMovement(s: GameState): EpGame {
  return applyAction(s, { type: 'endTurn', playerId: s.playerOrder[s.currentPlayerIndex]! }) as EpGame;
}

function reveal(s: GameState, hex: string, tile: Parameters<typeof setHidden>[2]): EpGame {
  let out = setHidden(s, hex, tile);
  [out] = exploreHex(out, 'p0', hex);
  return out;
}

// Let the AI play the rest of p0's Movement phase; returns the actions.
function playMovement(start: GameState): { state: GameState; actions: Action[] } {
  let s = start;
  const actions: Action[] = [];
  for (let i = 0; i < 60 && s.phase === 'epMovement'; i++) {
    const a = chooseAction(s, 'p0');
    if (!a) break;
    actions.push(a);
    s = applyAction(s, a);
  }
  return { state: s, actions };
}

describe('Explorers & Pirates AI: Movement phase', () => {
  it('takes the free fish roll first, then delivers fish at a Council anchor', () => {
    let s: GameState = bare(epMainPhase(1));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 0, 0, 1), cargo: ['fish'] });
    s = toMovement(s);
    expect(chooseAction(s, 'p0')).toEqual({ type: 'epFishRoll', playerId: 'p0' });
    s = applyAction(s, { type: 'epFishRoll', playerId: 'p0' });
    expect(chooseAction(s, 'p0')).toEqual({ type: 'epDeliver', playerId: 'p0', ship: 'a' });
  });

  it('lands its crews on a pirate lair and captures it', () => {
    let s: GameState = bare(epMainPhase(1));
    s = reveal(s, '2,-1', { terrain: 'gold' });
    s = patchEpState(s, (ep) => ({ lairs: ep.lairs.map((l) => ({ ...l, crews: ['p1'] })) }));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 0), cargo: ['crew', 'crew'] });
    const { state, actions } = playMovement(toMovement(s));
    expect(actions.filter((a) => a.type === 'epCrewToLair')).toHaveLength(2);
    expect(state.explorersPirates!.pendingLairs).toEqual(['2,-1']);
  });

  it('sails an empty ship to the face-down hexes and explores', () => {
    let s: GameState = bare(epMainPhase(1));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 2) });
    const before = Object.keys(s.explorersPirates!.hidden).length;
    const { state } = playMovement(toMovement(s));
    expect(Object.keys(state.explorersPirates!.hidden).length).toBeLessThan(before);
  });

  it('founds a settlement from a ship carrying a settler', () => {
    let s: GameState = bare(epMainPhase(1));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, -1, -1, 0), cargo: ['settler'] });
    expect(planShip(s, shipById(s, 'a')!)?.goal.kind).toBe('found');
    const { state, actions } = playMovement(toMovement(s));
    const found = actions.find((a) => a.type === 'epFoundSettlement');
    expect(found).toBeTruthy();
    expect(state.players[0]!.settlements).toHaveLength(1);
    expect(shipById(state, 'a')).toBeUndefined();
  });

  it('puts a crew on a spice farm, loads its sack and heads for the Council', () => {
    let s: GameState = bare(epMainPhase(1));
    s = reveal(s, '2,-1', { terrain: 'spice', ability: 'swiftVoyage' });
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 0), cargo: ['crew'] });
    const { actions } = playMovement(toMovement(s));
    const kinds = actions.map((a) => a.type);
    expect(kinds).toContain('epCrewToFarm');
    expect(kinds).toContain('epLoadSpice');
    expect(kinds.indexOf('epCrewToFarm')).toBeLessThan(kinds.indexOf('epLoadSpice'));
  });

  it('chases an opponent pirate with a battle-ready ship before moving', () => {
    let s: GameState = bare(epMainPhase(1));
    s = patchEpState(s, () => ({ pirate: { owner: 'p1', hex: '1,0' } }));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 1) });
    s = toMovement(s);
    s = applyAction(s, { type: 'epFishRoll', playerId: 'p0' });
    expect(chooseAction(s, 'p0')).toEqual({ type: 'epChasePirate', playerId: 'p0', ship: 'a' });
  });

  it('never stops a moving ship on an edge with 2 other ships', () => {
    let s: GameState = bare(epMainPhase(1));
    const full = edgeOf(s, 3, 0, 0);
    s = putShip(s, { id: 'a', owner: 'p0', edge: full });
    s = putShip(s, { id: 'x', owner: 'p1', edge: full });
    s = putShip(s, { id: 'y', owner: 'p2', edge: full });
    s = toMovement(s);
    s = patchEpState(s, (ep) => ({
      movement: { ...ep.movement!, fishRolled: true, moving: 'a', mp: 2, moved: ['a'] },
    }));
    const a = chooseAction(s, 'p0');
    expect(a?.type).toBe('epMoveShip');
    const next = applyAction(s, a!);
    expect(shipById(next, 'a')!.edge).not.toBe(full);
  });

  it('plans one-step moves exactly as the engine allows them (tribute included)', () => {
    let s: GameState = bare(epMainPhase(1));
    s = reveal(s, '2,-1', { terrain: 'sea' });
    s = patchEpState(s, () => ({ pirate: { owner: 'p1', hex: '1,0' } }));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 2) });
    s = toMovement(s);
    for (const gold of [0, 2]) {
      const t = setPlayer(s, 'p0', { gold });
      const reach = shipReach(t, shipById(t, 'a')!, { mp: 4, gold, tributePaid: false });
      const one = [...reach.values()].filter((n) => n.steps === 1).map((n) => n.edge).sort();
      expect(one).toEqual([...legalShipSteps(t, 'a')].sort());
    }
  });
});

describe('Explorers & Pirates AI: other phases', () => {
  it('plays all three setup rounds', () => {
    let s: GameState = epGame(3, 4, { ai: true });
    for (let i = 0; i < 40 && s.phase.startsWith('setupRound'); i++) {
      const pid = getActingPlayerId(s);
      s = applyAction(s, chooseAction(s, pid)!);
    }
    expect(s.phase).toBe('rollOrPlayKnight');
    for (const p of s.players) {
      expect(p.settlements).toHaveLength(2);
      expect(harborsOf(s, p.id)).toHaveLength(1);
      expect(p.roads).toHaveLength(1);
      expect(shipsOf(s, p.id).map((x) => x.cargo)).toEqual([['settler']]);
    }
  });

  it('upgrades a coastal settlement to a harbor settlement when it can', () => {
    let s: GameState = bare(epMainPhase(1));
    const coastal = cornerOf(s, 0, -2, 0);
    s = setPlayer(s, 'p0', { settlements: [coastal] });
    s = give(s, 'p0', { wheat: 2, ore: 2 });
    expect(chooseAction(s, 'p0')).toEqual({ type: 'epBuildHarbor', playerId: 'p0', vertex: coastal });
  });

  it('robs a ship owner when placing its pirate', () => {
    let s: GameState = bare(runEpSetup(epGame(1)));
    s = give(s, 'p1', { wood: 3 });
    s = putShip(s, { id: 'x', owner: 'p1', edge: edgeOf(s, 1, -1, 1) });
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('epPlacePirate');
    const a = chooseAction(s, 'p0');
    expect(a).toMatchObject({ type: 'epPlacePirate', playerId: 'p0', stealFrom: 'p1' });
    expect(() => applyAction(s, a!)).not.toThrow();
  });

  it('reports E&P goals to the shared trade / discard code', () => {
    let s: GameState = bare(epMainPhase(1));
    s = setPlayer(s, 'p0', { settlements: [cornerOf(s, 0, -2, 0)] });
    s = give(s, 'p0', { wheat: 1, ore: 2 });
    expect(reportNeeds(s, 'p0')).toMatchObject({ goal: 'harbor', byResource: { wheat: 1, ore: 0 } });
  });

  it('answers player trades that include gold without breaking', () => {
    let s: GameState = epMainPhase(2, 3);
    s = give(s, 'p0', { wood: 2 });
    s = setPlayer(s, 'p0', { gold: 3 });
    s = give(s, 'p1', { ore: 2 });
    s = give(s, 'p2', { ore: 2 });
    s = applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { ore: 1 }, giveGold: 1 });
    for (const pid of ['p1', 'p2']) {
      expect(typeof shouldAcceptTrade(s, pid)).toBe('boolean');
      expect(tryCounterTrade(s, pid)).toBeNull();
      expect(tryExtractCounter(s, pid)).toBeNull();
      if (shouldAcceptTrade(s, pid)) expect(() => applyAction(s, { type: 'acceptTrade', playerId: pid })).not.toThrow();
    }
    // Asking gold from someone who has none is refused.
    let t: GameState = applyAction(s, { type: 'cancelTrade', playerId: 'p0' });
    t = setPlayer(t, 'p1', { gold: 0 });
    t = applyAction(t, { type: 'proposeTrade', playerId: 'p0', give: { wood: 2 }, receive: { ore: 1 }, receiveGold: 1 });
    expect(shouldAcceptTrade(t, 'p1')).toBe(false);
    // A plain resource offer: any counter the AI makes is legal.
    let u: GameState = applyAction(t, { type: 'cancelTrade', playerId: 'p0' });
    u = applyAction(u, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { ore: 1 } });
    for (const pid of ['p1', 'p2']) {
      const counter = tryCounterTrade(u, pid) ?? tryExtractCounter(u, pid);
      if (counter) expect(() => applyAction(u, counter)).not.toThrow();
    }
  });
});
