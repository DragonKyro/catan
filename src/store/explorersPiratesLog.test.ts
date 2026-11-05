import { describe, expect, it } from 'vitest';
import { applyAction } from '@/game/engine';
import { rollDie } from '@/game/rng';
import type { Action, GameState } from '@/game/types';
import { exploreHex } from '@/game/modules/explorersPirates/explore';
import { harborsOf, type EpGame } from '@/game/modules/explorersPirates/state';
import {
  edgeOf,
  epMainPhase,
  patchEpState,
  putShip,
  setHidden,
  setPlayer,
} from '@/game/modules/explorersPirates/testSupport';
import { explorersPiratesLogLines } from './explorersPiratesLog';
import { useLogStore } from './logStore';

function lines(before: GameState, action: Action): [GameState, string[]] {
  const after = applyAction(before, action);
  return [after, explorersPiratesLogLines(before, action, after).map((l) => l.text)];
}

function toMovement(s: GameState): EpGame {
  return applyAction(s, { type: 'endTurn', playerId: 'p0' }) as EpGame;
}

function rngRolling(face: number): number {
  for (let x = 1; x < 100000; x++) if (rollDie(x)[0] === face) return x;
  throw new Error('no seed');
}

describe('Explorers & Pirates log', () => {
  it('logs exploring a hex with what was found and the reward', () => {
    let s: GameState = epMainPhase(1);
    s = setHidden(s, '2,-1', { terrain: 'wood' });
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 2) });
    s = toMovement(s);
    const [, out] = lines(s, { type: 'epMoveShip', playerId: 'p0', ship: 'a', to: edgeOf(s, 1, -1, 1) });
    expect(out[0]).toMatch(/^🧭 explored a parrot hex: forest \(\d+\) — took 1$/);
  });

  it('never names the pirate’s loot, and logs fish rolls, loading and the delivery', () => {
    let s: GameState = epMainPhase(1);
    s = { ...s, phase: 'epPlacePirate' };
    s = patchEpState(s, () => ({ pendingPirate: { playerId: 'p0', reason: 'seven', returnTo: 'main' } }));
    s = putShip(s, { id: 'v', owner: 'p1', edge: edgeOf(s, 4, -1, 1) });
    s = setPlayer(s, 'p1', { resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 2 } });
    let out: string[];
    [s, out] = lines(s, { type: 'epPlacePirate', playerId: 'p0', hex: '4,0', stealFrom: 'p1' });
    expect(out).toEqual(['☠️ placed their pirate ship and robbed B of 1 card']);
    expect(out[0]).not.toMatch(/ore/);

    s = setHidden(s, '2,-1', { terrain: 'sea', shoal: 3 });
    [s] = exploreHex(s as EpGame, 'p0', '2,-1');
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 1) });
    s = toMovement(s);
    s = { ...s, rngState: rngRolling(3) };
    [s, out] = lines(s, { type: 'epFishRoll', playerId: 'p0' });
    expect(out).toEqual(['🎲 rolled 3 for fish: a fish haul appears on the shoal']);
    [s, out] = lines(s, { type: 'epLoadFish', playerId: 'p0', ship: 'a', hex: '2,-1' });
    expect(out).toEqual(['🐟 loaded a fish haul']);
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 0, 0, 1), cargo: ['fish'] });
    [, out] = lines(s, { type: 'epDeliver', playerId: 'p0', ship: 'a' });
    expect(out).toEqual(['🏛 delivered 1 fish haul to the Council of Catan', '📈 Fish for Catan: space 0 → 1']);
  });

  it('logs builds, a captured lair (with the hero) and the end of the Movement phase', () => {
    let s: GameState = epMainPhase(1);
    s = setHidden(s, '2,-1', { terrain: 'gold' });
    [s] = exploreHex(s as EpGame, 'p0', '2,-1');
    s = patchEpState(s, (ep) => ({ lairs: ep.lairs.map((l) => ({ ...l, crews: ['p1'] })) }));
    s = setPlayer(s, 'p0', { resources: { wood: 0, brick: 0, sheep: 2, wheat: 0, ore: 2 } });
    const harbor = harborsOf(s, 'p0')[0]!;
    let out: string[];
    [s, out] = lines(s, { type: 'epBuildCrew', playerId: 'p0', at: { harbor } });
    expect(out).toEqual(['👥 built a crew on a harbor settlement']);
    s = toMovement(s);
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 0), cargo: ['crew', 'crew'] });
    [s, out] = lines(s, { type: 'epCrewToLair', playerId: 'p0', ship: 'a', hex: '2,-1' });
    expect(out).toEqual(['👥 landed a crew on a pirate lair (2/3)']);
    [s, out] = lines(s, { type: 'epCrewToLair', playerId: 'p0', ship: 'a', hex: '2,-1' });
    expect(out).toEqual(['👥 landed a crew on a pirate lair (3/3) — captured!']);
    [, out] = lines(s, { type: 'endTurn', playerId: 'p0' });
    expect(out.some((l) => l.startsWith('⛵ sailed'))).toBe(false);
    const fall = out.find((l) => l.startsWith('☠️ The pirate lair falls'))!;
    expect(fall).toMatch(/gold field \d+\): A, B \+2 gold each\. Hero: (A|B) \(\d \+ \d crews?\)/);
    expect(out.filter((l) => l.startsWith('📈 Pirate Lairs')).length).toBe(3);
  });
});

describe('Explorers & Pirates turn counter', () => {
  it('ticks once per revolution although turns end in the Movement phase', () => {
    let s: GameState = epMainPhase(1);
    useLogStore.getState().reset(s);
    const play = (a: Action) => {
      const next = applyAction(s, a);
      useLogStore.getState().record(s, a, next, 0);
      s = next;
    };
    for (let round = 0; round < 2; round++) {
      for (const pid of ['p0', 'p1', 'p2']) {
        if (round > 0 || pid !== 'p0') play({ type: 'rollDice', playerId: pid, dice: [1, 3] });
        play({ type: 'endTurn', playerId: pid });
        expect(s.phase).toBe('epMovement');
        play({ type: 'endTurn', playerId: pid });
      }
    }
    expect(useLogStore.getState().turnNumber).toBe(2);
  });
});
