import { describe, expect, it } from 'vitest';
import type { Action, GameState } from '@/game/types';
import { knowledgeFromHistory } from './knowledge';
import { KnowledgeSession } from './session';
import { playGame } from './testSupport';

/** One heuristic game's log: the creation state, every action, and the state after each. */
function gameLog(players: number, seed: number) {
  let initial: GameState | null = null;
  const actions: Action[] = [];
  const states: GameState[] = [];
  playGame({ players, seed }, (before, action, after) => {
    if (!initial) {
      initial = before;
      states.push(before);
    }
    actions.push(action);
    states.push(after);
  });
  return { initial: initial!, actions, states };
}

describe('KnowledgeSession', () => {
  const log = gameLog(4, 31);
  const seats = log.initial.players.map((p) => p.id);
  const at = (n: number) => log.actions.slice(0, n);

  it('folds the log in incrementally, matching a full replay', () => {
    const session = new KnowledgeSession();
    for (const n of [0, 1, 40, 41, 300, log.actions.length]) {
      const known = session.sync(log.initial, at(n), log.states[n]!, seats);
      expect(known, `after ${n} actions`).not.toBeNull();
      for (const id of seats) expect(known![id]).toEqual(knowledgeFromHistory(log.initial, at(n), id));
    }
    expect(session.problem).toBeNull();
  });

  it('replays from the start when the log gets shorter (undo)', () => {
    const session = new KnowledgeSession();
    session.sync(log.initial, at(300), log.states[300]!, seats);
    const known = session.sync(log.initial, at(250), log.states[250]!, seats);
    expect(known!.p1).toEqual(knowledgeFromHistory(log.initial, at(250), 'p1'));
  });

  it('only tracks the seats it is asked for, and restarts when they change', () => {
    const session = new KnowledgeSession();
    expect(Object.keys(session.sync(log.initial, at(100), log.states[100]!, ['p2'])!)).toEqual(['p2']);
    const known = session.sync(log.initial, at(100), log.states[100]!, ['p0', 'p3']);
    expect(Object.keys(known!)).toEqual(['p0', 'p3']);
    expect(known!.p3).toEqual(knowledgeFromHistory(log.initial, at(100), 'p3'));
  });

  it('refuses a log that does not reproduce the live game, until a new log arrives', () => {
    const session = new KnowledgeSession();
    expect(session.sync(log.initial, at(200), log.states[150]!, seats)).toBeNull();
    expect(session.problem).toMatch(/does not reproduce/);
    // Still refused as the same log grows…
    expect(session.sync(log.initial, at(201), log.states[201]!, seats)).toBeNull();
    // …but a new game starts clean.
    const next = gameLog(3, 32);
    const ids = next.initial.players.map((p) => p.id);
    expect(session.sync(next.initial, next.actions.slice(0, 50), next.states[50]!, ids)).not.toBeNull();
    expect(session.problem).toBeNull();
  });

  it('refuses a log that starts mid-game (a rejoin snapshot)', () => {
    const session = new KnowledgeSession();
    const mid = log.states[300]!;
    expect(mid.players.some((p) => Object.values(p.resources).some((n) => n > 0))).toBe(true);
    expect(session.sync(mid, log.actions.slice(300, 320), log.states[320]!, seats)).toBeNull();
    expect(session.problem).toMatch(/game creation/);
  });

  it('has nothing to offer without a log', () => {
    expect(new KnowledgeSession().sync(null, [], log.states[0]!, seats)).toBeNull();
  });
});
