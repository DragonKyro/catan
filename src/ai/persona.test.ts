import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { canPlaceInitialSettlement } from '@/game/placement';
import type { Action, GameState, PlayerId, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from './index';
import {
  PERSONAS,
  PERSONA_IDS,
  activePersona,
  cornerDistance,
  cornerPips,
  harborCorners,
  playStyleActive,
  portFocus,
  vpSources,
  withPersona,
  type PersonaId,
} from './persona';
import { chooseSetupSettlement } from './setup';

/** Seeded stand-in for Math.random (the heuristic rolls its dice with it). */
function seedRandom(seed: number) {
  let rng = seed >>> 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  });
}

afterEach(() => vi.restoreAllMocks());

const names = ['p0', 'p1', 'p2', 'p3'];
const newGame = (seed: number) =>
  createGame({ playerNames: names, playerTypes: names.map(() => 'ai' as const), seed, settings: { victoryPointsToWin: 10 } });

/** One seeded game: `persona` in `seat`, all-rounders elsewhere. Returns the end state and offers per player per turn. */
function playOut(seed: number, persona: PersonaId, seat: number) {
  seedRandom(seed);
  let s: GameState = newGame(seed);
  const personaOf = (id: PlayerId): PersonaId => (names.indexOf(id) === seat ? persona : 'allRounder');
  const offers = new Map<string, number>();
  let turn = 0;
  for (let n = 0; s.phase !== 'gameOver' && n < 6000; n++) {
    const pt = s.pendingTrade;
    let action: Action;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id, personaOf(p.id)));
      action = acceptor ? { type: 'acceptTrade', playerId: acceptor.id } : { type: 'cancelTrade', playerId: pt.proposerId };
    } else {
      const id = getActingPlayerId(s);
      action = chooseAction(s, id, personaOf(id)) ?? { type: 'endTurn', playerId: id };
    }
    if (action.type === 'proposeTrade') {
      const key = `${turn}|${action.playerId}`;
      offers.set(key, (offers.get(key) ?? 0) + 1);
    }
    const after = applyAction(s, action);
    if (action.type === 'endTurn' && after.currentPlayerIndex !== s.currentPlayerIndex) turn++;
    s = after;
  }
  return { final: s, maxOffersInATurn: Math.max(0, ...offers.values()) };
}

describe('withPersona', () => {
  it('scopes the persona to the call, restores it after, and lets undefined inherit', () => {
    expect(activePersona().id).toBe('allRounder');
    withPersona('longestRoad', () => {
      expect(activePersona().id).toBe('longestRoad');
      withPersona(undefined, () => expect(activePersona().id).toBe('longestRoad'));
      withPersona('griefer', () => expect(activePersona().id).toBe('griefer'));
      expect(activePersona().id).toBe('longestRoad');
    });
    expect(activePersona().id).toBe('allRounder');
    expect(() => withPersona('citiesFirst', () => { throw new Error('boom'); })).toThrow('boom');
    expect(activePersona().id).toBe('allRounder');
  });

  it('defines eleven personas: the all-rounder, six placement styles and four play styles', () => {
    expect(PERSONA_IDS).toHaveLength(11);
    const ids = Object.values(PERSONAS);
    expect(ids.filter((p) => p.placement === 'balanced' && p.play === 'balanced').map((p) => p.id)).toEqual(['allRounder']);
    expect(ids.filter((p) => p.placement !== 'balanced')).toHaveLength(6);
    expect(ids.filter((p) => p.play !== 'balanced')).toHaveLength(4);
    expect(ids.every((p) => p.placement === 'balanced' || p.play === 'balanced')).toBe(true);
  });
});

