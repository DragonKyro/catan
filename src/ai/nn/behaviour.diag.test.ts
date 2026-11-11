// Behaviour diagnostic (not a regression test; skipped unless DIAG=1):
// seeded 4p tables of heuristic AIs, of one network level, and one network
// seat among three heuristics, reporting road loops, trade habits (repeats,
// shapes, cards won / lost), dev cards vs cities, where VPs come from, the
// opening (resource spread, 2:1 harbors), bank-trade rates, trading down to
// build, cards lost to 7s and who the robber hits.
//
//   DIAG=1 [DIAG_LEVEL=easy|normal|hard] [DIAG_GAMES=24] npx vitest run src/ai/nn/behaviour.diag.test.ts
//
// Use it to measure an AI change before and after.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction, calculateRouteLength } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { getBankTradeRate } from '@/game/actions/trade';
import { rollDice } from '@/game/rng';
import { calculateVictoryPoints } from '@/game/scoring/points';
import type { Action, AiLevel, EdgeId, GameState, PlayerId, Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';
import { AI_LEVELS, loadedAiLevel, setAiLevelNet } from './levels';
import { KnowledgeSession, chooseNeuralAction } from './index';
import { CatanPolicyNet, type CatanPolicyFile } from './runtime';

type Kind = 'heuristic' | AiLevel;

const LEVEL: AiLevel = (process.env.DIAG_LEVEL as AiLevel) ?? 'hard';
setAiLevelNet(
  LEVEL,
  new CatanPolicyNet(JSON.parse(readFileSync(resolve('src/ai/nn/policies', AI_LEVELS[LEVEL].file), 'utf8')) as CatanPolicyFile),
);

interface Stat {
  seats: number;
  wins: number;
  vp: number;
  roads: number;
  loopRoads: number;
  settlements: number;
  cities: number;
  devs: number;
  devWhileArmyLost: number;
  knights: number;
  devWhileCityAffordable: number;
  unplayedDevsAtEnd: number;
  vpFrom: { settle: number; city: number; road: number; army: number; vpCards: number };
  spent: { road: number; settle: number; city: number; dev: number };
  offers: number;
  offersRepeatedThisTurn: number;
  offersRepeatedLaterTurn: number;
  offersByShape: Record<string, number>;
  offersAccepted: number;
  acceptedGave: number;
  acceptedGot: number;
  answeredAccept: number;
  answeredGave: number;
  answeredGot: number;
  longest: number;
  // Opening (after setup).
  openingResources: number[]; // distinct resources produced, per seat
  openingOn2to1: number;
  openingPips: number;
  // Bank trades by rate, and whether the turn they were made in built something.
  bankByRate: Record<string, number>;
  bankTurnsBuilt: number;
  bankTurnsIdle: number;
  // Hand management.
  discarded: number;
  endTurnsHolding8: number;
  // Robber.
  robberMoves: number;
  robbedLeader: number;
  robbedNoOne: number;
  robberOnOwnHex: number;
}

const blank = (): Stat => ({
  seats: 0, wins: 0, vp: 0, roads: 0, loopRoads: 0, settlements: 0, cities: 0, devs: 0, devWhileArmyLost: 0, knights: 0,
  devWhileCityAffordable: 0, unplayedDevsAtEnd: 0,
  vpFrom: { settle: 0, city: 0, road: 0, army: 0, vpCards: 0 },
  spent: { road: 0, settle: 0, city: 0, dev: 0 },
  offers: 0, offersRepeatedThisTurn: 0, offersRepeatedLaterTurn: 0, offersByShape: {}, offersAccepted: 0,
  acceptedGave: 0, acceptedGot: 0, answeredAccept: 0, answeredGave: 0, answeredGot: 0, longest: 0,
  openingResources: [], openingOn2to1: 0, openingPips: 0,
  bankByRate: {}, bankTurnsBuilt: 0, bankTurnsIdle: 0,
  discarded: 0, endTurnsHolding8: 0,
  robberMoves: 0, robbedLeader: 0, robbedNoOne: 0, robberOnOwnHex: 0,
});

const count = (b: Partial<ResourceBank>) => Object.values(b).reduce((a, n) => a + (n ?? 0), 0);
const player = (s: GameState, id: PlayerId) => s.players.find((q) => q.id === id)!;
const handSize = (s: GameState, id: PlayerId) => count(player(s, id).resources);
const canCity = (s: GameState, id: PlayerId) => {
  const p = player(s, id);
  return p.resources.ore >= 3 && p.resources.wheat >= 2 && p.settlements.length > 0 && p.cities.length < 4;
};
const pipsOf = (n: number | null) => (n === null ? 0 : 6 - Math.abs(7 - n));

/** Would road `edge` close a loop in `id`'s own road network? */
function closesLoop(s: GameState, id: PlayerId, edge: EdgeId): boolean {
  const own = new Set(player(s, id).roads);
  const [u, v] = s.board.edges[edge]!.vertices;
  const seen = new Set([u]);
  const queue = [u];
  while (queue.length) {
    const x = queue.pop()!;
    if (x === v) return true;
    for (const e of s.board.vertices[x]!.edges) {
      if (!own.has(e)) continue;
      const [a, b] = s.board.edges[e]!.vertices;
      const y = a === x ? b : a;
      if (!seen.has(y)) {
        seen.add(y);
        queue.push(y);
      }
    }
  }
  return false;
}

function opening(s: GameState, st: Stat, id: PlayerId) {
  const p = player(s, id);
  const produced = new Set<Resource>();
  let pips = 0;
  for (const v of [...p.settlements, ...p.cities]) {
    for (const h of s.board.vertices[v]!.hexes) {
      const hex = s.board.hexes[h]!;
      if ((RESOURCES as readonly string[]).includes(hex.terrain) && hex.numberToken !== null) {
        produced.add(hex.terrain as Resource);
        pips += pipsOf(hex.numberToken);
      }
    }
  }
  st.openingResources.push(produced.size);
  st.openingPips += pips;
  if (p.ports.some((t) => t !== 'generic')) st.openingOn2to1++;
}

function decidingSeat(s: GameState): PlayerId {
  const pt = s.pendingTrade;
  if (pt) {
    const acting = s.playerOrder[s.currentPlayerIndex]!;
    if (pt.proposerId !== acting) return acting;
    const n = s.playerOrder.length;
    const at = s.playerOrder.indexOf(pt.proposerId);
    for (let k = 1; k < n; k++) {
      const id = s.playerOrder[(at + k) % n]!;
      if (!pt.rejectedBy.includes(id)) return id;
    }
  }
  return getActingPlayerId(s);
}

function play(seed: number, kinds: Kind[], stats: Record<string, Stat>) {
  const names = kinds.map((_, i) => `p${i}`);
  const initial = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { victoryPointsToWin: 10, aiLevel: LEVEL },
  });
  const kindOf = (id: PlayerId) => kinds[names.indexOf(id)]!;
  const netSeats = names.filter((_, i) => kinds[i] !== 'heuristic');
  const session = new KnowledgeSession();
  const actions: Action[] = [];
  let s = initial;
  let dice = (seed * 2654435761) >>> 0;
  let turn = 0;
  let openingDone = false;
  const offeredThisTurn = new Set<string>();
  const offeredBefore = new Set<string>();
  let bankedThisTurn = false;
  let builtThisTurn = false;
  for (let step = 0; s.phase !== 'gameOver' && step < 20000; step++) {
    if (!openingDone && s.phase === 'main') {
      openingDone = true;
      for (const p of s.players) opening(s, stats[kindOf(p.id)]!, p.id);
    }
    const id = decidingSeat(s);
    let action: Action;
    if (netSeats.includes(id)) {
      const known = session.sync(initial, actions, s, netSeats)!;
      action =
        chooseNeuralAction(s, id, known[id]!, loadedAiLevel(LEVEL)!) ??
        (s.pendingTrade?.proposerId === id
          ? { type: 'cancelTrade', playerId: id }
          : chooseAction(s, id) ?? { type: 'endTurn', playerId: id });
    } else if (s.pendingTrade && s.pendingTrade.proposerId !== id) {
      const counter = s.pendingTrade.proposerId !== s.playerOrder[s.currentPlayerIndex];
      action = shouldAcceptTrade(s, id)
        ? { type: 'acceptTrade', playerId: id }
        : { type: counter ? 'cancelTrade' : 'rejectTrade', playerId: id };
    } else {
      action = chooseAction(s, id) ?? { type: 'endTurn', playerId: id };
    }
    if (action.type === 'rollDice' && !action.dice) {
      const [d, next] = rollDice(dice);
      dice = next;
      action = { ...action, dice: d };
    }
    const actor = action.playerId;
    const st = stats[kindOf(actor)]!;
    const main = s.phase === 'main';
    switch (action.type) {
      case 'buildRoad':
        if (main) {
          st.roads++;
          st.spent.road += 2;
          builtThisTurn = true;
          if (closesLoop(s, actor, action.edge)) st.loopRoads++;
        }
        break;
      case 'playRoadBuilding': {
        let t = s;
        for (const e of action.edges) {
          st.roads++;
          if (closesLoop(t, actor, e)) st.loopRoads++;
          t = { ...t, players: t.players.map((p) => (p.id === actor ? { ...p, roads: [...p.roads, e] } : p)) };
        }
        break;
      }
      case 'buildSettlement':
        st.settlements++;
        st.spent.settle += 4;
        builtThisTurn = true;
        break;
      case 'buildCity':
        st.cities++;
        st.spent.city += 5;
        builtThisTurn = true;
        break;
      case 'buyDevCard': {
        st.devs++;
        st.spent.dev += 3;
        builtThisTurn = true;
        if (canCity(s, actor)) st.devWhileCityAffordable++;
        const holder = s.largestArmy?.holder;
        if (holder && holder !== actor && s.largestArmy!.size - player(s, actor).devCards.playedKnights >= 3) st.devWhileArmyLost++;
        break;
      }
      case 'playKnight':
        st.knights++;
        break;
      case 'bankTrade': {
        const rate = getBankTradeRate(s, actor, action.give);
        st.bankByRate[`${rate}:1`] = (st.bankByRate[`${rate}:1`] ?? 0) + (action.count ?? 1);
        bankedThisTurn = true;
        break;
      }
      case 'discard':
        st.discarded += count(action.resources);
        break;
      case 'moveRobber': {
        st.robberMoves++;
        const hex = s.board.hexes[action.hex]!;
        const mine = [...player(s, actor).settlements, ...player(s, actor).cities];
        if (mine.some((v) => s.board.vertices[v]!.hexes.includes(action.hex)) && hex.numberToken !== null) st.robberOnOwnHex++;
        if (!action.stealFrom) st.robbedNoOne++;
        else {
          let leader: PlayerId | null = null;
          let best = -1;
          for (const p of s.players) {
            if (p.id === actor) continue;
            const vp = calculateVictoryPoints(s, p.id, false);
            if (vp > best) {
              best = vp;
              leader = p.id;
            }
          }
          if (action.stealFrom === leader) st.robbedLeader++;
        }
        break;
      }
      case 'proposeTrade': {
        const key = `${actor}|${JSON.stringify(action.give)}|${JSON.stringify(action.receive)}`;
        st.offers++;
        if (offeredThisTurn.has(key)) st.offersRepeatedThisTurn++;
        else if (offeredBefore.has(key)) st.offersRepeatedLaterTurn++;
        offeredThisTurn.add(key);
        offeredBefore.add(key);
        const shape = `${count(action.give)}:${count(action.receive)}`;
        st.offersByShape[shape] = (st.offersByShape[shape] ?? 0) + 1;
        break;
      }
      case 'acceptTrade': {
        const pt = s.pendingTrade!;
        const proposer = stats[kindOf(pt.proposerId)]!;
        proposer.offersAccepted++;
        proposer.acceptedGave += count(pt.give);
        proposer.acceptedGot += count(pt.receive);
        st.answeredAccept++;
        st.answeredGave += count(pt.receive);
        st.answeredGot += count(pt.give);
        break;
      }
      case 'endTurn':
        if (main) {
          if (handSize(s, actor) >= 8) st.endTurnsHolding8++;
          if (bankedThisTurn) {
            if (builtThisTurn) st.bankTurnsBuilt++;
            else st.bankTurnsIdle++;
          }
        }
        break;
    }
    const after = applyAction(s, action);
    if (action.type === 'endTurn' && after.currentPlayerIndex !== s.currentPlayerIndex) {
      turn++;
      offeredThisTurn.clear();
      bankedThisTurn = false;
      builtThisTurn = false;
    }
    s = after;
    actions.push(action);
  }
  for (const p of s.players) {
    const st = stats[kindOf(p.id)]!;
    st.seats++;
    if (s.winner === p.id) st.wins++;
    st.vp += calculateVictoryPoints(s, p.id, true);
    st.vpFrom.settle += p.settlements.length;
    st.vpFrom.city += 2 * p.cities.length;
    st.vpFrom.road += p.hasLongestRoad ? 2 : 0;
    st.vpFrom.army += p.hasLargestArmy ? 2 : 0;
    st.vpFrom.vpCards += p.devCards.victoryPoints;
    st.unplayedDevsAtEnd += [...p.devCards.unplayed, ...p.devCards.boughtThisTurn].filter((c) => c !== 'victoryPoint').length;
    st.longest += calculateRouteLength(s, p.id);
  }
  return turn;
}

