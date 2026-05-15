import { create } from 'zustand';
import type {
  Action,
  GameState,
  PlayerId,
  Resource,
  ResourceBank,
} from '@/game/types';
import { RESOURCES } from '@/game/types';
import { calculateVictoryPoints } from '@/game/scoring/points';

// =======================================================================
// Log entries — derived from action dispatches by comparing before/after.
// The log is NOT part of GameState. It lives in a separate store so the
// pure engine stays unaffected; each peer derives its own log from the
// actions it sees, so multiplayer needs no extra wire traffic.
// =======================================================================

export type LogEntry =
  | { id: number; kind: 'roll'; player: PlayerId; dice: [number, number] }
  | {
      id: number;
      kind: 'gain';
      player: PlayerId;
      gained: Partial<ResourceBank>;
      // Whether this gain came from a dice production roll (true) or another
      // source (e.g., year-of-plenty, monopoly). Mostly cosmetic.
      fromRoll: boolean;
    }
  | { id: number; kind: 'build'; player: PlayerId; what: 'settlement' | 'city' | 'road' }
  | { id: number; kind: 'buyDevCard'; player: PlayerId }
  | { id: number; kind: 'playKnight'; player: PlayerId }
  | { id: number; kind: 'playRoadBuilding'; player: PlayerId }
  | {
      id: number;
      kind: 'playYearOfPlenty';
      player: PlayerId;
      resources: [Resource, Resource];
    }
  | {
      id: number;
      kind: 'playMonopoly';
      player: PlayerId;
      resource: Resource;
      // How many cards the monopolist took total.
      taken: number;
    }
  | {
      id: number;
      kind: 'discard';
      player: PlayerId;
      resources: Partial<ResourceBank>;
    }
  | {
      id: number;
      kind: 'moveRobber';
      player: PlayerId;
      stoleFrom: PlayerId | null;
    }
  | {
      id: number;
      kind: 'bankTrade';
      player: PlayerId;
      give: Resource;
      giveAmount: number;
      receive: Resource;
    }
  | {
      id: number;
      kind: 'tradeProposed';
      proposer: PlayerId;
      give: Partial<ResourceBank>;
      receive: Partial<ResourceBank>;
    }
  | {
      id: number;
      kind: 'tradeAccepted';
      proposer: PlayerId;
      acceptor: PlayerId;
      give: Partial<ResourceBank>;
      receive: Partial<ResourceBank>;
    }
  | { id: number; kind: 'tradeCancelled'; proposer: PlayerId }
  | { id: number; kind: 'tradeRejected'; proposer: PlayerId; rejector: PlayerId }
  | {
      id: number;
      kind: 'tradeCountered';
      // The player making the counter (was responding to original).
      counterer: PlayerId;
      // The player who proposed the original trade (now receiving the counter).
      originalProposer: PlayerId;
      give: Partial<ResourceBank>;
      receive: Partial<ResourceBank>;
    }
  | { id: number; kind: 'endTurn'; player: PlayerId }
  | { id: number; kind: 'win'; player: PlayerId };

// Tracks per-player aggregates over time, snapshotted after each action.
export interface TimelineSnapshot {
  // Sequential index in the log (matches log entry that produced it).
  step: number;
  // Wall-clock since game start, ms.
  t: number;
  perPlayer: Record<
    PlayerId,
    {
      vp: number;
      // Total resources currently in hand (count).
      handTotal: number;
      // Cumulative resources gained over the whole game (production-ish).
      gainedTotal: number;
    }
  >;
}

// Cumulative game-wide stats useful for the end-of-game charts.
export interface MatchStats {
  // Count of dice rolls per total (2..12).
  rollCounts: Record<number, number>;
  // Cumulative resources put into circulation (gained by any player) over
  // the whole game, broken down by resource type. Includes production rolls,
  // year-of-plenty grants, robber steals (net 0 across players, so this
  // counts production only when paired with a corresponding bank decrease).
  resourcesInCirculation: Record<Resource, number>;
}

