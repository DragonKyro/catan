import { type ReactNode } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { Button } from '@/ui/shared/Button';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { isPairedPlayer2 } from '@/game/helpers';
import { SHIP_COST, MAX_SHIPS } from '@/game/modules/seafarers/constants';
import { hasShipAdjacentToFleet } from '@/game/modules/seafarers/actions/attackPirateFleet';
import {
  CITIES_AND_KNIGHTS_EXPANSION_ID,
  MAX_CITY_WALLS,
} from '@/game/modules/citiesAndKnights/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
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

  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  const hasTraders = game.settings.expansions.includes(TRADERS_EXPANSION_ID);

  if (phase === 'rollOrPlayKnight') {
    // Under C&K, dev cards are replaced by progress cards — no "Play Knight"
    // pre-roll. Phase 8c will introduce the equivalent Alchemy pre-roll.
    const hasKnight =
      !hasCK &&
      !game.hasPlayedDevCardThisTurn &&
      player.devCards.unplayed.includes('knight');
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
        {hasTraders && (
          <Button
            disabled={
              !canAfford(player.resources, COSTS.bridge) ||
              (player.bridges?.length ?? 0) >= 3 ||
              (game.riverEdges?.length ?? 0) === 0
            }
            onClick={() => setMode({ kind: 'buildBridge' })}
            title="Build Bridge (1🌲 1🧱) — required to cross river edges; pays +3 gold"
          >
            🌉 Bridge
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
        {hasCK && (
          <Button
            disabled={
              !canAfford(player.resources, COSTS.cityWall) ||
              player.cities.length === 0 ||
              (player.cityWalls ?? 0) >= MAX_CITY_WALLS
            }
            onClick={() => setMode({ kind: 'buildCityWall' })}
            title="Build City Wall (2🧱) — adds +2 to your 7-roll hand limit"
          >
            🧱 Wall
          </Button>
        )}
        {hasCK && (
          <Button
            disabled={
              !canAfford(player.resources, COSTS.knight) ||
              (game.knightSupply?.[acting]?.[1] ?? 0) <= 0
            }
            onClick={() => setMode({ kind: 'recruitKnight' })}
            title="Recruit Knight (1🐑 1🪨)"
          >
            🛡 Recruit
          </Button>
        )}
        {hasCK && (
          <Button
            disabled={
              !canAfford(player.resources, COSTS.activateKnight) ||
              !Object.values(game.knights ?? {}).some(
                (k) => k.playerId === acting && !k.active,
              )
            }
            onClick={() => setMode({ kind: 'activateKnight' })}
            title="Activate Knight (1🌾)"
          >
            ⚡ Activate
          </Button>
        )}
        {hasCK && (
          <Button
            disabled={
              !!game.promotedKnightThisTurn ||
              !canAfford(player.resources, COSTS.promoteKnight) ||
              !Object.values(game.knights ?? {}).some(
                (k) => k.playerId === acting && k.strength < 3,
              )
            }
            onClick={() => setMode({ kind: 'promoteKnight' })}
            title="Promote Knight (1🐑 1🪨) — once per turn"
          >
            ⬆ Promote
          </Button>
        )}
        {hasCK && (
          <Button
            disabled={
              !Object.values(game.knights ?? {}).some(
                (k) => k.playerId === acting && k.active,
              )
            }
            onClick={() => setMode({ kind: 'moveKnight' })}
            title="Move an active knight (then click destination)"
          >
            ➡ Move Knight
          </Button>
        )}
        {hasCK && (
          <Button
            onClick={() => openDialog('cityImprovements')}
            title="Build a city improvement (spends commodities)"
          >
            📜 Improve
          </Button>
        )}
        {hasCK && (() => {
          const p = game.players.find((x) => x.id === acting);
          const cards = p?.progressCards;
          const total = cards
            ? cards.science.length + cards.trade.length + cards.politics.length
            : 0;
          return (
            <Button
              disabled={total === 0}
              onClick={() => openDialog('progressCards')}
              title={`Play a progress card (${total} in hand)`}
            >
              🃏 Cards ({total})
            </Button>
          );
        })()}
        {!hasCK && (
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
        )}
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
        {(player.fishTokens?.length ?? 0) > 0 && (
          <Button
            onClick={() => openDialog('spendFish')}
            title="Spend fish tokens for an effect (drive off robber, take from bank)"
          >
            🐟 Spend ({player.fishTokens!.length})
          </Button>
        )}
        {game.oldBootHolder === acting && (
          <Button
            onClick={() => openDialog('passBoot')}
            title="Pass the old boot to any opponent with ≥ your visible VPs"
          >
            👢 Pass boot
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
