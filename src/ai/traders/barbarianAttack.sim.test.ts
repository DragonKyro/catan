import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import type { Action, BarbarianCardType, GameState } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';

// All-heuristic Barbarian Attack games: they must finish, and the scenario's
// mechanics must actually be used.

interface Stats {
  steps: number;
  cards: Record<BarbarianCardType, number>;
  knightsPlaced: number;
  knightMoves: number;
  boostedMoves: number;
  fightsWon: number;
  prisoners: number;
  liberations: number;
  conquests: number;
  steals: number;
}

function play(seed: number, players: number): { final: GameState; stats: Stats } {
  const names = ['A', 'B', 'C', 'D'].slice(0, players);
  let s = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: 'barbarianAttack' },
  });
  let diceRng = seed * 2654435761;
  const stats: Stats = {
    steps: 0,
    cards: { capture: 0, knighthood: 0, swiftKnight: 0, treason: 0 },
    knightsPlaced: 0,
    knightMoves: 0,
    boostedMoves: 0,
    fightsWon: 0,
    prisoners: 0,
    liberations: 0,
    conquests: 0,
    steals: 0,
  };
  let lastSeq = 0;
  while (s.winner === null && stats.steps < 6000) {
    stats.steps++;
    const pt = s.pendingTrade;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      s = applyAction(
        s,
        acceptor
          ? { type: 'acceptTrade', playerId: acceptor.id }
          : { type: 'cancelTrade', playerId: pt.proposerId },
      );
      continue;
    }
    const acting = getActingPlayerId(s);
    let action: Action = chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting };
    if (action.type === 'rollDice') {
      let dice: [number, number];
      [dice, diceRng] = rollDice(diceRng);
      action = { ...action, dice };
    }
    if (action.type === 'moveBarbarianKnight') {
      stats.knightMoves++;
      if (action.boost) stats.boostedMoves++;
    }
    if (action.type === 'resolveBarbarianCard' && action.edge) stats.knightsPlaced++;
    if (action.type === 'stealResource') stats.steals++;
    s = applyAction(s, action);
    const last = s.barbarianAttack?.lastEvents;
    if (last && last.seq !== lastSeq) {
      lastSeq = last.seq;
      for (const ev of last.events) {
        if (ev.kind === 'cardDrawn') stats.cards[ev.card]++;
        if (ev.kind === 'landing') stats.conquests += ev.rolls.filter((r) => r.conquered).length;
        if (ev.kind === 'expel') {
          for (const r of ev.results) {
            stats.fightsWon++;
            stats.prisoners += Object.values(r.prisoners).reduce((a, b) => a + b, 0);
            if (r.liberated) stats.liberations++;
          }
        }
      }
    }
  }
  return { final: s, stats };
}

describe('Barbarian Attack — all-AI games', () => {
  const runs: Array<{ seed: number; players: number }> = [
    { seed: 1, players: 3 },
    { seed: 2, players: 3 },
    { seed: 3, players: 3 },
    { seed: 4, players: 4 },
    { seed: 5, players: 4 },
    { seed: 6, players: 4 },
  ];
  const all: Stats[] = [];
  for (const { seed, players } of runs) {
    it(`${players}p seed ${seed} finishes`, () => {
      const { final, stats } = play(seed, players);
      all.push(stats);
      expect(final.phase, JSON.stringify(stats)).toBe('gameOver');
      expect(final.winner).not.toBeNull();
      // Barbarian bookkeeping: 36 figures in total.
      const ba = final.barbarianAttack!;
      const onBoard = Object.values(ba.barbarians).reduce((a, b) => a + b, 0);
      const prisoners = Object.values(ba.prisoners).reduce((a, b) => a + b, 0);
      expect(onBoard + prisoners + ba.supply).toBe(36);
      expect(stats.knightsPlaced).toBeGreaterThan(0);
      expect(stats.fightsWon).toBeGreaterThan(0);
    }, 120_000);
  }

  it('uses every part of the scenario across the games', () => {
    const sum = (f: (s: Stats) => number) => all.reduce((a, s) => a + f(s), 0);
    // eslint-disable-next-line no-console
    console.log('[barbarian attack sims]', JSON.stringify(all));
    expect(all).toHaveLength(runs.length);
    expect(sum((s) => s.cards.capture)).toBeGreaterThan(0);
    expect(sum((s) => s.cards.knighthood)).toBeGreaterThan(0);
    expect(sum((s) => s.cards.swiftKnight)).toBeGreaterThan(0);
    expect(sum((s) => s.cards.treason)).toBeGreaterThan(0);
    expect(sum((s) => s.knightMoves)).toBeGreaterThan(0);
    expect(sum((s) => s.prisoners)).toBeGreaterThan(0);
    expect(sum((s) => s.steals)).toBeGreaterThan(0);
  });
});
