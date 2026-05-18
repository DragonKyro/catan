import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Board } from './Board';
import { AIDriver } from './AIDriver';
import { TurnTimer } from './TurnTimer';
import { ConnectionStatusOverlay } from './ConnectionStatusOverlay';
import { HandPanel } from '@/ui/panels/HandPanel';
import { OpponentPanel } from '@/ui/panels/OpponentPanel';
import { ActionBar } from '@/ui/panels/ActionBar';
import { DiceDisplay } from '@/ui/panels/DiceDisplay';
import { GameClock } from '@/ui/panels/GameClock';
import { BankPanel } from '@/ui/panels/BankPanel';
import { PendingTradeBanner } from '@/ui/panels/PendingTradeBanner';
import { SidePanelTabs } from '@/ui/panels/SidePanelTabs';
import { BankTradeDialog } from '@/ui/dialogs/BankTradeDialog';
import { PlayerTradeDialog } from '@/ui/dialogs/PlayerTradeDialog';
import { DiscardDialog } from '@/ui/dialogs/DiscardDialog';
import { RobberStealDialog } from '@/ui/dialogs/RobberStealDialog';
import { YearOfPlentyDialog } from '@/ui/dialogs/YearOfPlentyDialog';
import { MonopolyDialog } from '@/ui/dialogs/MonopolyDialog';
import { WondersDialog } from '@/ui/dialogs/WondersDialog';
import { GoldResourceDialog } from '@/ui/dialogs/GoldResourceDialog';
import { RobberOrPirateDialog } from '@/ui/dialogs/RobberOrPirateDialog';
import { GameOverDialog } from '@/ui/dialogs/GameOverDialog';
import { PassDeviceScreen } from '@/ui/handoff/PassDeviceScreen';
import { Rulebook } from '@/rulebook/Rulebook';
import { Button } from '@/ui/shared/Button';
import { CostCheatsheet } from '@/ui/panels/CostCheatsheet';
import { DevCardCheatsheet } from '@/ui/panels/DevCardCheatsheet';
import './GameView.css';

export function GameView() {
  const game = useGameStore((s) => s.game!);
  const dialog = useGameStore((s) => s.dialog);
  const handoffPending = useGameStore((s) => s.handoffPending);
  const error = useGameStore((s) => s.error);
  const dismissError = useGameStore((s) => s.dismissError);
  const pendingRobberHex = useGameStore((s) => s.pendingRobberHex);
  const resetGame = useGameStore((s) => s.resetGame);
  const role = useNetworkStore((s) => s.role);
  const leaveRoom = useNetworkStore((s) => s.leaveRoom);
  const isOnline = role !== 'solo';
  const [showRules, setShowRules] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [showDevCards, setShowDevCards] = useState(false);

  const isGameOver = game.phase === 'gameOver';

  const quitToMenu = () => {
    if (isOnline) leaveRoom();
    resetGame();
  };
  // Dialogs that render as overlays above the bottom strip. Kept docked but
  // anchored to the top of the board so they don't fight the hand panel.
  const tradeDialog =
    dialog === 'playerTrade' ? <PlayerTradeDialog /> : null;
  const bankTradeDialog =
    dialog === 'bankTrade' ? <BankTradeDialog /> : null;
  const yearOfPlentyDialog =
    dialog === 'yearOfPlenty' ? <YearOfPlentyDialog /> : null;
  const monopolyDialog = dialog === 'monopoly' ? <MonopolyDialog /> : null;
  const wondersDialog = dialog === 'wonders' ? <WondersDialog /> : null;
  const discardDialog =
    game.phase === 'discard' && !handoffPending ? <DiscardDialog /> : null;
  const goldDialog =
    game.phase === 'chooseGoldResource' && !handoffPending ? <GoldResourceDialog /> : null;
  const robberOrPirateDialog =
    game.phase === 'chooseRobberOrPirate' && !handoffPending ? <RobberOrPirateDialog /> : null;
  const robberDialog = pendingRobberHex ? <RobberStealDialog /> : null;

  return (
    <div className="gameview">
      <AIDriver />

      <main className="gameview-board">
        <Board />
        <div className="gameview-dice-overlay">
          <GameClock />
          <DiceDisplay />
          <TurnTimer />
        </div>
        <div className="gameview-topctrls">
          <button
            type="button"
            className="gameview-topctrl-btn"
            onClick={() => setShowRules(true)}
            aria-label="Open rulebook"
            title="Rulebook"
          >
            ?
          </button>
          <button
            type="button"
            className="gameview-topctrl-btn"
            onClick={() => setShowQuit(true)}
            aria-label="Quit to main menu"
            title="Quit to main menu"
          >
            ⌂
          </button>
          <div className="gameview-topctrl-pop">
            <button
              type="button"
              className={`gameview-topctrl-btn${showCosts ? ' is-active' : ''}`}
              onClick={() => {
                setShowCosts((s) => !s);
                setShowDevCards(false);
              }}
              aria-label="Show building costs"
              aria-expanded={showCosts}
              title="Building costs"
            >
              💰
            </button>
            {showCosts && <CostCheatsheet onClose={() => setShowCosts(false)} />}
          </div>
          <div className="gameview-topctrl-pop">
            <button
              type="button"
              className={`gameview-topctrl-btn${showDevCards ? ' is-active' : ''}`}
              onClick={() => {
                setShowDevCards((s) => !s);
                setShowCosts(false);
              }}
              aria-label="Show dev cards"
              aria-expanded={showDevCards}
              title="Dev cards: effects & deck counts"
            >
              🃏
            </button>
            {showDevCards && (
              <DevCardCheatsheet game={game} onClose={() => setShowDevCards(false)} />
            )}
          </div>
        </div>
        {/* Live trade banner — tucked along the top-right of the board,
            below the dice display, so it doesn't cover the map center. */}
        {game.pendingTrade && (
          <div className="gameview-banner-overlay">
            <PendingTradeBanner />
          </div>
        )}
        {/* Trade-building dialogs (propose / counter / bank) anchor to the
            left side of the board — the board middle stays viewable. */}
        {(tradeDialog || bankTradeDialog) && (
          <div className="gameview-side-dialog-overlay">
            {tradeDialog}
            {bankTradeDialog}
          </div>
        )}
        {/* Other prompts (discard, robber, dev-card pick) dock at the
            bottom-center of the board, above the hand strip. */}
        {(yearOfPlentyDialog || monopolyDialog || discardDialog || robberDialog || goldDialog || robberOrPirateDialog || wondersDialog) && (
          <div className="gameview-dialog-overlay">
            {yearOfPlentyDialog}
            {monopolyDialog}
            {wondersDialog}
            {discardDialog}
            {robberDialog}
            {goldDialog}
            {robberOrPirateDialog}
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

      {showQuit && (
        <DialogShell
          title="Quit to main menu?"
          variant="modal"
          onClose={() => setShowQuit(false)}
          footer={
            <>
              <Button onClick={() => setShowQuit(false)}>Keep playing</Button>
              <Button variant="danger" onClick={quitToMenu}>
                Quit
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, color: 'var(--text-soft)' }}>
            This game will end and you'll return to the main menu.
            {isOnline ? ' You will leave the room.' : ''} Progress is not saved.
          </p>
        </DialogShell>
      )}

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
