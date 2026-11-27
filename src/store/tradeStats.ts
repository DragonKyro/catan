// Who traded with whom over a game, for the end-of-game summary: completed
// player trades per pair (a counter-offer accepted counts like any other
// trade) and trades with the bank or a harbor per player.
//
// Player trades come from logStore's `tradeAccepted` entries (logged only when
// cards move, in every rule set); bank trades from the applied actions
// (`bankTrade`, and Cities & Knights' `bankTradeCK` with commodities), one per
// action — a 2× harbor trade in one go is one trade.

import type { Action, PlayerId } from '@/game/types';
import type { LogEntry } from './logStore';

export interface PlayerTrades {
  /** Completed player trades with each other player. */
  partners: Record<PlayerId, number>;
  /** Trades with the bank or a harbor. */
  bank: number;
  /** Everything above. */
  total: number;
}

export function tradeBreakdown(
  playerIds: readonly PlayerId[],
  entries: readonly LogEntry[],
  actions: readonly Action[],
): Record<PlayerId, PlayerTrades> {
  const out: Record<PlayerId, PlayerTrades> = {};
  for (const id of playerIds) {
    out[id] = { partners: Object.fromEntries(playerIds.filter((o) => o !== id).map((o) => [o, 0])), bank: 0, total: 0 };
  }
  for (const e of entries) {
    if (e.kind !== 'tradeAccepted') continue;
    const a = out[e.proposer];
    const b = out[e.acceptor];
    if (!a || !b || e.proposer === e.acceptor) continue;
    a.partners[e.acceptor] = (a.partners[e.acceptor] ?? 0) + 1;
    b.partners[e.proposer] = (b.partners[e.proposer] ?? 0) + 1;
    a.total += 1;
    b.total += 1;
  }
  for (const action of actions) {
    if (action.type !== 'bankTrade' && action.type !== 'bankTradeCK') continue;
    const p = out[action.playerId];
    if (!p) continue;
    p.bank += 1;
    p.total += 1;
  }
  return out;
}
