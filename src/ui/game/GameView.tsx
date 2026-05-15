import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { Board } from './Board';
import { AIDriver } from './AIDriver';
import { ConnectionStatusOverlay } from './ConnectionStatusOverlay';
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
  // Dialogs that render as overlays above the bottom strip. Kept docked but
  // anchored to the top of the board so they don't fight the hand panel.
  const tradeDialog =
    dialog === 'playerTrade' ? <PlayerTradeDialog /> : null;
  const bankTradeDialog =
    dialog === 'bankTrade' ? <BankTradeDialog /> : null;
  const yearOfPlentyDialog =
    dialog === 'yearOfPlenty' ? <YearOfPlentyDialog /> : null;
  const monopolyDialog = dialog === 'monopoly' ? <MonopolyDialog /> : null;
  const discardDialog =
    game.phase === 'discard' && !handoffPending ? <DiscardDialog /> : null;
  const robberDialog = pendingRobberHex ? <RobberStealDialog /> : null;

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
        {/* Trade UI overlays the top-center of the board so it doesn't fight
            the hand strip at the bottom or the side panel on the right. */}
        {(game.pendingTrade || tradeDialog || bankTradeDialog) && (
          <div className="gameview-trade-overlay">
            {game.pendingTrade && <PendingTradeBanner />}
            {tradeDialog}
            {bankTradeDialog}
          </div>
        )}
        {/* Remaining dialogs dock at the top of the board too — the bottom
            strip below holds the hand and actions. */}
        {(yearOfPlentyDialog || monopolyDialog || discardDialog || robberDialog) && (
          <div className="gameview-dialog-overlay">
            {yearOfPlentyDialog}
            {monopolyDialog}
            {discardDialog}
            {robberDialog}
          </div>
        )}
      </main>

      <section className="gameview-bottom">
        <HandPanel />
        <ActionBar />
      </section>

      <aside className="gameview-side">
        <SidePanelTabs showChat={isOnline} />
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