describe('placement styles', () => {
  const firstCorner = (persona: PersonaId, seed: number) => {
    const s = newGame(seed);
    const id = s.playerOrder[0]!;
    return { s, id, v: withPersona(persona, () => chooseSetupSettlement(s, id)) };
  };
  const sum = (pips: Record<Resource, number>, rs: Resource[]) => rs.reduce((a, r) => a + pips[r], 0);

  it('ore / wheat / sheep and wood / brick starts lean on their resources', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ows = firstCorner('oreWheatSheep', seed);
      const owsPips = cornerPips(ows.s, ows.v);
      expect(sum(owsPips, ['ore', 'wheat', 'sheep'])).toBeGreaterThan(sum(owsPips, ['wood', 'brick']));
      const wb = firstCorner('woodBrick', seed);
      const wbPips = cornerPips(wb.s, wb.v);
      expect(sum(wbPips, ['wood', 'brick'])).toBeGreaterThan(sum(wbPips, ['ore', 'sheep']));
    }
  });

  it('the highest-pips start takes the corner with the most pips', () => {
    for (const seed of [1, 2, 3]) {
      const { s, v } = firstCorner('highPips', seed);
      const best = Math.max(...s.board.vertexIds.filter((c) => canPlaceInitialSettlement(s, c)).map((c) => sum(cornerPips(s, c), [...RESOURCES])));
      expect(sum(cornerPips(s, v), [...RESOURCES])).toBe(best);
    }
  });

  it('the port stacker stacks one resource that has a 2:1 harbor', () => {
    // Share of the opening pips on that resource after the whole setup, seat 1,
    // for the stacker vs an all-rounder in the same seat.
    const share = (persona: PersonaId) => {
      let total = 0;
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        seedRandom(seed);
        let s = newGame(seed);
        const me = s.playerOrder[1]!;
        while (s.phase !== 'main') {
          const id = getActingPlayerId(s);
          s = applyAction(s, chooseAction(s, id, id === me ? persona : undefined)!);
        }
        const focus = withPersona('portStack', () => portFocus(s, me))!;
        expect(harborCorners(s, focus).length).toBeGreaterThan(0);
        let focusPips = 0;
        let all = 0;
        for (const v of s.players.find((p) => p.id === me)!.settlements) {
          const pips = cornerPips(s, v);
          focusPips += pips[focus];
          all += sum(pips, [...RESOURCES]);
        }
        total += focusPips / all;
        vi.restoreAllMocks();
      }
      return total / 8;
    };
    const stacker = share('portStack');
    expect(stacker).toBeGreaterThanOrEqual(0.45);
    expect(stacker - share('allRounder')).toBeGreaterThanOrEqual(0.1);
  });

  it('the griefer starts as close to a rival as the distance rule allows', () => {
    let crowded = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      // Let the all-rounders place first, then the griefer.
      seedRandom(seed);
      let s = newGame(seed);
      const griefer = s.playerOrder[2]!;
      while (s.setupState?.step !== 'settlement' || getActingPlayerId(s) !== griefer) {
        const id = getActingPlayerId(s);
        s = applyAction(s, chooseAction(s, id)!);
      }
      const v = withPersona('griefer', () => chooseSetupSettlement(s, griefer));
      const rivals = s.players.flatMap((p) => p.settlements);
      if (rivals.some((b) => cornerDistance(s, v, [b], 2) === 2)) crowded++;
    }
    expect(crowded).toBeGreaterThanOrEqual(4);
  });
});

describe('pivots', () => {
  it('an AI with nothing to build on (every settlement upgraded, no open spot) pivots away from building', () => {
    seedRandom(9);
    // A finished game gives a realistic crowded board; strip p0 down to cities only.
    const { final } = playOut(9, 'allRounder', 0);
    const id = final.players[0]!.id;
    const cities = [...final.players[0]!.settlements, ...final.players[0]!.cities].slice(0, 3);
    const s: GameState = {
      ...final,
      phase: 'main',
      winner: null,
      players: final.players.map((p) => (p.id === id ? { ...p, settlements: [], cities, roads: [] } : p)),
    };
    const src = vpSources(s, id);
    expect(src.cityNow).toBe(false);
    expect(src.settleNow).toBe(false);
    expect(playStyleActive(s, id)).not.toBe('balanced');
    // Knights in hand make Largest Army the cheap VP left.
    const armed: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.id === id ? { ...p, devCards: { ...p.devCards, unplayed: ['knight', 'knight', 'knight', 'knight', 'knight'] } } : p,
      ),
    };
    if (!armed.noLargestArmy && !armed.players[0]!.hasLargestArmy) {
      expect(playStyleActive(armed, id)).toBe('largestArmy');
    }
  });
});

describe('every persona plays whole games', () => {
  it.each(PERSONA_IDS)('%s finishes 4p games, never making more than 2 offers in a turn', (persona) => {
    for (const [seed, seat] of [[101, 0], [202, 2]] as const) {
      const { final, maxOffersInATurn } = playOut(seed, persona, seat);
      expect(final.phase).toBe('gameOver');
      expect(final.winner).not.toBeNull();
      // The trade limiter: at most 2 offers per turn, so at most 2 refused.
      expect(maxOffersInATurn).toBeLessThanOrEqual(2);
    }
  }, 120_000);
});
