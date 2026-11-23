// Persona diagnostic (not a regression test; skipped unless DIAG=1).
//
// 1. Each heuristic persona (persona.ts) as one seat among three
//    all-rounders, rotating seats, on seeded games. Reports its win rate
//    (25% = all-rounder strength at 4p) and the habits its style should show
//    next to the all-rounders' in the same games.
// 2. A tournament: mixed tables of four distinct personas drawn per game from
//    the seed, ranking them against each other (win rate, mean place, and a
//    Bradley-Terry strength on an Elo scale from every pair that shared a
//    table).
//
// Latest results: docs/ai-strength.md (update it when you rerun).
//
//   DIAG=1 [DIAG_GAMES=100] npx vitest run src/ai/personas.diag.test.ts -t "three all-rounders"
//   DIAG=1 [DIAG_TABLES=3000] npx vitest run src/ai/personas.diag.test.ts -t "tournament"
import { pendingTradeStep } from './trade';
import { describe, it, vi } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { getPortAtVertex } from '@/game/board/adjacency';
import { calculateVictoryPoints } from '@/game/scoring/points';
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
      action = pendingTradeStep(s, (id) => shouldAcceptTrade(s, id, personaOf(id)));
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

/** Four distinct personas for a tournament table, drawn from the seed. */
function tablePersonas(seed: number): PersonaId[] {
  let r = (seed * 2246822519) >>> 0;
  const next = () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
  const pool = [...PERSONA_IDS];
  const out: PersonaId[] = [];
  while (out.length < 4) out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]!);
  return out;
}

interface TableSeat {
  persona: PersonaId;
  vp: number;
  won: boolean;
}

function playTable(seed: number): TableSeat[] {
  let rng = (seed * 2654435761) >>> 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  });
  const names = ['p0', 'p1', 'p2', 'p3'];
  const personas = tablePersonas(seed);
  const personaOf = (id: PlayerId) => personas[names.indexOf(id)]!;
  let s: GameState = createGame({ playerNames: names, playerTypes: names.map(() => 'ai' as const), seed, settings: { victoryPointsToWin: 10 } });
  for (let n = 0; s.phase !== 'gameOver' && n < 6000; n++) {
    const pt = s.pendingTrade;
    let action: Action;
    if (pt) {
      action = pendingTradeStep(s, (id) => shouldAcceptTrade(s, id, personaOf(id)));
    } else {
      const id = getActingPlayerId(s);
      action = chooseAction(s, id, personaOf(id)) ?? { type: 'endTurn', playerId: id };
    }
    s = applyAction(s, action);
  }
  vi.restoreAllMocks();
  return names.map((id) => ({ persona: personaOf(id), vp: calculateVictoryPoints(s, id, true), won: s.winner === id }));
}

/** Places 1-4 by VP (the winner breaks a tie); tied seats share the average place. */
function places(seats: TableSeat[]): number[] {
  const score = seats.map((t) => t.vp + (t.won ? 0.5 : 0));
  return score.map((v) => 1 + score.filter((w) => w > v).length + (score.filter((w) => w === v).length - 1) / 2);
}

/** 95% Wilson interval for k wins in n seats. */
function wilson(k: number, n: number): [number, number] {
  const z = 1.96;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / den;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [c - h, c + h];
}

function tournamentReport(tables: TableSeat[][]): string {
  const ids = [...PERSONA_IDS];
  const st = Object.fromEntries(ids.map((id) => [id, { seats: 0, wins: 0, place: 0, vp: 0 }]));
  // ahead[a][b]: times a finished above b at a shared table (ties count half).
  const ahead = Object.fromEntries(ids.map((a) => [a, Object.fromEntries(ids.map((b) => [b, 0]))])) as Record<
    PersonaId,
    Record<PersonaId, number>
  >;
  for (const seats of tables) {
    const pl = places(seats);
    seats.forEach((t, i) => {
      const x = st[t.persona]!;
      x.seats++;
      x.wins += t.won ? 1 : 0;
      x.place += pl[i]!;
      x.vp += t.vp;
      seats.forEach((u, j) => {
        if (i !== j) ahead[t.persona][u.persona] += pl[i]! < pl[j]! ? 1 : pl[i] === pl[j] ? 0.5 : 0;
      });
    });
  }
  // Bradley-Terry strengths by minorization-maximization, geometric mean 1.
  let bt = Object.fromEntries(ids.map((id) => [id, 1])) as Record<PersonaId, number>;
  for (let it = 0; it < 500; it++) {
    const next = {} as Record<PersonaId, number>;
    for (const a of ids) {
      let w = 0;
      let den = 0;
      for (const b of ids) {
        if (a === b) continue;
        w += ahead[a][b];
        den += (ahead[a][b] + ahead[b][a]) / (bt[a] + bt[b]);
      }
      next[a] = den ? w / den : bt[a];
    }
    const gm = Math.exp(ids.reduce((acc, id) => acc + Math.log(next[id]), 0) / ids.length);
    bt = Object.fromEntries(ids.map((id) => [id, next[id] / gm])) as Record<PersonaId, number>;
  }
  const base = bt.allRounder;
  const order = [...ids].sort((a, b) => bt[b] - bt[a]);
  const lines = [
    '',
    `persona tournament: ${tables.length} tables of 4 distinct personas`,
    'elo = 400*log10(Bradley-Terry strength), all-rounder 0; ahead = chance to finish above the all-rounder at a shared table',
  ];
  for (const id of order) {
    const x = st[id]!;
    const [lo, hi] = wilson(x.wins, x.seats);
    const elo = 400 * Math.log10(bt[id] / base);
    lines.push(
      [
        id.padEnd(15),
        `seats ${String(x.seats).padStart(4)}`,
        `win ${((100 * x.wins) / x.seats).toFixed(1).padStart(4)}% (${(100 * lo).toFixed(1)}-${(100 * hi).toFixed(1)})`,
        `place ${(x.place / x.seats).toFixed(2)}`,
        `vp ${(x.vp / x.seats).toFixed(2)}`,
        `elo ${(elo >= 0 ? '+' : '') + elo.toFixed(0)}`,
        `ahead ${(bt[id] / (bt[id] + base)).toFixed(2)}`,
      ].join('  '),
    );
  }
  lines.push(
    '',
    'pairwise: row finished above column (share of shared tables)',
    ' '.repeat(15) + order.map((b) => b.slice(0, 6).padStart(7)).join(''),
  );
  for (const a of order) {
    const cells = order.map((b) => {
      const n = ahead[a][b] + ahead[b][a];
      return (a === b ? '-' : n ? (ahead[a][b] / n).toFixed(2) : '?').padStart(7);
    });
    lines.push(a.padEnd(15) + cells.join(''));
  }
  return lines.join('\n');
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

  it('persona tournament', () => {
    const n = Number(process.env.DIAG_TABLES ?? 3000);
    const tables: TableSeat[][] = [];
    for (let g = 0; g < n; g++) tables.push(playTable(20000 + g));
    console.log(tournamentReport(tables));
  }, 3_600_000);
});
