import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { Board } from './Board';
import { AIDriver } from './AIDriver';
import { ConnectionStatusOverlay } from './ConnectionStatusOverlay';
import { PhaseBanner } from '@/ui/panels/PhaseBanner';
import { HandPanel } from '@/ui/panels/HandPanel';
import { OpponentPanel } from '@/ui/panels/OpponentPanel';
import { ActionBar } from '@/ui/panels/ActionBar';
import { DiceDisplay } from '@/ui/panels/DiceDisplay';
import { BankPanel } from '@/ui/panels/BankPanel';
import { PendingTradeBanner } from '@/ui/panels/PendingTradeBanner';
import { ChatPanel } from '@/ui/chat/ChatPanel';
import { BankTradeDialog } from '@/ui/dialogs/BankTradeDialog';
import { PlayerTradeDialog } from '@/ui/dialogs/PlayerTradeDialog';
import { DiscardDialog } from '@/ui/dialogs/DiscardDialog';
import { RobberStealDialog } from '@/ui/dialogs/RobberStealDialog';
import { YearOfPlentyDialog } from '@/ui/dialogs/YearOfPlentyDialog';
import { MonopolyDialog } from '@/ui/dialogs/MonopolyDialog';
import { GameOverDialog } from '@/ui/dialogs/GameOverDialog';
import { PassDeviceScreen } from '@/ui/handoff/PassDeviceScreen';
import './GameView.css';

export function GameView() {
  const game = useGameStore((s) => s.game!);
  const dialog = useGameStore((s) => s.dialog);
  const handoffPending = useGameStore((s) => s.handoffPending);
  const error = useGameStore((s) => s.error);
  const dismissError = useGameStore((s) => s.dismissError);
  const pendingRobberHex = useGameStore((s) => s.pendingRobberHex);
  const role = useNetworkStore((s) => s.role);
  const isOnline = role !== 'solo';

  const isGameOver = game.phase === 'gameOver';

  return (
    <div className="gameview">
      <AIDriver />

      <main className="gameview-board">
        <Board />
        <div className="gameview-dice-overlay">
          <DiceDisplay />
        </div>
      </main>

      <aside className="gameview-side">
        <PhaseBanner />
        {game.pendingTrade && <PendingTradeBanner />}
        <HandPanel />
        <ActionBar />
        <OpponentPanel />
        <BankPanel />
        {isOnline && <ChatPanel compact />}
      </aside>

      {error && (
        <div className="gameview-toast" onClick={dismissError}>
          {error}
        </div>
      )}

      {dialog === 'bankTrade' && <BankTradeDialog />}
      {dialog === 'playerTrade' && <PlayerTradeDialog />}
      {dialog === 'yearOfPlenty' && <YearOfPlentyDialog />}
      {dialog === 'monopoly' && <MonopolyDialog />}
      {game.phase === 'discard' && !handoffPending && <DiscardDialog />}
      {pendingRobberHex && <RobberStealDialog />}
      {isGameOver && <GameOverDialog />}
      {handoffPending && !isGameOver && <PassDeviceScreen />}
      {isOnline && <ConnectionStatusOverlay />}
    </div>
  );
}