interface LogStore {
  entries: LogEntry[];
  timeline: TimelineSnapshot[];
  // Cumulative resources gained per player (for production totals).
  gainedTotals: Record<PlayerId, number>;
  stats: MatchStats;
  startTime: number;
  nextId: number;

  reset: (initial?: GameState) => void;
  record: (before: GameState, action: Action, after: GameState) => void;
}

function diffPlayerResources(
  before: GameState,
  after: GameState,
  playerId: PlayerId,
): Partial<ResourceBank> {
  const b = before.players.find((p) => p.id === playerId)?.resources;
  const a = after.players.find((p) => p.id === playerId)?.resources;
  if (!a || !b) return {};
  const out: Partial<ResourceBank> = {};
  for (const r of RESOURCES) {
    const d = a[r] - b[r];
    if (d !== 0) out[r] = d;
  }
  return out;
}

function totalGainAmount(diff: Partial<ResourceBank>): number {
  let t = 0;
  for (const r of RESOURCES) t += Math.max(0, diff[r] ?? 0);
  return t;
}

function handTotal(state: GameState, playerId: PlayerId): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return 0;
  let n = 0;
  for (const r of RESOURCES) n += p.resources[r];
  return n;
}

function emptyStats(): MatchStats {
  const rollCounts: Record<number, number> = {};
  for (let i = 2; i <= 12; i++) rollCounts[i] = 0;
  const resourcesInCirculation: Record<Resource, number> = {
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0,
  };
  return { rollCounts, resourcesInCirculation };
}

