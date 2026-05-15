import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { getActingPlayerId } from '@/game/helpers';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { tryCounterTrade } from '@/ai/trade';

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

// Drives any AI-controlled acting player by computing their next action
// and dispatching it. Mounts inside GameView and renders nothing.
//
// Only runs when we're solo or the host of the online room — otherwise
// every peer would race to dispatch AI moves.
export function AIDriver() {
  const { game, handoffPending, dialog, pendingRobberHex, dispatch } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  const canDriveAI = role === 'solo' || role === 'host';

  // Main turn-loop driver
  useEffect(() => {
    if (!canDriveAI) return;
    if (!game) return;
    if (game.winner) return;
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
    // - AI is the proposer: wait, then will cancel.
    // - AI is the current player but a counter exists: wait, then evaluate.
    // - Otherwise the trade-evaluator effect below handles it.
    let delay = AI_ACTION_DELAY_MS;
    if (game.pendingTrade) {
      const currentTurnId = game.playerOrder[game.currentPlayerIndex];
      const isProposer = acting === game.pendingTrade.proposerId;
      const isCurrentNonProposer = acting === currentTurnId && !isProposer;
      if (!isProposer && !isCurrentNonProposer) return;
      // Only wait the full 10s if a human could still respond. In an
      // all-AI game there's no one to wait for — let the proposer
      // resolve immediately. Same for situations where every human
      // already auto-rejected for lack of resources.
      const humanCanRespond = game.players.some((p) => {
        if (p.isAI) return false;
        if (p.id === game.pendingTrade!.proposerId) return false;
        if (game.pendingTrade!.rejectedBy.includes(p.id)) return false;
        return true;
      });
      delay = humanCanRespond ? AI_PROPOSER_WAIT_MS : AI_ACTION_DELAY_MS;
    }

    const t = setTimeout(() => {
      const action = chooseAction(game, acting);
      if (action) {
        dispatch(action);
      } else {
        dispatch({ type: 'endTurn', playerId: acting });
      }
    }, delay);
    return () => clearTimeout(t);
  }, [game, handoffPending, dialog, pendingRobberHex, dispatch, canDriveAI]);

  // Trade-evaluator driver: when a NEW trade (or counter) appears, schedule
  // every eligible AI responder ONCE — all firing roughly in parallel after
  // a fairness wait so the human can react. The first accept or counter
  // wins; later timers see a different pendingTrade and bail.
  //
  // The effect is keyed on a stable trade identity (proposer + give +
  // receive) so a rejection mutating `rejectedBy` doesn't tear down and
  // recreate the timers — that was making rejections look sequential, each
  // paying the initial-wait again.
  const tradeKey = game?.pendingTrade
    ? `${game.pendingTrade.proposerId}|${JSON.stringify(game.pendingTrade.give)}|${JSON.stringify(game.pendingTrade.receive)}`
    : null;
  useEffect(() => {
    if (!canDriveAI) return;
    if (!tradeKey) return;
    const initial = useGameStore.getState().game;
    if (!initial?.pendingTrade) return;
    const trade = initial.pendingTrade;
    const currentTurnPlayerId =
      initial.playerOrder[initial.currentPlayerIndex] ?? null;
    // True when the pendingTrade's proposer isn't the active turn player —
    // i.e., it's a counter. In that state only the original turn player is
    // involved in the negotiation; other AIs sit out.
    const isCounter = trade.proposerId !== currentTurnPlayerId;
    const eligibleAIs = initial.players.filter((p) => {
      if (!p.isAI) return false;
      if (p.id === trade.proposerId) return false;
      if (trade.rejectedBy.includes(p.id)) return false;
      if (isCounter && p.id !== currentTurnPlayerId) return false;
      return true;
    });
    if (eligibleAIs.length === 0) return;
    // Is any human still a possible responder? If so we wait the full
    // fairness pause so they can see the offer. Otherwise (e.g., the only
    // human already auto-rejected for lack of resources) the AIs can fire
    // immediately — no one's waiting on them.
    const humanCanRespond = initial.players.some((p) => {
      if (p.isAI) return false;
      if (p.id === trade.proposerId) return false;
      if (trade.rejectedBy.includes(p.id)) return false;
      if (isCounter && p.id !== currentTurnPlayerId) return false;
      return true;
    });
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
        if (latest.pendingTrade.rejectedBy.includes(p.id)) return;
        const liveCurrent =
          latest.playerOrder[latest.currentPlayerIndex] ?? null;
        const liveIsCounter = latest.pendingTrade.proposerId !== liveCurrent;
        if (liveIsCounter && p.id !== liveCurrent) return;
        if (shouldAcceptTrade(latest, p.id)) {
          dispatch({ type: 'acceptTrade', playerId: p.id });
          return;
        }
        if (liveIsCounter) {
          dispatch({ type: 'cancelTrade', playerId: p.id });
          return;
        }
        const counter = tryCounterTrade(latest, p.id);
        if (counter) {
          dispatch(counter);
          return;
        }
        dispatch({ type: 'rejectTrade', playerId: p.id });
      }, delay);
      timeouts.push(id);
    }
    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [tradeKey, dispatch, canDriveAI]);

  return null;
}
