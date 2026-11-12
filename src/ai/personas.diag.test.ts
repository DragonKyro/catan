// Persona diagnostic (not a regression test; skipped unless DIAG=1): each
// heuristic persona (persona.ts) as one seat among three all-rounders,
// rotating seats, on seeded games. Reports its win rate (25% = all-rounder
// strength at 4p) and the habits its style should show next to the
// all-rounders' in the same games.
//
//   DIAG=1 [DIAG_GAMES=100] npx vitest run src/ai/personas.diag.test.ts
import { describe, it, vi } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { getPortAtVertex } from '@/game/board/adjacency';
import type { Action, GameState, PlayerId, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from './index';
import { PERSONA_IDS, cornerDistance, cornerPips, type PersonaId } from './persona';

interface Tally {
  seats: number;
  wins: number;
  vp: number;
  // opening (after setup)
  pips: Record<Resource, number>;
  allFive: number;
  totalPips: number;
  rivalCrowding: number;
  // end of game
  harbor2to1: number;
  longestRoad: number;
  largestArmy: number;
  cities: number;
  settlementsBuilt: number;
  roadsBuilt: number;
  devs: number;
  knights: number;
  turns: number;
  noWinner: number;
}

const blank = (): Tally => ({
  seats: 0, wins: 0, vp: 0, pips: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, allFive: 0, totalPips: 0,
  rivalCrowding: 0, harbor2to1: 0, longestRoad: 0, largestArmy: 0, cities: 0, settlementsBuilt: 0, roadsBuilt: 0,
  devs: 0, knights: 0, turns: 0, noWinner: 0,
});

function play(seed: number, personaSeat: number, persona: PersonaId, tallies: { persona: Tally; base: Tally }) {
  let rng = (seed * 2654435761) >>> 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  });
  const names = ['p0', 'p1', 'p2', 'p3'];
  let s: GameState = createGame({ playerNames: names, playerTypes: names.map(() => 'ai' as const), seed, settings: { victoryPointsToWin: 10 } });
  const personaOf = (id: PlayerId): PersonaId => (names.indexOf(id) === personaSeat ? persona : 'allRounder');
  const tallyOf = (id: PlayerId) => (names.indexOf(id) === personaSeat ? tallies.persona : tallies.base);
  let openingDone = false;
  let turns = 0;
  for (let n = 0; s.phase !== 'gameOver' && n < 6000; n++) {
    if (!openingDone && s.phase === 'main') {
      openingDone = true;
      for (const p of s.players) {
        const t = tallyOf(p.id);
        const produced = new Set<Resource>();
        for (const v of p.settlements) {
          const pips = cornerPips(s, v);
          for (const r of RESOURCES) {
            t.pips[r] += pips[r];
            t.totalPips += pips[r];
            if (pips[r] > 0) produced.add(r);
          }
          const rivals = s.players.filter((q) => q.id !== p.id).flatMap((q) => q.settlements);
          t.rivalCrowding += rivals.filter((b) => cornerDistance(s, v, [b], 2) === 2).length;
        }
        if (produced.size === 5) t.allFive++;
      }
    }
    const pt = s.pendingTrade;
    let action: Action;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id, personaOf(p.id)));
      action = acceptor ? { type: 'acceptTrade', playerId: acceptor.id } : { type: 'cancelTrade', playerId: pt.proposerId };
    } else {
      const id = getActingPlayerId(s);
      action = chooseAction(s, id, personaOf(id)) ?? { type: 'endTurn', playerId: id };
    }
    const t = tallyOf(action.playerId);
    if (s.phase === 'main') {
      if (action.type === 'buildSettlement') t.settlementsBuilt++;
      if (action.type === 'buildRoad') t.roadsBuilt++;
      if (action.type === 'buyDevCard') t.devs++;
    }
    if (action.type === 'playRoadBuilding') t.roadsBuilt += action.edges.length;
    if (action.type === 'playKnight') t.knights++;
    const after = applyAction(s, action);
    if (action.type === 'endTurn' && after.currentPlayerIndex !== s.currentPlayerIndex) turns++;
    s = after;
  }
  vi.restoreAllMocks();
  for (const p of s.players) {
    const t = tallyOf(p.id);
    t.seats++;
    t.turns += turns;
    if (s.winner === p.id) t.wins++;
    if (s.winner === null) t.noWinner++;
    t.vp += p.settlements.length + 2 * p.cities.length + p.devCards.victoryPoints + (p.hasLongestRoad ? 2 : 0) + (p.hasLargestArmy ? 2 : 0);
    if ([...p.settlements, ...p.cities].some((v) => { const port = getPortAtVertex(s.board, v); return port !== null && port !== 'generic'; })) t.harbor2to1++;
    if (p.hasLongestRoad) t.longestRoad++;
    if (p.hasLargestArmy) t.largestArmy++;
    t.cities += p.cities.length;
  }
}

function row(label: string, t: Tally): string {
  const per = (n: number) => (n / t.seats).toFixed(2);
  const pct = (n: number) => `${((100 * n) / t.seats).toFixed(0)}%`;
  const share = (rs: Resource[]) => `${((100 * rs.reduce((a, r) => a + t.pips[r], 0)) / Math.max(1, t.totalPips)).toFixed(0)}%`;
  return [
    label.padEnd(16),
    `win ${pct(t.wins).padStart(4)}`,
    `vp ${per(t.vp)}`,
    `| open pips ${per(t.totalPips)} OWS ${share(['ore', 'wheat', 'sheep'])} WB ${share(['wood', 'brick'])} all5 ${pct(t.allFive)} crowd ${per(t.rivalCrowding)}`,
    `| 2:1 harbor ${pct(t.harbor2to1)} LR ${pct(t.longestRoad)} LA ${pct(t.largestArmy)}`,
    `| cities ${per(t.cities)} settles ${per(t.settlementsBuilt)} roads ${per(t.roadsBuilt)} devs ${per(t.devs)} knights ${per(t.knights)}`,
    `| turns ${(t.turns / t.seats).toFixed(0)} no winner ${pct(t.noWinner)}`,
  ].join(' ');
}

describe.skipIf(!process.env.DIAG)('persona diagnostic', () => {
  it('each persona vs three all-rounders', () => {
    const games = Number(process.env.DIAG_GAMES ?? 100);
    const lines = ['', `persona (1 seat) vs 3 all-rounders, ${games} games each; "others" = the all-rounders at its tables`];
    for (const persona of PERSONA_IDS) {
      const tallies = { persona: blank(), base: blank() };
      for (let g = 0; g < games; g++) play(7000 + g, g % 4, persona, tallies);
      lines.push(row(persona, tallies.persona), row('  others', tallies.base));
    }
    console.log(lines.join('\n'));
  }, 3_600_000);
});
