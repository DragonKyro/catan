import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { Button } from '@/ui/shared/Button';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import './ActionBar.css';

export function ActionBar() {
  const { game, dispatch, setMode, openDialog, uiMode } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const phase = game.phase;

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
    return (
      <div className="actionbar">
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            const d1 = 1 + Math.floor(Math.random() * 6);
            const d2 = 1 + Math.floor(Math.random() * 6);
            dispatch({ type: 'rollDice', playerId: acting, dice: [d1, d2] });
          }}
        >
          🎲 Roll dice
        </Button>
        {hasKnight && (
          <Button onClick={() => dispatch({ type: 'playKnight', playerId: acting })}>
            ⚔️ Play Knight first
          </Button>
        )}
      </div>
    );
  }

  if (phase === 'main') {
    const inMode = uiMode.kind !== 'idle';
    const cancel = () => setMode({ kind: 'idle' });
    return (
      <div className="actionbar">
        {inMode ? (
          <Button onClick={cancel}>Cancel build</Button>
        ) : (
          <>
            <Button
              disabled={!canAfford(player.resources, COSTS.road)}
              onClick={() => setMode({ kind: 'buildRoad' })}
              title="Build Road (1🌲 1🧱)"
            >
              🛣 Road
            </Button>
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
            <Button
              onClick={() => openDialog('playerTrade')}
              disabled={!!game.pendingTrade}
              title="Propose a trade to all opponents"
            >
              🤝 Players
            </Button>
            <Button
              variant="primary"
              onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
            >
              End turn ▸
            </Button>
          </>
        )}
      </div>
    );
  }

  // Setup, moveRobber, discard, gameOver are handled by other UI elements
  // (board highlights, dialogs) — no action bar content needed.
  return null;
}