function report(label: string, stats: Record<string, Stat>, games: number, turns: number) {
  const lines = [`\n=== ${label}: ${games} games, avg ${(turns / games).toFixed(0)} turns`];
  for (const [kind, st] of Object.entries(stats)) {
    if (!st.seats) continue;
    const per = (n: number) => (n / st.seats).toFixed(2);
    const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : '-');
    const spent = st.spent.road + st.spent.settle + st.spent.city + st.spent.dev;
    const spread = [3, 4, 5].map((n) => `${n}:${pct(st.openingResources.filter((x) => (n === 3 ? x <= 3 : x === n)).length, st.openingResources.length)}`).join(' ');
    lines.push(
      `[${kind}] seats ${st.seats} win ${pct(st.wins, st.seats)} vp ${per(st.vp)}`,
      `  per seat: roads ${per(st.roads)} (loop-closing ${pct(st.loopRoads, st.roads)}) settlements ${per(st.settlements)} cities ${per(st.cities)} devs ${per(st.devs)} knights ${per(st.knights)} longest route ${per(st.longest)}`,
      `  spend share: road ${pct(st.spent.road, spent)} settle ${pct(st.spent.settle, spent)} city ${pct(st.spent.city, spent)} dev ${pct(st.spent.dev, spent)} | dev bought with city affordable ${pct(st.devWhileCityAffordable, st.devs)} | dev bought with army out of reach (holder 3+ knights ahead) ${pct(st.devWhileArmyLost, st.devs)} | unplayed devs at end ${per(st.unplayedDevsAtEnd)}`,
      `  VP from: settle ${per(st.vpFrom.settle)} city ${per(st.vpFrom.city)} LR ${per(st.vpFrom.road)} LA ${per(st.vpFrom.army)} VPcards ${per(st.vpFrom.vpCards)}`,
      `  opening: resources produced ≤3/4/5 ${spread} | on a 2:1 harbor ${pct(st.openingOn2to1, st.openingResources.length)} | pips ${per(st.openingPips)}`,
      `  bank trades ${per(Object.values(st.bankByRate).reduce((a, b) => a + b, 0))}/seat by rate ${JSON.stringify(st.bankByRate)} | turns with a bank trade that built something ${pct(st.bankTurnsBuilt, st.bankTurnsBuilt + st.bankTurnsIdle)}`,
      `  hand: cards lost to 7s ${per(st.discarded)}/seat | turns ended holding 8+ ${per(st.endTurnsHolding8)}/seat`,
      `  robber: moves ${per(st.robberMoves)}/seat, robbed the VP leader ${pct(st.robbedLeader, st.robberMoves)}, robbed no one ${pct(st.robbedNoOne, st.robberMoves)}, on own producing hex ${pct(st.robberOnOwnHex, st.robberMoves)}`,
      `  offers ${per(st.offers)}/seat: repeated same turn ${pct(st.offersRepeatedThisTurn, st.offers)}, re-offered later ${pct(st.offersRepeatedLaterTurn, st.offers)}, shapes ${JSON.stringify(st.offersByShape)}, accepted ${pct(st.offersAccepted, st.offers)} (gave ${st.acceptedGave} got ${st.acceptedGot})`,
      `  accepted others' offers ${per(st.answeredAccept)}/seat (gave ${st.answeredGave} got ${st.answeredGot})`,
    );
  }
  console.log(lines.join('\n'));
}

describe.skipIf(!process.env.DIAG)('AI behaviour diagnostic', () => {
  const GAMES = Number(process.env.DIAG_GAMES ?? 24);
  const tables: [string, (g: number) => Kind[]][] = [
    ['4 heuristic', () => ['heuristic', 'heuristic', 'heuristic', 'heuristic']],
    [`4 ${LEVEL}`, () => [LEVEL, LEVEL, LEVEL, LEVEL]],
    [`1 ${LEVEL} + 3 heuristic`, (g) => [0, 1, 2, 3].map((i) => (i === g % 4 ? LEVEL : 'heuristic'))],
  ];
  it.each(tables)('%s', (label, seats) => {
    const stats: Record<string, Stat> = { heuristic: blank(), [LEVEL]: blank() };
    let turns = 0;
    for (let g = 0; g < GAMES; g++) turns += play(5000 + g, seats(g), stats);
    report(label, stats, GAMES, turns);
  }, 3_600_000);
});
