import { useEffect, useState } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { chooseAction } from '@/ai';
import { chooseRobberMove } from '@/ai/robber';
import { reportNeeds, RESOURCE_WEIGHT } from '@/ai/value';
import { RESOURCES, type Action, type GameState, type HexId, type Resource } from '@/game/types';
import { isSetupPhase } from '@/game/actions/setup';
import { pirateStealCandidates } from '@/game/modules/seafarers/actions/movePirate';
import './TurnTimer.css';

// Optional per-turn time limit. When set in GameSettings, runs only for
// the LOCAL human player. On expiry: auto-finish any committed sub-phase
// using AI heuristics, then end the turn. Keeps games moving when someone
// walks away; AI seats already pace themselves via AIDriver.
export function TurnTimer() {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const handoffPending = useGameStore((s) => s.handoffPending);
  const handoffAck = useGameStore((s) => s.handoffAcknowledgedForPlayer);
  const dialog = useGameStore((s) => s.dialog);
  const closeDialog = useGameStore((s) => s.closeDialog);
  const setPendingRobberHex = useGameStore((s) => s.setPendingRobberHex);
  const setPendingPirateHex = useGameStore((s) => s.setPendingPirateHex);
  const pendingRobberHex = useGameStore((s) => s.pendingRobberHex);
  const role = useNetworkStore((s) => s.role);
  const limitSec = game?.settings.turnTimerSec ?? 0;

  if (!game || limitSec <= 0) return null;
  if (game.winner) return null;

  const acting = getActingPlayerId(game);
  const actingPlayer = game.players.find((p) => p.id === acting);
  if (!actingPlayer) return null;

  // Skip AI seats — they drive themselves; the timer only polices humans.
  const isLocalPlayer =
    role === 'solo' ? acting === handoffAck : acting === getMyPlayerId(game);
  if (!isLocalPlayer) return null;
  if (actingPlayer.isAI) return null;
  if (handoffPending) return null;

  // The TimerInner remounts (and resets its countdown) whenever this key
  // changes, so the timer only restarts on a meaningful transition.
  const key = `${acting}|${game.phase}|${dialog ?? ''}|${pendingRobberHex ?? ''}`;

  return (
    <TurnTimerInner
      key={key}
      limitSec={limitSec}
      onExpire={() =>
        autoFinish(useGameStore.getState(), {
          dispatch,
          closeDialog,
          setPendingRobberHex,
          setPendingPirateHex,
        })
      }
    />
  );
}

