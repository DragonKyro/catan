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
import { calculateLongestRoad } from '@/game/scoring/longestRoad';

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
  | {
      id: number;
      kind: 'turnBegins';
      // Player whose main turn just started. SBP mini-turns (5-6p
      // expansion) are intentionally NOT logged here — only revolutions
      // of true turn-holders.
      player: PlayerId;
      // 1-based turn number across the whole game (every player change
      // increments). Useful for "Turn 4: Alice" framing.
      turnNumber: number;
    }
  | { id: number; kind: 'win'; player: PlayerId };

// Tracks per-player aggregates over time, snapshotted after each action.
export interface TimelineSnapshot {
  // Sequential index in the log (matches log entry that produced it).
  step: number;
  // Wall-clock since game start, ms.
  t: number;
  // Current revolution-based turn number at the time of this snapshot
  // (matches logStore.turnNumber). Used by the match graph to label
  // the x-axis in turn units rather than just step indices.
  turnNumber: number;
  perPlayer: Record<
    PlayerId,
    {
      vp: number;
      // Total resources currently in hand (count).
      handTotal: number;
      // Cumulative resources gained over the whole game (production-ish).
      gainedTotal: number;
      // Same as gainedTotal but broken down per resource.
      gainedByResource: Record<Resource, number>;
      // Cumulative knight cards played (drives Largest Army race chart).
      knightsPlayed: number;
      // Current longest contiguous road length (drives Longest Road race chart).
      longestRoadLength: number;
      // Cumulative count of trades the player participated in (bank
      // trades count for the actor; accepted player trades count for both
      // proposer and acceptor).
      tradesCount: number;
      // Cumulative resource cards given away / received via trades.
      // Efficiency = received / given (1.0 = breakeven, >1.0 = favorable;
      // bank trades always favor the bank so are always < 1.0).
      tradesGiven: number;
      tradesReceived: number;
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

// Subset of the logStore that gameStore captures for undo. Excludes
// startTime + initialState (both stable across an undo) and the methods.
export interface LogStoreSnapshot {
  entries: LogEntry[];
  timeline: TimelineSnapshot[];
  gainedTotals: Record<PlayerId, number>;
  gainedByResourceTotals: Record<PlayerId, Record<Resource, number>>;
  stats: MatchStats;
  nextId: number;
  actions: Action[];
  turnNumber: number;
  tradeStatsTotals: Record<
    PlayerId,
    { tradesCount: number; tradesGiven: number; tradesReceived: number }
  >;
}

interface LogStore {
  entries: LogEntry[];
  timeline: TimelineSnapshot[];
  // Cumulative resources gained per player (for production totals).
  gainedTotals: Record<PlayerId, number>;
  // Same as gainedTotals but per-resource. Parallel structure so the
  // existing total-only chart code keeps working unchanged.
  gainedByResourceTotals: Record<PlayerId, Record<Resource, number>>;
  stats: MatchStats;
  startTime: number;
  nextId: number;
  // Captured at reset() — the very first GameState. Combined with `actions`
  // this lets the end-game replay reconstruct any historical step by
  // re-applying actions[0..step] through the engine.
  initialState: GameState | null;
  // Every action successfully dispatched, in order. Append-only during a
  // game; cleared on reset.
  actions: Action[];
  // 1-based count of real turns logged. Incremented each time `record`
  // detects a transition into the rollOrPlayKnight phase. SBP mini-turns
  // don't enter rollOrPlayKnight, so they're correctly excluded.
  turnNumber: number;
  // Per-player cumulative trade stats — paired with timeline snapshots so
  // the end-game graph can show trade count and net resource flow over time.
  tradeStatsTotals: Record<
    PlayerId,
    { tradesCount: number; tradesGiven: number; tradesReceived: number }
  >;

  reset: (initial?: GameState) => void;
  record: (before: GameState, action: Action, after: GameState) => void;
  // Capture the current data fields (excluding methods + startTime) so the
  // gameStore can pair this with a GameState snapshot for undo.
  snapshot: () => LogStoreSnapshot;
  // Restore from a snapshot. Each field is overwritten by reference; safe
  // because record() always builds new arrays/objects via spread.
  restore: (snap: LogStoreSnapshot) => void;
}

function emptyResourceBank(): Record<Resource, number> {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
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
  gainedByResourceTotals: {},
  stats: emptyStats(),
  startTime: Date.now(),
  nextId: 1,
  initialState: null,
  actions: [],
  turnNumber: 0,
  tradeStatsTotals: {},

  reset: (initial) => {
    const gained: Record<PlayerId, number> = {};
    const gainedByResource: Record<PlayerId, Record<Resource, number>> = {};
    const tradeStats: LogStore['tradeStatsTotals'] = {};
    if (initial) {
      for (const p of initial.players) {
        gained[p.id] = 0;
        gainedByResource[p.id] = emptyResourceBank();
        tradeStats[p.id] = { tradesCount: 0, tradesGiven: 0, tradesReceived: 0 };
      }
    }
    set({
      entries: [],
      timeline: [],
      gainedTotals: gained,
      gainedByResourceTotals: gainedByResource,
      stats: emptyStats(),
      startTime: Date.now(),
      nextId: 1,
      initialState: initial ?? null,
      actions: [],
      turnNumber: 0,
      tradeStatsTotals: tradeStats,
    });
  },

  snapshot: () => {
    const s = get();
    return {
      entries: s.entries,
      timeline: s.timeline,
      gainedTotals: s.gainedTotals,
      gainedByResourceTotals: s.gainedByResourceTotals,
      stats: s.stats,
      nextId: s.nextId,
      actions: s.actions,
      turnNumber: s.turnNumber,
      tradeStatsTotals: s.tradeStatsTotals,
    };
  },

  restore: (snap) => {
    set({
      entries: snap.entries,
      timeline: snap.timeline,
      gainedTotals: snap.gainedTotals,
      gainedByResourceTotals: snap.gainedByResourceTotals,
      stats: snap.stats,
      nextId: snap.nextId,
      actions: snap.actions,
      turnNumber: snap.turnNumber,
      tradeStatsTotals: snap.tradeStatsTotals,
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

    // Turn detection: one "turn" = one full revolution of the table.
    // We bump the turn counter only when the active turn-holder wraps
    // back to playerOrder[0] (or on the very first rollOrPlayKnight,
    // which kicks off turn 1). SBP mini-turns never enter
    // rollOrPlayKnight, so they don't trigger this either way.
    let newTurnNumber: number | null = null;
    if (
      after.phase === 'rollOrPlayKnight' &&
      before.phase !== 'rollOrPlayKnight'
    ) {
      const turnHolderIdx = after.turnHolderIndex ?? after.currentPlayerIndex;
      const isRevolutionStart =
        turnHolderIdx === 0 && (get().turnNumber === 0 || before.phase === 'main' || before.phase === 'specialBuildPhase' || before.phase === 'setupRound2');
      if (isRevolutionStart) {
        newTurnNumber = get().turnNumber + 1;
        append.push({
          id: stamp(),
          kind: 'turnBegins',
          player: after.playerOrder[turnHolderIdx]!,
          turnNumber: newTurnNumber,
        });
      }
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

    // Trade-stats: track resources given/received per player when the
    // action is a trade. For bankTrade only the actor moves resources;
    // for acceptTrade both proposer and acceptor swap (their diffs cancel
    // out across the table but each individually has give/receive sides).
    const prevTradeStats = get().tradeStatsTotals;
    const newTradeStats: typeof prevTradeStats = {};
    for (const pid of Object.keys(prevTradeStats)) {
      newTradeStats[pid] = { ...prevTradeStats[pid]! };
    }
    // Make sure every current player has an entry (handles snapshot-rejoin).
    for (const p of after.players) {
      if (!newTradeStats[p.id]) {
        newTradeStats[p.id] = { tradesCount: 0, tradesGiven: 0, tradesReceived: 0 };
      }
    }
    if (action.type === 'bankTrade' || action.type === 'acceptTrade') {
      // Trades involve players whose resource counts changed. Identify
      // them via the diff (production-on-roll wouldn't be running on these
      // action types, so changes ARE the trade move).
      for (const p of after.players) {
        const diff = diffPlayerResources(before, after, p.id);
        let given = 0;
        let received = 0;
        for (const r of RESOURCES) {
          const d = diff[r] ?? 0;
          if (d > 0) received += d;
          else if (d < 0) given += -d;
        }
        if (given === 0 && received === 0) continue;
        const t = newTradeStats[p.id]!;
        t.tradesCount += 1;
        t.tradesGiven += given;
        t.tradesReceived += received;
      }
    }

    if (append.length === 0) {
      // Even when nothing was logged (proposeTrade etc.), capture the action
      // for replay — the engine still consumed it.
      set((s) => ({
        stats: newStats,
        actions: [...s.actions, action],
        turnNumber: newTurnNumber ?? s.turnNumber,
        tradeStatsTotals: newTradeStats,
      }));
      return;
    }

    // Update gain totals based on this transition (for the timeline).
    const newGained: Record<PlayerId, number> = { ...get().gainedTotals };
    const newGainedByResource: Record<PlayerId, Record<Resource, number>> = {};
    const prevGainedByResource = get().gainedByResourceTotals;
    for (const pid of Object.keys(prevGainedByResource)) {
      newGainedByResource[pid] = { ...prevGainedByResource[pid]! };
    }
    for (const p of after.players) {
      if (newGained[p.id] === undefined) newGained[p.id] = 0;
      if (!newGainedByResource[p.id]) newGainedByResource[p.id] = emptyResourceBank();
      const diff = diffPlayerResources(before, after, p.id);
      const positive = totalGainAmount(diff);
      newGained[p.id] = (newGained[p.id] ?? 0) + positive;
      for (const r of RESOURCES) {
        const d = diff[r] ?? 0;
        if (d > 0) newGainedByResource[p.id]![r] += d;
      }
    }

    // Build a fresh timeline snapshot.
    const perPlayer: TimelineSnapshot['perPlayer'] = {};
    for (const p of after.players) {
      const ts = newTradeStats[p.id] ?? { tradesCount: 0, tradesGiven: 0, tradesReceived: 0 };
      perPlayer[p.id] = {
        vp: calculateVictoryPoints(after, p.id, false),
        handTotal: handTotal(after, p.id),
        gainedTotal: newGained[p.id] ?? 0,
        gainedByResource: { ...(newGainedByResource[p.id] ?? emptyResourceBank()) },
        knightsPlayed: p.devCards.playedKnights,
        longestRoadLength: calculateLongestRoad(after, p.id),
        tradesCount: ts.tradesCount,
        tradesGiven: ts.tradesGiven,
        tradesReceived: ts.tradesReceived,
      };
    }
    const newStep = get().entries.length + append.length;
    const snapshot: TimelineSnapshot = {
      step: newStep,
      t: Date.now() - get().startTime,
      turnNumber: newTurnNumber ?? get().turnNumber,
      perPlayer,
    };

    set((s) => ({
      entries: [...s.entries, ...append],
      timeline: [...s.timeline, snapshot],
      gainedTotals: newGained,
      gainedByResourceTotals: newGainedByResource,
      stats: newStats,
      nextId: s.nextId + append.length,
      actions: [...s.actions, action],
      turnNumber: newTurnNumber ?? s.turnNumber,
      tradeStatsTotals: newTradeStats,
    }));
  },
}));
