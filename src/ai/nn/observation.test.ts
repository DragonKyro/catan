import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import type { DevCardType, GameState } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { getActingPlayerId } from '@/game/helpers';
import { sampleGames, scrambleHidden } from './testSupport';
import { observe, supportsNeuralAi } from './observation';
import { encodeObservation } from './encode';
import { DEV_TYPES } from './knowledge';

// Capped: the heuristic AI can stall (every settlement upgraded, no road
// worth building), and a stuck game would only repeat the same states.
const CONFIGS = [
  { players: 3, games: 2, every: 3, maxSteps: 1500 },
  { players: 4, games: 2, every: 3, maxSteps: 1500 },
  { players: 5, games: 1, every: 4, maxSteps: 1500 },
  { players: 8, games: 1, every: 6, maxSteps: 1500 },
];

describe('observe() hides what a real player cannot see', () => {
  for (const cfg of CONFIGS) {
    it(`observation and features ignore hidden information (${cfg.players}p)`, () => {
      const samples = sampleGames({ ...cfg, seed: 101 });
      let changes = 0;
      for (const { state, knowledge } of samples) {
        for (const viewer of state.players) {
          const k = knowledge[viewer.id]!;
          const { state: scrambled, changes: n } = scrambleHidden(state, viewer.id, changes + 17);
          changes += n;
          const a = observe(state, viewer.id, k);
          const b = observe(scrambled, viewer.id, k);
          expect(JSON.stringify(b)).toBe(JSON.stringify(a));
          const fa = encodeObservation(a);
          const fb = encodeObservation(b);
          for (const part of ['hexes', 'vertices', 'edges', 'global'] as const) {
            expect(Array.from(fb[part])).toEqual(Array.from(fa[part]));
          }
        }
      }
      // Guard against a vacuous pass: the scrambler really did move hidden cards.
      expect(changes).toBeGreaterThan(samples.length);
    });
  }

  it('carries no deck, RNG or opponent hand / dev-card fields', () => {
    const [{ state, knowledge }] = sampleGames({ players: 4, games: 1, seed: 3, every: 200 }).slice(1);
    const obs = observe(state, 'p0', knowledge.p0!) as unknown as Record<string, unknown>;
    for (const key of ['devCardDeck', 'rngState', 'players.resources']) expect(obs).not.toHaveProperty(key);
    const players = obs.players as Array<Record<string, unknown>>;
    expect(players[0]!.hand).not.toBeNull();
    expect(players[0]!.devCards).not.toBeNull();
    for (const p of players.slice(1)) {
      expect(p.hand).toBeNull();
      expect(p.devCards).toBeNull();
      expect(p.trueVp).toBeNull();
      expect(p).not.toHaveProperty('resources');
    }
  });

  it('unseen dev cards are exactly the deck plus opponents\' hands', () => {
    for (const { state, knowledge } of sampleGames({ players: 4, games: 2, seed: 41, every: 5 })) {
      for (const viewer of state.players) {
        const obs = observe(state, viewer.id, knowledge[viewer.id]!);
        const truth: Record<DevCardType, number> = { knight: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0, victoryPoint: 0 };
        for (const c of state.devCardDeck) truth[c]++;
        for (const p of state.players) {
          if (p.id === viewer.id) continue;
          for (const c of [...p.devCards.unplayed, ...p.devCards.boughtThisTurn]) truth[c]++;
          truth.victoryPoint += p.devCards.victoryPoints;
        }
        for (const c of DEV_TYPES) expect(obs.unseenDev[c]).toBe(truth[c]);
        expect(obs.bankSize).toBe(19);
      }
    }
  });

  it('gives the acting seat a decision that fits the phase, and idle seats none', () => {
    const expected: Partial<Record<GameState['phase'], string[]>> = {
      setupRound1: ['setupSettlement', 'setupRoad'],
      setupRound2: ['setupSettlement', 'setupRoad'],
      rollOrPlayKnight: ['roll'],
      discard: ['discard'],
      moveRobber: ['robberHex'],
      main: ['main', 'tradeResponse'],
    };
    const seen = new Set<string>();
    for (const { state, knowledge } of sampleGames({ players: 4, games: 2, seed: 7 })) {
      const acting = getActingPlayerId(state);
      for (const p of state.players) {
        const d = observe(state, p.id, knowledge[p.id]!).decision;
        if (p.id === acting && !state.pendingTrade) {
          expect(expected[state.phase]).toContain(d?.type);
          seen.add(d!.type);
        } else if (state.phase === 'discard') {
          expect(d?.type ?? null).toBe(state.discardState!.required[p.id] !== undefined ? 'discard' : null);
        } else if (state.pendingTrade) {
          const pt = state.pendingTrade;
          const answers = p.id !== pt.proposerId && (pt.proposerId === acting ? !pt.rejectedBy.includes(p.id) : p.id === acting);
          expect(d?.type ?? null).toBe(answers ? 'tradeResponse' : null);
        } else {
          expect(d).toBeNull();
        }
      }
    }
    for (const t of ['setupSettlement', 'setupRoad', 'roll', 'main', 'discard', 'robberHex']) expect(seen).toContain(t);
  });

  it('a robber draft turns the hex choice into a choice of victim', () => {
    const sample = sampleGames({ players: 4, games: 3, seed: 13 }).find(({ state }) => state.phase === 'moveRobber')!;
    const { state, knowledge } = sample;
    const viewer = getActingPlayerId(state);
    const target = state.board.hexIds.find((h) => h !== state.board.robberHex
      && state.players.some((p) => p.id !== viewer && RESOURCES.some((r) => p.resources[r] > 0)
        && state.board.hexes[h]!.corners.some((v) => p.settlements.includes(v) || p.cities.includes(v))))!;
    const d = observe(state, viewer, knowledge[viewer]!, { draft: { robberHex: target } }).decision;
    expect(d?.type).toBe('robberVictim');
    if (d?.type === 'robberVictim') {
      expect(d.hex).toBe(target);
      expect(d.candidates.length).toBeGreaterThan(0);
      expect(d.candidates).not.toContain(0);
    }
  });
});

describe('supportsNeuralAi', () => {
  it('is the standard base game only, at any player count', () => {
    const settings = (over: Partial<GameState['settings']>) => ({
      ...createGame({ playerNames: ['a', 'b', 'c', 'd'], seed: 1 }).settings, ...over,
    });
    expect(supportsNeuralAi(settings({}))).toBe(true);
    expect(supportsNeuralAi(createGame({ playerNames: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], seed: 1 }).settings)).toBe(true);
    expect(supportsNeuralAi(settings({ baseScenarioId: 'standard' }))).toBe(true);
    expect(supportsNeuralAi(settings({ expansions: ['seafarers'] }))).toBe(false);
    expect(supportsNeuralAi(settings({ baseScenarioId: 'volcano' }))).toBe(false);
    expect(supportsNeuralAi(settings({ tradersVariants: { friendlyRobber: true } }))).toBe(false);
  });
});