function TurnTimerInner({
  limitSec,
  onExpire,
}: {
  limitSec: number;
  onExpire: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(limitSec);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft, onExpire]);

  const pct = Math.max(0, Math.min(1, secondsLeft / limitSec));
  const warn = secondsLeft <= 10;
  return (
    <div
      className={`turn-timer${warn ? ' is-warn' : ''}`}
      role="timer"
      aria-label={`Turn time remaining: ${secondsLeft}s`}
    >
      <div className="turn-timer-bar" style={{ width: `${pct * 100}%` }} />
      <span className="turn-timer-label">{formatSeconds(secondsLeft)}</span>
    </div>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Run the AI's choice for whatever sub-phase the player got stuck in.
// Multiple dispatches may chain through useEffect resets — we only fire
// ONE here and rely on the timer remounting on the new state to handle
// any next phase (e.g., discard → next discarder, or roll → robber).
function autoFinish(
  store: ReturnType<typeof useGameStore.getState>,
  ctx: {
    dispatch: (a: Action) => void;
    closeDialog: () => void;
    setPendingRobberHex: (h: HexId | null) => void;
    setPendingPirateHex: (h: HexId | null) => void;
  },
): void {
  const initial = store.game;
  if (!initial) return;
  const playerId = getActingPlayerId(initial);

  // Dev-card dialog (yearOfPlenty / monopoly): pick AI defaults, dispatch.
  if (store.dialog === 'yearOfPlenty') {
    const needs = reportNeeds(initial, playerId);
    const picks = pickTwoByNeed(initial, needs.byResource);
    ctx.dispatch({ type: 'playYearOfPlenty', playerId, resources: picks });
    ctx.closeDialog();
    return;
  }
  if (store.dialog === 'monopoly') {
    // Pick the resource opponents collectively hold most of.
    let bestRes: Resource = 'wood';
    let bestTotal = -1;
    for (const r of RESOURCES) {
      let total = 0;
      for (const p of initial.players) {
        if (p.id === playerId) continue;
        total += p.resources[r];
      }
      if (total > bestTotal) {
        bestTotal = total;
        bestRes = r;
      }
    }
    ctx.dispatch({ type: 'playMonopoly', playerId, resource: bestRes });
    ctx.closeDialog();
    return;
  }
  if (store.dialog === 'bankTrade' || store.dialog === 'playerTrade') {
    ctx.closeDialog();
    // Fall through to end-turn handling below.
  }

  // Mid-steal selection: pendingRobberHex set, awaiting a target.
  if (store.pendingRobberHex) {
    const choice = chooseRobberMove(initial, playerId);
    ctx.setPendingRobberHex(null);
    ctx.dispatch({
      type: 'moveRobber',
      playerId,
      hex: store.pendingRobberHex,
      stealFrom: choice.stealFrom,
    });
    return;
  }

  // Same for the pirate: let the AI heuristic pick the victim.
  if (store.pendingPirateHex) {
    const hex = store.pendingPirateHex;
    const victim = pirateStealCandidates(initial, playerId, hex)[0] ?? null;
    ctx.setPendingPirateHex(null);
    ctx.dispatch({ type: 'movePirate', playerId, hex, stealFrom: victim });
    return;
  }

  // Pending trade where we're the proposer: walk away.
  if (initial.pendingTrade && initial.pendingTrade.proposerId === playerId) {
    ctx.dispatch({ type: 'cancelTrade', playerId });
    return;
  }

  // Sub-phases: delegate to AI's chooseAction.
  if (
    initial.phase === 'discard' ||
    initial.phase === 'moveRobber' ||
    initial.phase === 'movePirate' ||
    initial.phase === 'chooseGoldResource' ||
    initial.phase === 'chooseRobberOrPirate' ||
    initial.phase === 'placeTribePort' ||
    initial.phase === 'stealResource' ||
    // T&B Barbarian Attack: a card's choice, then the knight moves (the AI
    // moves any knight that must leave the castle, then ends the turn).
    initial.phase === 'barbarianCard' ||
    initial.phase === 'barbarianKnightMoves' ||
    // T&B: Merchant Trains voting round / wagon placement, Event Card answers.
    initial.phase === 'wagonVoting' ||
    initial.phase === 'placeWagon' ||
    initial.phase === 'eventResolution' ||
    isSetupPhase(initial.phase) ||
    initial.phase === 'rollOrPlayKnight'
  ) {
    const action = chooseAction(initial, playerId);
    if (action) ctx.dispatch(action);
    else if (initial.phase === 'barbarianKnightMoves') ctx.dispatch({ type: 'endTurn', playerId });
    return;
  }

  // Main: just end the turn — the player had their chance.
  if (initial.phase === 'main') {
    ctx.dispatch({ type: 'endTurn', playerId });
  }
}

// Pick up to 2 resources weighted by current shortfall vs player needs,
// falling back to general resource weights. Respects bank stock.
function pickTwoByNeed(
  state: GameState,
  byResource: Partial<Record<Resource, number>>,
): [Resource, Resource] {
  const ranked = [...RESOURCES].sort((a, b) => {
    const aNeed = byResource[a] ?? 0;
    const bNeed = byResource[b] ?? 0;
    if (aNeed !== bNeed) return bNeed - aNeed;
    return RESOURCE_WEIGHT[b] - RESOURCE_WEIGHT[a];
  });
  const available = ranked.filter((r) => state.bank[r] > 0);
  return [
    available[0] ?? ranked[0]!,
    available[1] ?? available[0] ?? ranked[1]!,
  ];
}
