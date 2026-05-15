import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { getActingPlayerId } from '@/game/helpers';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { tryCounterTrade } from '@/ai/trade';

const AI_ACTION_DELAY_MS = 450;
// Stagger between AI responders evaluating a pending trade. Long enough that
// the player can see each AI's offer/counter unfold and react themselves.
const AI_TRADE_DELAY_MS = 2200;
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
      delay = AI_PROPOSER_WAIT_MS;
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

  // Trade-evaluator driver: when a trade is open, each AI opponent fires
  // after a short stagger and decides accept / counter / reject. First
  // accept or counter wins (the other AIs' timers will see a different
  // pendingTrade at fire time and bail).
  useEffect(() => {
    if (!canDriveAI) return;
    if (!game?.pendingTrade) return;
    const trade = game.pendingTrade;
    const currentTurnPlayerId =
      game.playerOrder[game.currentPlayerIndex] ?? null;
    // True when the current pendingTrade was placed by someone other than
    // the active turn player — i.e., it's already a counter. We don't
    // re-counter to avoid infinite ping-pong.
    const isCounter = trade.proposerId !== currentTurnPlayerId;
    const aiOpponents = game.players.filter(
      (p) => p.id !== trade.proposerId && p.isAI && !trade.rejectedBy.includes(p.id),
    );
    if (aiOpponents.length === 0) return;
    const timeouts: number[] = [];
    for (let i = 0; i < aiOpponents.length; i++) {
      const p = aiOpponents[i]!;
      const delay = AI_TRADE_DELAY_MS * (i + 1);
      const id = window.setTimeout(() => {
        const latest = useGameStore.getState().game;
        if (!latest?.pendingTrade) return;
        if (latest.pendingTrade.proposerId === p.id) return;
        if (latest.pendingTrade.rejectedBy.includes(p.id)) return;
        if (shouldAcceptTrade(latest, p.id)) {
          dispatch({ type: 'acceptTrade', playerId: p.id });
          return;
        }
        // Try a counter — but only if this isn't already a counter.
        if (!isCounter) {
          const counter = tryCounterTrade(latest, p.id);
          if (counter) {
            dispatch(counter);
            return;
          }
        }
        // Otherwise, register a rejection so the proposer sees it.
        dispatch({ type: 'rejectTrade', playerId: p.id });
      }, delay);
      timeouts.push(id);
    }
    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [game?.pendingTrade, dispatch, canDriveAI, game?.players, game?.playerOrder, game?.currentPlayerIndex]);

  return null;
}
