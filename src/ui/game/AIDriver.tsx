import { useEffect, useRef, useState } from 'react';
import { tradeOfferKey, useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { useLogStore } from '@/store/logStore';
import { getActingPlayerId } from '@/game/helpers';
import type { Action, GameState, PlayerId } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { tryCounterTrade, tryExtractCounter } from '@/ai/trade';
import { hasAnsweredTrade } from '@/game/actions/trade';
import { KnowledgeSession, chooseNeuralAction, loadAiPolicy, loadedAiPolicy, neuralPolicy } from '@/ai/nn';

// Each AI seat's knowledge (card counting etc.) for the trained-network AI,
// replayed from the game log. One game is driven at a time.
const knowledge = new KnowledgeSession();
let warned: string | null = null;

/** The trained network's move for `playerId` in a base game with an AI level
 *  set, or undefined when the heuristic AI should decide (other rule sets, the
 *  network still loading, a log that can't be replayed, or nothing to decide). */
function neuralAction(game: GameState, playerId: PlayerId): Action | undefined {
  const policy = neuralPolicy(game);
  const net = policy ? loadedAiPolicy(policy) : null;
  if (!net) return undefined;
  const log = useLogStore.getState();
  const seats = game.players.filter((p) => p.isAI).map((p) => p.id);
  const known = knowledge.sync(log.initialState, log.actions, game, seats);
  if (!known) {
    if (knowledge.problem && knowledge.problem !== warned) {
      warned = knowledge.problem;
      console.warn(`[AIDriver] trained AI unavailable, using the classic AI: ${warned}`);
    }
    return undefined;
  }
  try {
    return chooseNeuralAction(game, playerId, known[playerId]!, net) ?? undefined;
  } catch (e) {
    console.warn('[AIDriver] trained AI failed, using the classic AI for this move:', (e as Error).message);
    return undefined;
  }
}

/**
 * Dispatch the first of `moves` the engine takes (a refused move leaves the
 * game as it was: the driver only acts again when the game changes, so a
 * refusal would freeze the AI). Logs each refusal with the engine's reason.
 * True when one was taken.
 */
function dispatchFirst(
  dispatch: (a: Action) => void,
  who: PlayerId,
  where: string,
  moves: Array<() => Action | null | undefined>,
): boolean {
  for (const next of moves) {
    let action: Action | null | undefined;
    try {
      action = next();
    } catch (e) {
      console.warn(`[AIDriver] ${who} (${where}): choosing a move failed:`, (e as Error).message);
      continue;
    }
    if (!action) continue;
    const before = useGameStore.getState().game;
    dispatch(action);
    if (useGameStore.getState().game !== before) return true;
    console.warn(`[AIDriver] ${who} (${where}): the game refused ${action.type}:`, useGameStore.getState().error, action);
  }
  return false;
}

/** A move that always ends `who`'s part in a pending trade (or its turn). */
function walkAway(game: GameState, who: PlayerId): Action {
  const pt = game.pendingTrade;
  if (!pt) return { type: 'endTurn', playerId: who };
  return pt.proposerId === who ? { type: 'cancelTrade', playerId: who } : { type: 'rejectTrade', playerId: who };
}

/** The move that's always open in a plain turn: roll first, then end the turn. */
function safeDefault(game: GameState, who: PlayerId): Action {
  if (game.phase === 'rollOrPlayKnight' && !game.hasRolledThisTurn) {
    const die = () => 1 + Math.floor(Math.random() * 6);
    return { type: 'rollDice', playerId: who, dice: [die(), die()] };
  }
  return { type: 'endTurn', playerId: who };
}

/** How long an AI may go without the game moving before the watchdog steps in. */
const AI_STALL_MS = 25000;

const AI_ACTION_DELAY_MS = 450;
// Initial pause before any AI evaluates a pending trade — gives the human
// time to see the offer.
const AI_TRADE_INITIAL_WAIT_MS = 1800;
// After the initial wait, each AI evaluator fires within this jitter window
// so they decide roughly in parallel (not sequentially). Randomizing the
// individual offsets prevents the same AI always winning a race for the
// same trade.
const AI_TRADE_JITTER_MS = 700;
// When the AI is the proposer (or current player on a counter), wait this
// long before auto-cancelling so the human has time to accept/counter.
const AI_PROPOSER_WAIT_MS = 10000;
// An AI's offer stays up at least this long before it settles, even when only
// AIs can answer, so a person can see who traded what with whom.
const AI_MIN_OFFER_MS = 3000;

// Drives any AI-controlled acting player by computing their next action
// and dispatching it. Mounts inside GameView and renders nothing.
//
// Only runs when we're solo or the host of the online room — otherwise
// every peer would race to dispatch AI moves.
export function AIDriver() {
  const { game, handoffPending, dialog, pendingRobberHex, dispatch } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  const canDriveAI = role === 'solo' || role === 'host';
  // When the AI's current offer first showed (AI_MIN_OFFER_MS).
  const offerShown = useRef<{ key: string; at: number } | null>(null);

  // Trained-network AI: fetch the table size's policy file once, and hold the
  // AI seats until it's in (a failed fetch falls back to the classic AI).
  const policy = game ? neuralPolicy(game) : null;
  const [loadTick, setLoadTick] = useState(0);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!canDriveAI || !policy || loadedAiPolicy(policy)) return;
    let live = true;
    loadAiPolicy(policy)
      .then(() => live && setLoadTick((t) => t + 1))
      .catch((e) => {
        console.warn(`[AIDriver] could not load the ${policy} AI, using the classic AI:`, (e as Error).message);
        if (live) setLoadFailed(policy);
      });
    return () => {
      live = false;
    };
  }, [policy, canDriveAI]);
  const waitingForNet = policy !== null && loadFailed !== policy && !loadedAiPolicy(policy);

  // Main turn-loop driver
  useEffect(() => {
    if (!canDriveAI) return;
    if (!game) return;
    if (game.winner) return;
    if (waitingForNet) return;
    if (handoffPending) return;
    if (pendingRobberHex) return;
    // Dialog open by a human — don't step the AI; but if the only "dialog"
    // would be us proposing/handling trades, AI handles those without UI dialog.
    if (dialog) return;
    const acting = getActingPlayerId(game);
    const player = game.players.find((p) => p.id === acting);
    if (!player?.isAI) return;

    // If there's a pending trade, defer with a longer pause so the
    // player has time to see the offer / counter:
    // - AI is the proposer: wait for the answers, then trade with its pick
    //   of whoever accepted (or walk away).
    // - AI is the current player but a counter exists: wait, then evaluate.
    // - Otherwise the trade-evaluator effect below handles it.
    // This effect re-runs on every answer, so the proposer resolves shortly
    // after the last one comes in.
    let delay = AI_ACTION_DELAY_MS;
    if (game.pendingTrade) {
      const trade = game.pendingTrade;
      // Only the proposer (the active player) settles an offer; everyone
      // else's answers come from the trade evaluator below.
      if (acting !== trade.proposerId) return;
      // Who still hasn't answered (a yes, a no or a counter-offer). A human:
      // wait the full 10 s. Only AIs: just past their answer jitter. Nobody:
      // settle now — but never before the offer has been up AI_MIN_OFFER_MS.
      const unanswered = game.players.filter((p) => p.id !== trade.proposerId && !hasAnsweredTrade(trade, p.id));
      delay = unanswered.some((p) => !p.isAI)
        ? AI_PROPOSER_WAIT_MS
        : unanswered.length > 0
          ? AI_TRADE_JITTER_MS + AI_ACTION_DELAY_MS
          : AI_ACTION_DELAY_MS;
      const key = tradeOfferKey(trade);
      if (offerShown.current?.key !== key) offerShown.current = { key, at: Date.now() };
      delay = Math.max(delay, AI_MIN_OFFER_MS - (Date.now() - offerShown.current.at));
    }

    const t = setTimeout(() => {
      // The trained network where it applies; the classic AI otherwise (and
      // for the proposer's own offer when the network's rules lack
      // `tradePick`: the classic AI picks the partner). A move the game
      // refuses falls through to the next, so the AI never freezes.
      dispatchFirst(dispatch, acting, game.pendingTrade ? 'trade' : game.phase, [
        () => neuralAction(game, acting),
        () => chooseAction(game, acting),
        () => (game.pendingTrade ? walkAway(game, acting) : null),
        () => safeDefault(game, acting),
      ]);
    }, delay);
    return () => clearTimeout(t);
  }, [game, handoffPending, dialog, pendingRobberHex, dispatch, canDriveAI, waitingForNet, loadTick]);

  // Trade-evaluator driver: when a NEW offer appears, schedule every eligible
  // AI responder ONCE — all firing roughly in parallel after a fairness wait
  // so the human can react. Each answers accept (a yes: the proposer then
  // picks a partner), reject or counter (a counter-offer sits beside the
  // offer, which stays open to everyone else).
  //
  // The effect is keyed on a stable trade identity (proposer + give +
  // receive) so a rejection mutating `rejectedBy` doesn't tear down and
  // recreate the timers — that was making rejections look sequential, each
  // paying the initial-wait again.
  // (Cities & Knights offers can differ only in their commodity columns.)
  const tradeKey = game?.pendingTrade ? tradeOfferKey(game.pendingTrade) : null;
  // An undo / rollback can bring back an offer the AIs already answered in
  // the timeline it replaced: ask them again.
  const rewinds = useGameStore((s) => s.rewinds);
  useEffect(() => {
    if (!canDriveAI) return;
    if (!tradeKey) return;
    const initial = useGameStore.getState().game;
    if (!initial?.pendingTrade) return;
    const trade = initial.pendingTrade;
    const eligibleAIs = initial.players.filter(
      (p) => p.isAI && p.id !== trade.proposerId && !hasAnsweredTrade(trade, p.id),
    );
    if (eligibleAIs.length === 0) return;
    // Is any human still a possible responder? If so we wait the full
    // fairness pause so they can see the offer. Otherwise (e.g., the only
    // human already auto-rejected for lack of resources) the AIs can fire
    // immediately — no one's waiting on them.
    const humanCanRespond = initial.players.some(
      (p) => !p.isAI && p.id !== trade.proposerId && !hasAnsweredTrade(trade, p.id),
    );
    const baseWait = humanCanRespond ? AI_TRADE_INITIAL_WAIT_MS : 0;
    // Shuffle so contested trades aren't always won by the lowest-seat AI.
    const shuffled = [...eligibleAIs].sort(() => Math.random() - 0.5);
    const timeouts: number[] = [];
    for (const p of shuffled) {
      const delay = baseWait + Math.random() * AI_TRADE_JITTER_MS;
      const id = window.setTimeout(() => {
        const latest = useGameStore.getState().game;
        if (!latest?.pendingTrade) return;
        if (latest.pendingTrade.proposerId === p.id) return;
        if (hasAnsweredTrade(latest.pendingTrade, p.id)) return;
        // A trained network answers accept / reject, or counter-offers when
        // its rules allow it (`counter`, at most once a turn). Otherwise the
        // classic AI: before plain-accepting, see if it can squeeze one more
        // card out of a desperate proposer. Each answer the game refuses
        // falls through to the next, ending with a plain no.
        dispatchFirst(dispatch, p.id, 'trade answer', [
          () => neuralAction(latest, p.id),
          () => tryExtractCounter(latest, p.id),
          () => (shouldAcceptTrade(latest, p.id) ? { type: 'acceptTrade', playerId: p.id } : null),
          () => tryCounterTrade(latest, p.id),
          () => walkAway(latest, p.id),
        ]);
      }, delay);
      timeouts.push(id);
    }
    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [tradeKey, rewinds, dispatch, canDriveAI]);

  // Watchdog: when an AI seat owes a move (its turn, its own offer to settle,
  // a counter to answer, or an answer to someone's offer) and the game hasn't
  // moved for AI_STALL_MS, log what it was waiting on and walk that seat out
  // of the trade (or let it play on). A human's open dialog or the hot-seat
  // handoff is a deliberate pause, not a stall.
  useEffect(() => {
    if (!canDriveAI || !game || game.winner || waitingForNet || handoffPending || dialog || pendingRobberHex) return;
    const owed = aiSeatsOwingAMove(game);
    if (owed.length === 0) return;
    const t = window.setTimeout(() => {
      const now = useGameStore.getState().game;
      if (now !== game) return;
      const pt = game.pendingTrade;
      console.warn(
        `[AIDriver] no move for ${AI_STALL_MS / 1000}s from ${owed.join(', ')} in ${game.phase}`
          + (pt ? ` (trade by ${pt.proposerId}: yes ${(pt.acceptedBy ?? []).join(',') || '-'}, no ${pt.rejectedBy.join(',') || '-'})` : ''),
      );
      const who = owed[0]!;
      dispatchFirst(dispatch, who, 'watchdog', [
        () => (pt ? walkAway(game, who) : null),
        () => chooseAction(game, who),
        () => safeDefault(game, who),
      ]);
    }, AI_STALL_MS);
    return () => window.clearTimeout(t);
  }, [game, canDriveAI, waitingForNet, handoffPending, dialog, pendingRobberHex, dispatch]);

  return null;
}

/** The AI seats the game is waiting on (see the watchdog above). */
function aiSeatsOwingAMove(game: GameState): PlayerId[] {
  const isAi = (id: PlayerId | undefined) => !!id && !!game.players.find((p) => p.id === id)?.isAI;
  const pt = game.pendingTrade;
  if (!pt) {
    const acting = getActingPlayerId(game);
    return isAi(acting) ? [acting] : [];
  }
  // An offer: everyone yet to answer; then the proposer settles it.
  const unanswered = game.players
    .filter((p) => p.id !== pt.proposerId && !hasAnsweredTrade(pt, p.id))
    .map((p) => p.id);
  const ai = unanswered.filter(isAi);
  if (ai.length > 0) return ai;
  return unanswered.length === 0 && isAi(pt.proposerId) ? [pt.proposerId] : [];
}
