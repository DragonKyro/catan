// Test-only: seeded all-heuristic-AI Explorers & Pirates games with
// per-mechanic counters. Not imported by production code.
import type { Action, GameState, PlayerId } from '@/game/types';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { epGame } from '@/game/modules/explorersPirates/testSupport';
import { chooseAction, shouldAcceptTrade } from '@/ai';

export interface EpSimStats {
  steps: number;
  turns: number;
  explored: number;
  harbors: number;
  founded: number;
  roadSettlements: number;
  settlers: number;
  crews: number;
  ships: number;
  lairsCaptured: number;
  crewsToFarms: number;
  fishLoaded: number;
  fishDelivered: number;
  spiceDelivered: number;
  chases: number;
  chaseWins: number;
  piratePlacements: number;
  tributes: number;
  boosts: number;
  goldSpent: number;
  goldBought: number;
  fastGold: number;
  bankTrades: number;
  playerTrades: number;
  fishRolls: number;
  // Most trades one player proposed in a single turn.
  maxProposalsPerTurn: number;
}

export interface EpSimResult {
  final: GameState;
  stats: EpSimStats;
  vp: Record<PlayerId, number>;
}

export function emptyStats(): EpSimStats {
  return {
    steps: 0,
    turns: 0,
    explored: 0,
    harbors: 0,
    founded: 0,
    roadSettlements: 0,
    settlers: 0,
    crews: 0,
    ships: 0,
    lairsCaptured: 0,
    crewsToFarms: 0,
    fishLoaded: 0,
    fishDelivered: 0,
    spiceDelivered: 0,
    chases: 0,
    chaseWins: 0,
    piratePlacements: 0,
    tributes: 0,
    boosts: 0,
    goldSpent: 0,
    goldBought: 0,
    fastGold: 0,
    bankTrades: 0,
    playerTrades: 0,
    fishRolls: 0,
    maxProposalsPerTurn: 0,
  };
}

// `onStep` sees every state before an action is applied (the action chosen
// for it included), for oracle / no-peeking checks.
export function simulateEp(
  seed: number,
  players: number,
  maxSteps = 12000,
  onStep?: (before: GameState, action: Action) => void,
): EpSimResult {
  let s: GameState = epGame(seed, players, { ai: true });
  let dice = (seed * 7919 + 13) >>> 0;
  const stats = emptyStats();
  let lastSeq = 0;
  const step = (action: Action) => {
    let a = action;
    if (a.type === 'rollDice') {
      const [d, next] = rollDice(dice);
      dice = next;
      a = { ...a, dice: d };
    }
    const before = s;
    onStep?.(before, a);
    s = applyAction(s, a);
    record(before, a, s);
  };
  const record = (before: GameState, a: Action, after: GameState) => {
    if (a.type === 'endTurn' && after.currentPlayerIndex !== before.currentPlayerIndex) stats.turns++;
    if (a.type === 'epBuildHarbor') stats.harbors++;
    if (a.type === 'buildSettlement') stats.roadSettlements++;
    if (a.type === 'epBuildSettler') stats.settlers++;
    if (a.type === 'epBuildCrew') stats.crews++;
    if (a.type === 'epBuildShip') stats.ships++;
    if (a.type === 'epBoostShip') stats.boosts++;
    if (a.type === 'spendGold') stats.goldSpent++;
    if (a.type === 'buyGold') stats.goldBought++;
    if (a.type === 'bankTrade') stats.bankTrades++;
    if (a.type === 'acceptTrade') stats.playerTrades++;
    if (a.type === 'proposeTrade') {
      stats.maxProposalsPerTurn = Math.max(stats.maxProposalsPerTurn, after.tradesProposedThisTurn);
    }
    const last = after.explorersPirates?.lastEvents;
    if (!last || last.seq === lastSeq) return;
    lastSeq = last.seq;
    for (const ev of last.events) {
      if (ev.kind === 'explore') stats.explored++;
      if (ev.kind === 'found') stats.founded++;
      if (ev.kind === 'lairCaptured') stats.lairsCaptured++;
      if (ev.kind === 'crewToFarm') stats.crewsToFarms++;
      if (ev.kind === 'loadFish') stats.fishLoaded++;
      if (ev.kind === 'deliver') {
        stats.fishDelivered += ev.fish;
        stats.spiceDelivered += ev.spice;
      }
      if (ev.kind === 'chase') {
        stats.chases++;
        if (ev.success) stats.chaseWins++;
      }
      if (ev.kind === 'pirate') stats.piratePlacements++;
      if (ev.kind === 'tribute') stats.tributes++;
      if (ev.kind === 'fastGold') stats.fastGold++;
      if (ev.kind === 'fishRoll') stats.fishRolls++;
    }
  };
  while (s.phase !== 'gameOver' && stats.steps < maxSteps) {
    stats.steps++;
    const pt = s.pendingTrade;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      step(
        acceptor
          ? { type: 'acceptTrade', playerId: acceptor.id }
          : { type: 'cancelTrade', playerId: pt.proposerId },
      );
      continue;
    }
    const acting = getActingPlayerId(s);
    step(chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting });
  }
  const vp: Record<PlayerId, number> = {};
  for (const p of s.players) vp[p.id] = calculateVictoryPoints(s, p.id, true);
  return { final: s, stats, vp };
}
