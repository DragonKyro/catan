import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { getActingPlayerId } from '@/game/helpers';
import { chooseAction, shouldAcceptTrade } from '@/ai';

const AI_ACTION_DELAY_MS = 450;
const AI_TRADE_DELAY_MS = 350;

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

    // If there's a pending trade and acting is the proposer (AI), they'll
    // cancel/wait in chooseAction. Otherwise we let the trade-accept driver
    // below run first.
    if (game.pendingTrade && acting !== game.pendingTrade.proposerId) return;

    const t = setTimeout(() => {
      const action = chooseAction(game, acting);
      if (action) {
        dispatch(action);
      } else {
        dispatch({ type: 'endTurn', playerId: acting });
      }
    }, AI_ACTION_DELAY_MS);
    return () => clearTimeout(t);
  }, [game, handoffPending, dialog, pendingRobberHex, dispatch, canDriveAI]);

  // Trade-accept driver: when a trade is open, any AI opponent that should
  // accept fires after a short stagger. First accept wins.
  useEffect(() => {
    if (!canDriveAI) return;
    if (!game?.pendingTrade) return;
    const trade = game.pendingTrade;
    const aiOpponents = game.players.filter(
      (p) => p.id !== trade.proposerId && p.isAI,
    );
    if (aiOpponents.length === 0) return;
    const timeouts: number[] = [];
    for (let i = 0; i < aiOpponents.length; i++) {
      const p = aiOpponents[i]!;
      const delay = AI_TRADE_DELAY_MS * (i + 1);
      const id = window.setTimeout(() => {
        // Re-check at fire time — trade might have been accepted by someone else
        const latest = useGameStore.getState().game;
        if (!latest?.pendingTrade) return;
        if (latest.pendingTrade.proposerId === p.id) return;
        if (shouldAcceptTrade(latest, p.id)) {
          dispatch({ type: 'acceptTrade', playerId: p.id });
        }
      }, delay);
      timeouts.push(id);
    }
    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [game?.pendingTrade, dispatch, canDriveAI, game?.players]);

  return null;
}
