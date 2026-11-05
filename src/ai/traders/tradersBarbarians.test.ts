import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { giveResources, runSetupPhase } from '@/game/__testHelpers';
import { emptyBank } from '@/game/resources';
import { edgeKey } from '@/game/board/coords';
import type { EdgeId, GameState, PlayerId, TbWagon, TradersBarbariansState, VertexId } from '@/game/types';
import { chooseAction } from '../index';
import {
  bestBarbarianMove,
  chooseWagonMove,
  tryUpgradeWagon,
  wagonTarget,
} from './tradersBarbarians';

// Focused checks of the Traders & Barbarians scenario AI decisions.

function mainPhase(seed = 1): GameState {
  let s = createGame({
    playerNames: ['A', 'B', 'C'],
    playerTypes: ['ai', 'ai', 'ai'],
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: 'tradersAndBarbarians' },
    randomizeTurnOrder: false,
  });
  s = runSetupPhase(s);
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [1, 2] });
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, settlements: [], cities: [], roads: [], resources: emptyBank() })),
  };
}

function patchTb(s: GameState, fn: (tb: TradersBarbariansState) => Partial<TradersBarbariansState>): GameState {
  return { ...s, tradersBarbarians: { ...s.tradersBarbarians!, ...fn(s.tradersBarbarians!) } };
}
function setWagon(s: GameState, pid: PlayerId, w: Partial<TbWagon>): GameState {
  return patchTb(s, (tb) => ({ wagons: { ...tb.wagons, [pid]: { ...tb.wagons[pid]!, ...w } } }));
}
function setRoads(s: GameState, pid: PlayerId, roads: EdgeId[]): GameState {
  return { ...s, players: s.players.map((p) => (p.id === pid ? { ...p, roads } : p)) };
}
const loc = (s: GameState, id: string) => s.tradersBarbarians!.locations.find((l) => l.id === id)!;
const pathCorner = (s: GameState, id: string, i = 0): VertexId => {
  const l = loc(s, id);
  return s.board.edges[l.paths[i]!]!.vertices.find((v) => v !== l.plaza)!;
};

