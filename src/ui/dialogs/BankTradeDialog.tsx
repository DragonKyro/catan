import { PlayerTradeDialog } from './PlayerTradeDialog';

// Bank-only trading (paired-turn player 2, Merchant Fleet): the trade window
// without the offer to the other players.
export function BankTradeDialog() {
  return <PlayerTradeDialog bankOnly />;
}
