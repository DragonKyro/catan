import { useState, type ReactNode } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { Button } from '@/ui/shared/Button';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { SHIP_COST, MAX_SHIPS } from '@/game/modules/seafarers/constants';
import { CostCheatsheet } from './CostCheatsheet';
import './ActionBar.css';

export function ActionBar() {
  const { game, dispatch, setMode, openDialog, uiMode } = useGameStore();
  const undo = useGameStore((s) => s.undo);
  const canUndo = useGameStore((s) => s.lastActionSnapshot != null);
  const role = useNetworkStore((s) => s.role);
  const [showCosts, setShowCosts] = useState(false);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const phase = game.phase;
  const showUndo = canUndo && role === 'solo';

  const wrap = (content: ReactNode) => (
    <div className="actionbar-wrap">
      <button
        type="button"
        className={`actionbar-costs-btn${showCosts ? ' is-active' : ''}`}
        onClick={() => setShowCosts((s) => !s)}
        aria-label="Show building costs"
        aria-expanded={showCosts}
        title="Building costs"
      >
        💰
      </button>
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
      {showCosts && <CostCheatsheet onClose={() => setShowCosts(false)} />}
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

  if (phase === 'main' || phase === 'specialBuildPhase') {
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
    const sbp = phase === 'specialBuildPhase';
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
        <Button onClick={() => openDialog('bankTrade')}>🔁 Bank</Button>
        {sbp ? (
          <div className="actionbar-slot actionbar-sbp-tag" title="Special Build Phase — build between turns. No player trades or dev card plays.">
            🛠 Build
          </div>
        ) : (
          <Button
            onClick={() => openDialog('playerTrade')}
            disabled={!!game.pendingTrade}
            title="Propose a trade to all opponents"
          >
            🤝 Players
          </Button>
        )}
        <div className="actionbar-slot actionbar-slot-end">
          <Button
            variant="primary"
            fullWidth
            onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
          >
            {sbp ? 'End build ▸' : 'End turn ▸'}
          </Button>
        </div>
      </div>,
    );
  }

  // Setup, moveRobber, discard, gameOver are handled by other UI elements
  // (board highlights, dialogs) — no action bar content needed.
  return null;
}
