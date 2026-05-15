import { useState } from 'react';
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
import { SidePanelTabs } from '@/ui/panels/SidePanelTabs';
import { BankTradeDialog } from '@/ui/dialogs/BankTradeDialog';
import { PlayerTradeDialog } from '@/ui/dialogs/PlayerTradeDialog';
import { DiscardDialog } from '@/ui/dialogs/DiscardDialog';
import { RobberStealDialog } from '@/ui/dialogs/RobberStealDialog';
import { YearOfPlentyDialog } from '@/ui/dialogs/YearOfPlentyDialog';
import { MonopolyDialog } from '@/ui/dialogs/MonopolyDialog';
import { GameOverDialog } from '@/ui/dialogs/GameOverDialog';
import { PassDeviceScreen } from '@/ui/handoff/PassDeviceScreen';
import { Rulebook } from '@/rulebook/Rulebook';
import { Button } from '@/ui/shared/Button';
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
  const [showRules, setShowRules] = useState(false);

  const isGameOver = game.phase === 'gameOver';

  return (
    <div className="gameview">
      <AIDriver />

      <main className="gameview-board">
        <Board />
        <div className="gameview-dice-overlay">
          <DiceDisplay />
        </div>
        <button
          type="button"
          className="gameview-help-btn"
          onClick={() => setShowRules(true)}
          aria-label="Open rulebook"
          title="Rulebook"
        >
          ?
        </button>
        {/* Docked dialogs render inside the board column so they sit at the
            bottom of the board without covering the side panel. */}
        {dialog === 'bankTrade' && <BankTradeDialog />}
        {dialog === 'playerTrade' && <PlayerTradeDialog />}
        {dialog === 'yearOfPlenty' && <YearOfPlentyDialog />}
        {dialog === 'monopoly' && <MonopolyDialog />}
        {game.phase === 'discard' && !handoffPending && <DiscardDialog />}
        {pendingRobberHex && <RobberStealDialog />}
      </main>

      <aside className="gameview-side">
        <PhaseBanner />
        {game.pendingTrade && <PendingTradeBanner />}
        <SidePanelTabs showChat={isOnline} />
        <HandPanel />
        <ActionBar />
        <OpponentPanel />
        <BankPanel />
      </aside>

      {error && (
        <div className="gameview-toast" onClick={dismissError}>
          {error}
        </div>
      )}

      {isGameOver && <GameOverDialog />}
      {handoffPending && !isGameOver && <PassDeviceScreen />}
      {isOnline && <ConnectionStatusOverlay />}

      {showRules && (
        <div
          className="gameview-rulebook-overlay"
          onClick={() => setShowRules(false)}
        >
          <div
            className="gameview-rulebook"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="gameview-rulebook-head">
              <h2>Rulebook</h2>
              <Button size="sm" onClick={() => setShowRules(false)}>
                Close
              </Button>
            </header>
            <div className="gameview-rulebook-body">
              <Rulebook variant="embedded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