export const useLogStore = create<LogStore>((set, get) => ({
  entries: [],
  timeline: [],
  gainedTotals: {},
  stats: emptyStats(),
  startTime: Date.now(),
  nextId: 1,

  reset: (initial) => {
    const gained: Record<PlayerId, number> = {};
    if (initial) for (const p of initial.players) gained[p.id] = 0;
    set({
      entries: [],
      timeline: [],
      gainedTotals: gained,
      stats: emptyStats(),
      startTime: Date.now(),
      nextId: 1,
    });
  },

  record: (before, action, after) => {
    const append: LogEntry[] = [];
    const stamp = (): number => {
      const id = get().nextId + append.length;
      return id;
    };

    switch (action.type) {
      case 'rollDice': {
        // Log the roll itself only — per-player resource gains are derivable
        // from the board, so the log stays uncluttered.
        append.push({
          id: stamp(),
          kind: 'roll',
          player: action.playerId,
          dice: action.dice,
        });
        break;
      }
      case 'buildSettlement':
      case 'buildCity':
      case 'buildRoad': {
        const what =
          action.type === 'buildSettlement'
            ? 'settlement'
            : action.type === 'buildCity'
              ? 'city'
              : 'road';
        append.push({
          id: stamp(),
          kind: 'build',
          player: action.playerId,
          what,
        });
        break;
      }
      case 'buyDevCard':
        append.push({ id: stamp(), kind: 'buyDevCard', player: action.playerId });
        break;
      case 'playKnight':
        append.push({ id: stamp(), kind: 'playKnight', player: action.playerId });
        break;
      case 'playRoadBuilding':
        append.push({
          id: stamp(),
          kind: 'playRoadBuilding',
          player: action.playerId,
        });
        break;
      case 'playYearOfPlenty':
        append.push({
          id: stamp(),
          kind: 'playYearOfPlenty',
          player: action.playerId,
          resources: action.resources,
        });
        // The gain isn't logged as a separate event because the action itself
        // names the resources publicly.
        break;
      case 'playMonopoly': {
        const diff = diffPlayerResources(before, after, action.playerId);
        const taken = diff[action.resource] ?? 0;
        append.push({
          id: stamp(),
          kind: 'playMonopoly',
          player: action.playerId,
          resource: action.resource,
          taken: Math.max(0, taken),
        });
        break;
      }
      case 'discard':
        append.push({
          id: stamp(),
          kind: 'discard',
          player: action.playerId,
          resources: action.resources,
        });
        break;
      case 'moveRobber':
        append.push({
          id: stamp(),
          kind: 'moveRobber',
          player: action.playerId,
          stoleFrom: action.stealFrom,
        });
        break;
      case 'bankTrade': {
        // Determine how many were given by looking at the before/after.
        const diff = diffPlayerResources(before, after, action.playerId);
        const giveAmount = Math.max(0, -(diff[action.give] ?? 0));
        append.push({
          id: stamp(),
          kind: 'bankTrade',
          player: action.playerId,
          give: action.give,
          giveAmount: giveAmount || 1,
          receive: action.receive,
        });
        break;
      }
      case 'proposeTrade':
        // Offers themselves aren't logged — only trades that actually go
        // through. The pending-trade UI carries the live offer.
        break;
      case 'acceptTrade': {
        const trade = before.pendingTrade;
        if (trade) {
          append.push({
            id: stamp(),
            kind: 'tradeAccepted',
            proposer: trade.proposerId,
            acceptor: action.playerId,
            give: trade.give,
            receive: trade.receive,
          });
        }
        break;
      }
      case 'cancelTrade':
        // Cancellations aren't logged — only completed trades.
        break;
      case 'endTurn':
        // Turn boundaries aren't logged — too noisy.
        break;
      case 'rejectTrade':
        // Rejections aren't logged.
        break;
      case 'counterTrade':
        // The counter is an offer in flight, not a completed trade — skip.
        break;
      default:
        // Setup placements etc. — no log entry.
        break;
    }

    // Win check: detect transition into gameOver.
    if (after.phase === 'gameOver' && before.phase !== 'gameOver' && after.winner) {
      append.push({ id: stamp(), kind: 'win', player: after.winner });
    }

    // Update cumulative stats. Always recompute, even when nothing was
    // appended to the log (e.g., a proposeTrade), because dice rolls and
    // bank diffs are part of the long-running match stats independent of
    // log entries. We DO want this to fire for every action.
    const newStats: MatchStats = {
      rollCounts: { ...get().stats.rollCounts },
      resourcesInCirculation: { ...get().stats.resourcesInCirculation },
    };
    if (action.type === 'rollDice') {
      const total = action.dice[0] + action.dice[1];
      newStats.rollCounts[total] = (newStats.rollCounts[total] ?? 0) + 1;
    }
    for (const r of RESOURCES) {
      const bankDelta = before.bank[r] - after.bank[r];
      if (bankDelta > 0) {
        // Bank gave out `bankDelta` of `r` — that many entered circulation.
        newStats.resourcesInCirculation[r] += bankDelta;
      }
    }

    if (append.length === 0) {
      set({ stats: newStats });
      return;
    }

    // Update gain totals based on this transition (for the timeline).
    const newGained: Record<PlayerId, number> = { ...get().gainedTotals };
    for (const p of after.players) {
      if (newGained[p.id] === undefined) newGained[p.id] = 0;
      const diff = diffPlayerResources(before, after, p.id);
      const positive = totalGainAmount(diff);
      newGained[p.id] = (newGained[p.id] ?? 0) + positive;
    }

    // Build a fresh timeline snapshot.
    const perPlayer: TimelineSnapshot['perPlayer'] = {};
    for (const p of after.players) {
      perPlayer[p.id] = {
        vp: calculateVictoryPoints(after, p.id, false),
        handTotal: handTotal(after, p.id),
        gainedTotal: newGained[p.id] ?? 0,
      };
    }
    const newStep = get().entries.length + append.length;
    const snapshot: TimelineSnapshot = {
      step: newStep,
      t: Date.now() - get().startTime,
      perPlayer,
    };

    set((s) => ({
      entries: [...s.entries, ...append],
      timeline: [...s.timeline, snapshot],
      gainedTotals: newGained,
      stats: newStats,
      nextId: s.nextId + append.length,
    }));
  },
}));
