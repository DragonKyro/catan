// Diagnostic: Hard AIs at a table with one "human" seat that trades at random
// (offers, yes / no, counters, taking a yes back, walking away), the AIs
// driven by the same rules as the app's AIDriver. Fails on any AI move the
// engine refuses — in the app that freezes the AI, since the driver only
// acts again when the game changes. Also counts the AIs' counter-offers.
// DIAG=1 to run; HEURISTIC=1 plays the AI seats with the heuristic alone
// (as in every expansion).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice, nextRng } from '@/game/rng';
import type { Action, PlayerId, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';
import { tryCounterTrade, tryExtractCounter } from '../trade';
import { AI_LEVELS } from './levels';
import { hasAnsweredTrade } from '@/game/actions/trade';
import { KnowledgeSession, chooseNeuralAction } from './index';
import { CatanPolicyNet, decodePolicyBinary } from './runtime';

const HEURISTIC = !!process.env.HEURISTIC;
const net = new CatanPolicyNet(decodePolicyBinary(readFileSync(resolve('src/ai/nn/policies', AI_LEVELS.hard.file))));

interface Failure { seed: number; step: number; who: PlayerId; where: string; action: Action; error: string; phase: string; trade: unknown }
interface CounterStats { counters: number; taken: number; turns: number; maxBySeatInTurn: number }

function play(seed: number, failures: Failure[], nnThrows: string[], stats: CounterStats): { steps: number; over: boolean } {
  const names = ['you', 'a1', 'a2', 'a3'];
  const initial = createGame({
    playerNames: names,
    playerTypes: ['human', 'ai', 'ai', 'ai'],
    seed,
    settings: { victoryPointsToWin: 10, aiLevel: 'hard' },
  });
  const human = 'p0';
  const ais = initial.players.filter((p) => p.isAI).map((p) => p.id);
  const session = new KnowledgeSession();
  const actions: Action[] = [];
  let s = initial;
  let rng = (seed * 9301 + 49297) >>> 0;
  const rand = () => {
    const [v, n] = nextRng(rng);
    rng = n;
    return v;
  };
  let dice = (seed * 2654435761) >>> 0;
  const roll = (): [number, number] => {
    const [d, n] = rollDice(dice);
    dice = n;
    return d;
  };
  // AIs whose answer to the current offer the engine refused (the driver never retries them).
  let silent = new Set<PlayerId>();
  let tradeKey = '';
  let byTurn: Partial<Record<PlayerId, number>> = {};
  const apply = (a: Action) => {
    s = applyAction(s, a);
    actions.push(a);
    if (a.type === 'counterTrade' && ais.includes(a.playerId)) {
      stats.counters++;
      byTurn[a.playerId] = (byTurn[a.playerId] ?? 0) + 1;
      stats.maxBySeatInTurn = Math.max(stats.maxBySeatInTurn, byTurn[a.playerId]!);
    }
    if (a.type === 'confirmTrade' && a.counter && ais.includes(a.with)) stats.taken++;
    if (a.type === 'endTurn' && !s.pendingTrade && s.phase === 'rollOrPlayKnight') {
      stats.turns++;
      byTurn = {};
    }
  };
  const neural = (id: PlayerId): Action | undefined => {
    if (HEURISTIC) return undefined;
    const known = session.sync(initial, actions, s, ais);
    if (!known) return undefined;
    try {
      return chooseNeuralAction(s, id, known[id]!, net) ?? undefined;
    } catch (e) {
      nnThrows.push(`${(e as Error).message} [${s.phase}${s.pendingTrade ? ' trade' : ''}]`);
      return undefined;
    }
  };
  const fail = (who: PlayerId, where: string, action: Action, e: unknown, step: number) =>
    failures.push({ seed, step, who, where, action, error: (e as Error).message, phase: s.phase, trade: s.pendingTrade });
  const has = (id: PlayerId, bank: Partial<Record<Resource, number>>) => {
    const p = s.players.find((x) => x.id === id)!;
    return RESOURCES.every((r) => p.resources[r] >= (bank[r] ?? 0));
  };
  const randomOffer = (id: PlayerId): { give: Partial<Record<Resource, number>>; receive: Partial<Record<Resource, number>> } | null => {
    const p = s.players.find((x) => x.id === id)!;
    const mine = RESOURCES.filter((r) => p.resources[r] > 0);
    if (mine.length === 0) return null;
    const g = mine[Math.floor(rand() * mine.length)]!;
    const others = RESOURCES.filter((r) => r !== g);
    const w = others[Math.floor(rand() * others.length)]!;
    const n = p.resources[g] >= 2 && rand() < 0.3 ? 2 : 1;
    return { give: { [g]: n }, receive: { [w]: 1 } };
  };

  let step = 0;
  for (; s.phase !== 'gameOver' && step < 6000; step++) {
    const pt = s.pendingTrade;
    if (pt) {
      const key = JSON.stringify([pt.proposerId, pt.give, pt.receive]);
      if (key !== tradeKey) {
        tradeKey = key;
        silent = new Set();
      }
      const answered = (id: PlayerId) => hasAnsweredTrade(pt, id) || silent.has(id);
      // The trade-evaluator effect: every AI that hasn't answered answers once.
      const eligible = ais.filter((id) => id !== pt.proposerId && !answered(id));
      if (eligible.length > 0) {
        const id = eligible[Math.floor(rand() * eligible.length)]!;
        let a = neural(id);
        if (!a) {
          a = tryExtractCounter(s, id)
            ?? (shouldAcceptTrade(s, id) ? { type: 'acceptTrade', playerId: id } : null)
            ?? tryCounterTrade(s, id)
            ?? { type: 'rejectTrade', playerId: id };
        }
        try {
          apply(a);
        } catch (e) {
          // The app's evaluator would leave this AI silent on this offer.
          fail(id, 'answer', a, e, step);
          silent.add(id);
        }
        continue;
      }
      // The human answers an AI's offer: yes, no or a counter (sometimes taking a yes back).
      if (pt.proposerId !== human && !answered(human) && rand() < 0.85) {
        const r = rand();
        let a: Action;
        if (r < 0.35 && has(human, pt.receive)) a = { type: 'acceptTrade', playerId: human };
        else if (r < 0.55) {
          const o = randomOffer(human);
          a = o ? { type: 'counterTrade', playerId: human, give: o.give, receive: o.receive } : { type: 'rejectTrade', playerId: human };
        } else a = { type: 'rejectTrade', playerId: human };
        try { apply(a); } catch { apply({ type: 'rejectTrade', playerId: human }); }
        if (a.type === 'acceptTrade' && rand() < 0.15 && s.pendingTrade) apply({ type: 'rejectTrade', playerId: human });
        continue;
      }
      if (pt.proposerId === human) {
        // The human settles its offer: a yes, a counter it can pay, or walk away.
        const all = s.players.every((p) => p.id === human || answered(p.id));
        const yes = pt.acceptedBy ?? [];
        const takeable = (pt.counters ?? []).filter((c) => has(human, c.receive));
        if (all || rand() < 0.3) {
          const r = rand();
          if (yes.length > 0 && r < 0.5) apply({ type: 'confirmTrade', playerId: human, with: yes[Math.floor(rand() * yes.length)]! });
          else if (takeable.length > 0 && r < 0.8) apply({ type: 'confirmTrade', playerId: human, with: takeable[0]!.by, counter: true });
          else if (all) apply({ type: 'cancelTrade', playerId: human });
          else continue;
        }
        continue;
      }
      // The main loop: the AI proposer settles its offer (a yes, a counter, or walk away).
      const acting = pt.proposerId;
      const a = neural(acting) ?? chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting };
      try {
        apply(a);
      } catch (e) {
        fail(acting, 'proposer', a, e, step);
        return { steps: step, over: false }; // the app would freeze here
      }
      continue;
    }
    const acting = getActingPlayerId(s);
    if (acting === human) {
      // The human mostly plays like the heuristic, plus random offers to the AIs.
      const p = s.players.find((x) => x.id === human)!;
      if (s.phase === 'main' && s.hasRolledThisTurn && rand() < 0.35 && RESOURCES.some((r) => p.resources[r] > 0)) {
        const o = randomOffer(human);
        if (o) {
          try { apply({ type: 'proposeTrade', playerId: human, give: o.give, receive: o.receive }); continue; } catch { /* fall through */ }
        }
      }
      let a = chooseAction(s, human) ?? { type: 'endTurn', playerId: human };
      if (a.type === 'proposeTrade') a = { type: 'endTurn', playerId: human };
      if (a.type === 'rollDice') a = { ...a, dice: roll() };
      apply(a);
      continue;
    }
    let a = neural(acting) ?? chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting };
    if (a.type === 'rollDice') a = { ...a, dice: roll() };
    try {
      apply(a);
    } catch (e) {
      fail(acting, 'own move', a, e, step);
      return { steps: step, over: false };
    }
  }
  return { steps: step, over: s.phase === 'gameOver' };
}

