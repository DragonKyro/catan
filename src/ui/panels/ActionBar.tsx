import { type ReactNode } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { Button } from '@/ui/shared/Button';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { isPairedPlayer2 } from '@/game/helpers';
import { SHIP_COST, MAX_SHIPS } from '@/game/modules/seafarers/constants';
import { hasShipAdjacentToFleet } from '@/game/modules/seafarers/actions/attackPirateFleet';
import './ActionBar.css';

export function ActionBar() {
  const { game, dispatch, setMode, openDialog, uiMode } = useGameStore();
  const undo = useGameStore((s) => s.undo);
  const canUndo = useGameStore((s) => s.lastActionSnapshot != null);
  const role = useNetworkStore((s) => s.role);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const phase = game.phase;
  const showUndo = canUndo && role === 'solo';

  const wrap = (content: ReactNode) => (
    <div className="actionbar-wrap">
      {showUndo && (
        <button
          type="button"
          className="actionbar-undo-btn"
          onClick={() => undo()}
          aria-label="Undo last action"
          title="Undo last build/trade (this turn only)"
        >
          ↶
        </button>
      )}
      {content}
    </div>
  );

  if (role === 'spectator') {
    return (
      <div className="actionbar actionbar-hint">
        Spectating — you can chat but can't take actions.
      </div>
    );
  }

  // In online mode, only show actions when it's our turn.
  if (role !== 'solo') {
    const myPid = getMyPlayerId(game);
    if (myPid !== acting && phase !== 'gameOver') {
      return (
        <div className="actionbar actionbar-thinking">
          <span className="actionbar-spinner" aria-hidden /> Waiting for {player.name}…
        </div>
      );
    }
  }

  // AI is acting — render nothing.
  if (player.isAI && phase !== 'gameOver') {
    return null;
  }

  if (phase === 'rollOrPlayKnight') {
    const hasKnight =
      !game.hasPlayedDevCardThisTurn && player.devCards.unplayed.includes('knight');
    return wrap(
      <div className="actionbar">
        <div className="actionbar-slot actionbar-slot-wide">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              const d1 = 1 + Math.floor(Math.random() * 6);
              const d2 = 1 + Math.floor(Math.random() * 6);
              dispatch({ type: 'rollDice', playerId: acting, dice: [d1, d2] });
            }}
          >
            🎲 Roll dice
          </Button>
        </div>
        {hasKnight && (
          <div className="actionbar-slot actionbar-slot-wide">
            <Button
              fullWidth
              onClick={() => dispatch({ type: 'playKnight', playerId: acting })}
            >
              ⚔️ Play Knight
            </Button>
          </div>
        )}
      </div>,
    );
  }

  if (phase === 'main') {
    const inMode = uiMode.kind !== 'idle';
    const cancel = () => setMode({ kind: 'idle' });
    if (inMode) {
      return wrap(
        <div className="actionbar">
          <div className="actionbar-slot actionbar-slot-wide">
            <Button fullWidth onClick={cancel}>
              Cancel build
            </Button>
          </div>
        </div>,
      );
    }
    // 5+ player paired-player rule: when the acting seat is Player 2,
    // the trade button collapses to a bank-only label and we suppress the
    // player-trade dialog entry point. P2 can still bank-trade.
    const pairedP2 = isPairedPlayer2(game);
    return wrap(
      <div className="actionbar">
        <Button
          disabled={!canAfford(player.resources, COSTS.road)}
          onClick={() => setMode({ kind: 'buildRoad' })}
          title="Build Road (1🌲 1🧱)"
        >
          🛣 Road
        </Button>
        {game.settings.expansions.includes('seafarers') && (
          <Button
            disabled={
              !canAfford(player.resources, SHIP_COST) ||
              player.ships.length >= MAX_SHIPS
            }
            onClick={() => setMode({ kind: 'buildShip' })}
            title="Build Ship (1🌲 1🐑)"
          >
            ⛵ Ship
          </Button>
        )}
        <Button
          disabled={
            !canAfford(player.resources, COSTS.settlement) ||
            player.settlements.length >= 5
          }
          onClick={() => setMode({ kind: 'buildSettlement' })}
          title="Build Settlement (1🌲 1🧱 1🐑 1🌾)"
        >
          🏠 Settlement
        </Button>
        <Button
          disabled={
            !canAfford(player.resources, COSTS.city) ||
            player.cities.length >= 4 ||
            player.settlements.length === 0
          }
          onClick={() => setMode({ kind: 'buildCity' })}
          title="Build City (2🌾 3🪨)"
        >
          🏛 City
        </Button>
        <Button
          disabled={
            !canAfford(player.resources, COSTS.devCard) ||
            game.devCardDeck.length === 0
          }
          onClick={() => dispatch({ type: 'buyDevCard', playerId: acting })}
          title="Buy Dev Card (1🐑 1🌾 1🪨)"
        >
          🃏 Dev Card
        </Button>
        {pairedP2 ? (
          <Button
            onClick={() => openDialog('bankTrade')}
            title="Paired-turn Player 2 — bank trades only (no player trades)"
          >
            🏦 Bank trade
          </Button>
        ) : (
          <Button
            onClick={() => openDialog('playerTrade')}
            disabled={!!game.pendingTrade}
            title="Trade — single-resource swaps the bank can match are auto-routed; everything else is offered to other players"
          >
            🤝 Trade
          </Button>
        )}
        {game.wonders && game.wonders.length > 0 && (
          <Button
            onClick={() => openDialog('wonders')}
            title="Build a wonder — finish one to win"
          >
            🏛️ Wonder
          </Button>
        )}
        {(() => {
          const fleet = game.pirateFleet;
          if (!fleet || fleet.defeatedBy !== null) return null;
          const adjacent = hasShipAdjacentToFleet(game, acting);
          const alreadyAttacked = !!game.attackedPirateThisTurn;
          const disabled = !adjacent || alreadyAttacked;
          const title = alreadyAttacked
            ? 'Already attacked this turn'
            : !adjacent
              ? 'Need a ship adjacent to the pirate fleet'
              : `Attack pirate fleet (${fleet.strength}/${fleet.maxStrength})`;
          return (
            <Button
              disabled={disabled}
              onClick={() => dispatch({ type: 'attackPirateFleet', playerId: acting })}
              title={title}
            >
              ⚔️ Attack ({fleet.strength})
            </Button>
          );
        })()}
        <div className="actionbar-slot actionbar-slot-end">
          <Button
            variant="primary"
            fullWidth
            onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
          >
            End turn ▸
          </Button>
        </div>
      </div>,
    );
  }

  // Setup, moveRobber, discard, gameOver are handled by other UI elements
  // (board highlights, dialogs) — no action bar content needed.
  return null;
}