describe('Traders & Barbarians AI', () => {
  it('heads for the plaza that wants its token, and ends the phase when it arrives', () => {
    let s = mainPhase();
    s = setWagon(s, 'p0', { vertex: pathCorner(s, 'quarry'), cargo: { good: 'tools', from: 'castle' } });
    s = patchTb(s, () => ({ barbarians: [] }));
    expect(wagonTarget(s, 'p0')).toBe(loc(s, 'quarry').plaza);
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    const step = chooseWagonMove(s, 'p0');
    expect(step).toEqual({ type: 'moveWagon', playerId: 'p0', to: loc(s, 'quarry').plaza });
    s = applyAction(s, step!);
    expect(s.tradersBarbarians!.wagons.p0!.delivered).toBe(1);
    // A new token is on the wagon but the move is over: done.
    expect(chooseWagonMove(s, 'p0')).toBeNull();
  });

  it('spends wheat when +2 MP reaches the plaza this move', () => {
    let s = mainPhase();
    const q = loc(s, 'quarry');
    // Two roadless edges (4 MP) from the plaza, plus one more: 6 MP > 4.
    const c = pathCorner(s, 'quarry');
    const far = s.board.vertices[c]!.neighborVertices.find((v) => v !== q.plaza)!;
    s = setWagon(s, 'p0', { vertex: far, cargo: { good: 'tools', from: 'castle' } });
    s = patchTb(s, () => ({ barbarians: [] }));
    s = giveResources(s, 'p0', { wheat: 1 });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    // far → c → plaza costs 4 MP: reachable without wheat.
    expect(chooseWagonMove(s, 'p0')?.type).toBe('moveWagon');
    // Burn 2 MP first: now only wheat gets us there.
    s = patchTb(s, (tb) => ({ wagonTurn: { ...tb.wagonTurn!, mp: 2 } }));
    expect(chooseWagonMove(s, 'p0')).toEqual({ type: 'boostWagon', playerId: 'p0' });
  });

  it('tries a drive-off when its upgraded wagon stands next to a barbarian', () => {
    let s = mainPhase();
    const c = pathCorner(s, 'castle');
    const e = s.board.vertices[c]!.edges.find((x) => !loc(s, 'castle').paths.includes(x))!;
    s = setWagon(s, 'p0', { vertex: c, level: 2, cargo: { good: 'sand', from: 'quarry' } });
    s = patchTb(s, (tb) => ({ barbarians: [e, tb.barbarians[1]!, tb.barbarians[2]!] }));
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(chooseWagonMove(s, 'p0')).toEqual({ type: 'driveOffBarbarian', playerId: 'p0', barbarian: 0 });
  });

  it('puts a barbarian on a rival road on the leader’s route and robs it', () => {
    let s = mainPhase();
    // p1 carries tools one path away from the quarry plaza, on its own road.
    const q = loc(s, 'quarry');
    const c = pathCorner(s, 'quarry');
    s = setWagon(s, 'p1', { vertex: c, cargo: { good: 'tools', from: 'castle' } });
    // Only p1's wagon is on the board (no other routes to weigh).
    s = patchTb(s, (tb) => ({ wagons: { p1: tb.wagons.p1! } }));
    s = setRoads(s, 'p1', [q.paths[0]!]);
    s = giveResources(s, 'p1', { ore: 2 });
    const choice = bestBarbarianMove(s, 'p0', undefined, true)!;
    expect(choice.edge).toBe(q.paths[0]);
    // And the phase dispatcher uses it.
    // In the Action phase, a Knight is worth playing for it.
    let t = s;
    t = { ...t, players: t.players.map((p) => (p.id === 'p0' ? { ...p, devCards: { ...p.devCards, unplayed: ['knight'] } } : p)) };
    const knight = chooseAction(t, 'p0');
    expect(knight).toEqual({ type: 'playKnight', playerId: 'p0' });
    t = applyAction(t, knight!);
    const move = chooseAction(t, 'p0');
    expect(move).toMatchObject({ type: 'moveTbBarbarian', edge: q.paths[0] });
  });

  it('keeps barbarians off its own route', () => {
    let s = mainPhase();
    const q = loc(s, 'quarry');
    s = setWagon(s, 'p0', { vertex: pathCorner(s, 'quarry'), cargo: { good: 'tools', from: 'castle' } });
    const choice = bestBarbarianMove(s, 'p0', undefined, true)!;
    const own = edgeKey(pathCorner(s, 'quarry'), q.plaza);
    expect(own).toBe(q.paths[0]);
    expect(choice.edge).not.toBe(own);
  });

  it('upgrades the wagon when it can afford it, and always to level 5', () => {
    let s = mainPhase();
    expect(tryUpgradeWagon(s, 'p0')).toBeNull();
    s = giveResources(s, 'p0', { wood: 1, sheep: 1, ore: 1 });
    expect(tryUpgradeWagon(s, 'p0')).toEqual({ type: 'upgradeWagon', playerId: 'p0' });
    s = setWagon(s, 'p0', { level: 4 });
    s = giveResources(s, 'p0', { wood: 1 });
    expect(tryUpgradeWagon(s, 'p0')).toEqual({ type: 'upgradeWagon', playerId: 'p0' });
  });

  it('buys the scenario development cards (the base deck is empty)', () => {
    let s = mainPhase();
    s = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 });
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, gold: 0 } : p)) };
    // Two buildings so the early-game gate doesn't hold the card back.
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, settlements: [pathCorner(s, 'castle', 1)], cities: [pathCorner(s, 'glassworks', 1)] } : p)) };
    expect(s.devCardDeck).toEqual([]);
    expect(chooseAction(s, 'p0')).toEqual({ type: 'buyDevCard', playerId: 'p0' });
  });
});