describe.runIf(process.env.DIAG)('Hard AIs with a trading human (AIDriver rules)', () => {
  it('never pick a move the engine refuses', () => {
    const failures: Failure[] = [];
    const nnThrows: string[] = [];
    const games = Number(process.env.GAMES ?? 6);
    const stats: CounterStats = { counters: 0, taken: 0, turns: 0, maxBySeatInTurn: 0 };
    let finished = 0;
    for (let seed = 1; seed <= games; seed++) {
      const r = play(seed, failures, nnThrows, stats);
      if (r.over) finished++;
    }
    console.log(`games ${games}, finished ${finished}, failures ${failures.length}, network throws ${nnThrows.length}`);
    console.log(`${HEURISTIC ? 'heuristic' : 'network'} AI counters: ${(stats.counters / games).toFixed(1)} a game ` +
      `(${(stats.counters / Math.max(1, stats.turns)).toFixed(2)} a turn), ${stats.taken} of ${stats.counters} taken, ` +
      `most by one seat in a turn ${stats.maxBySeatInTurn}`);
    for (const f of failures.slice(0, 8)) console.log(JSON.stringify(f));
    for (const t of [...new Set(nnThrows)].slice(0, 8)) console.log('throw:', t);
    expect(failures).toEqual([]);
  }, 1_200_000);
});
