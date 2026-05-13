import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { Button } from '@/ui/shared/Button';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import './ActionBar.css';

export function ActionBar() {
  const { game, dispatch, setMode, openDialog, uiMode } = useGameStore();
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const phase = game.phase;

  // AI is acting — show a thinking indicator instead of buttons.
  if (player.isAI && phase !== 'gameOver') {
    return (
      <div className="actionbar actionbar-thinking">
        <span className="actionbar-spinner" aria-hidden /> {player.name} is thinking…
      </div>
    );
  }

  if (phase === 'rollOrPlayKnight') {
    const hasKnight =
      !game.hasPlayedDevCardThisTurn && player.devCards.unplayed.includes('knight');
    return (
      <div className="actionbar">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => {
            const d1 = 1 + Math.floor(Math.random() * 6);
            const d2 = 1 + Math.floor(Math.random() * 6);
            dispatch({
              type: 'rollDice',
              playerId: acting,
              dice: [d1, d2],
            });
          }}
        >
          🎲 Roll dice
        </Button>
        {hasKnight && (
          <Button
            onClick={() => dispatch({ type: 'playKnight', playerId: acting })}
            fullWidth
          >
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
          <Button fullWidth onClick={cancel}>
            Cancel
          </Button>
        ) : (
          <>
            <div className="actionbar-row">
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
            </div>
            <div className="actionbar-row">
              <Button
                disabled={
                  !canAfford(player.resources, COSTS.devCard) ||
                  game.devCardDeck.length === 0
                }
                onClick={() =>
                  dispatch({ type: 'buyDevCard', playerId: acting })
                }
                title="Buy Dev Card (1🐑 1🌾 1🪨)"
              >
                🃏 Buy Dev Card
              </Button>
              <Button onClick={() => openDialog('bankTrade')}>🔁 Bank</Button>
              <Button
                onClick={() => openDialog('playerTrade')}
                disabled={!!game.pendingTrade}
                title="Propose a trade to all opponents"
              >
                🤝 Players
              </Button>
            </div>
            <Button
              variant="primary"
              fullWidth
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
  // (overlay, dialogs) — no action bar buttons needed.
  return <div className="actionbar actionbar-hint">Follow the highlighted spots on the board.</div>;
}
