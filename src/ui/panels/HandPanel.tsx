import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { RESOURCES } from '@/game/types';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { DevCardChip, DEV_LABEL } from '@/ui/shared/DevCardChip';
import { calculateVictoryPoints, calculateIslandBonusVp } from '@/game/scoring/points';
import { BarbarianAttackBadges } from '@/ui/game/traders/BarbarianAttackBadges';
import { playerColorVar } from '@/ui/shared/playerColors';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { TradersHandStrip } from './TradersHandStrip';
import { CKHandCards, CKHandFlags } from './citiesAndKnights/CKHand';
import './HandPanel.css';

export function HandPanel() {
  const { game, dispatch, openDialog, uiMode, setMode, handoffAcknowledgedForPlayer } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  if (!game) return null;

  // Whose hand do we display?
  // - spectator: no hand visible.
  // - online player: always the local seat (us).
  // - solo: the device-bound human. Defaults to the last-acknowledged
  //   handoff player; falls back to the first non-AI player so my own hand
  //   stays visible even when an AI is taking its turn.
  if (role === 'spectator') {
    return (
      <section className="hand">
        <header className="hand-header">
          <h3>Spectating</h3>
        </header>
        <div className="hand-empty" style={{ padding: '8px 0' }}>
          You are watching this game.
        </div>
      </section>
    );
  }

  // All-AI solo games have no human-bound seat — there's no info to leak, so
  // show the currently-acting player's hand (so a human spectating the AI
  // self-play sees actual game state).
  const hasHuman = game.players.some((p) => !p.isAI);

  let viewedId: string | null;
  if (role === 'solo') {
    if (!hasHuman) {
      viewedId = getActingPlayerId(game);
    } else {
      const acked = handoffAcknowledgedForPlayer
        ? game.players.find((p) => p.id === handoffAcknowledgedForPlayer)
        : null;
      if (acked && !acked.isAI) {
        viewedId = acked.id;
      } else {
        viewedId = game.players.find((p) => !p.isAI)?.id ?? game.players[0]!.id;
      }
    }
  } else {
    const myPid = getMyPlayerId(game);
    if (!myPid) return null;
    viewedId = myPid;
  }
  const player = game.players.find((p) => p.id === viewedId)!;
  const acting = getActingPlayerId(game);
  const isMyTurn = viewedId === acting;
  // Card-playing is allowed only when it's our turn and we aren't already in
  // a build mode.
  const canPlayCards =
    !player.isAI &&
    isMyTurn &&
    (game.phase === 'main' || game.phase === 'rollOrPlayKnight') &&
    !game.hasPlayedDevCardThisTurn &&
    uiMode.kind === 'idle';
  const vp = calculateVictoryPoints(game, player.id, true);
  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);

  const cardCounts: Record<string, number> = {};
  for (const c of player.devCards.unplayed) {
    cardCounts[c] = (cardCounts[c] ?? 0) + 1;
  }
  const hasAnyCards =
    Object.keys(cardCounts).length > 0 ||
    player.devCards.boughtThisTurn.length > 0 ||
    player.devCards.victoryPoints > 0;

  const onPlay = (card: string) => {
    if (card === 'knight') {
      dispatch({ type: 'playKnight', playerId: player.id });
    } else if (card === 'roadBuilding') {
      setMode({ kind: 'roadBuilding', remaining: 2 });
    } else if (card === 'yearOfPlenty') {
      openDialog('yearOfPlenty');
    } else if (card === 'monopoly') {
      openDialog('monopoly');
    }
  };

  return (
    <section className="hand">
      <header className="hand-header">
        <h3 title={player.name}>
          <span
            className="hand-swatch"
            style={{ background: playerColorVar(player.color) }}
            aria-hidden
          />
          {player.name}
          {player.hasLongestRoad && (
            <span
              className="hand-flag"
              title={`${game.settings.expansions.includes('seafarers') || game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID) ? 'Longest Route' : 'Longest Road'} (+2 VP)`}
            >
              🛣️
            </span>
          )}
          {player.hasLargestArmy && (
            <span className="hand-flag" title="Largest Army (+2 VP)">⚔️</span>
          )}
          {(() => {
            const chipVp = calculateIslandBonusVp(game, player.id);
            return chipVp > 0 ? (
              <span
                className="hand-flag"
                title={`Island settlement bonuses (+${chipVp} VP)`}
              >
                🏝 +{chipVp}
              </span>
            ) : null;
          })()}
          {(player.cloth ?? 0) > 0 && (
            <span
              className="hand-flag"
              title={`Cloth tokens — ${player.cloth} cloth = ${Math.floor((player.cloth ?? 0) / 2)} VP`}
            >
              🧵 {player.cloth}
            </span>
          )}
          {(player.tribeVp ?? 0) > 0 && (
            <span className="hand-flag" title={`Tribe VP tokens (+${player.tribeVp} VP)`}>
              ★ {player.tribeVp}
            </span>
          )}
          {(player.warships?.length ?? 0) > 0 && (
            <span
              className="hand-flag"
              title={`Warships — your strength against the pirates (${player.warships!.length})`}
            >
              ⚔⛵ {player.warships!.length}
            </span>
          )}
          {(player.heldPorts?.length ?? 0) > 0 && (
            <span
              className="hand-flag"
              title="Tribe ports waiting for a coastal settlement with room for a port"
            >
              ⚓ {player.heldPorts!.length}
            </span>
          )}
          {hasCK && <CKHandFlags game={game} player={player} />}
          {game.strongestPorts?.holder === player.id && (
            <span className="hand-flag" title="Strongest Ports (+2 VP)">
              ⚓
            </span>
          )}
          <BarbarianAttackBadges game={game} playerId={player.id} className="hand-flag" />
        </h3>
        <span
          className="hand-vp"
          title={`Victory points (first to ${game.settings.victoryPointsToWin} wins)`}
        >
          {vp}/{game.settings.victoryPointsToWin} VP
        </span>
      </header>

      <div className="hand-resources">
        {RESOURCES.map((r) => (
          <ResourceChip
            key={r}
            resource={r}
            count={player.resources[r]}
            dimmed={player.resources[r] === 0}
          />
        ))}
      </div>

      <TradersHandStrip
        game={game}
        player={player}
        ownTurn={game.playerOrder[game.currentPlayerIndex] === player.id}
      />

      {hasCK && (
        <CKHandCards
          player={player}
          canPlay={!player.isAI && isMyTurn && (game.phase === 'main' || game.phase === 'rollOrPlayKnight')}
        />
      )}

      {!hasCK && (
      <div className="hand-section">
        <div className="hand-cards">
          {Object.entries(cardCounts).map(([card, count]) => {
            // Before the roll only a Knight may be played.
            const playable = canPlayCards && (card === 'knight' || game.phase === 'main');
            const label =
              card === 'knight' && game.pirateIslands
                ? 'Knight (turns your ship nearest the start of your route into a warship)'
                : DEV_LABEL[card as keyof typeof DEV_LABEL];
            return (
              <DevCardChip
                key={card}
                card={card as never}
                count={count}
                onClick={playable ? () => onPlay(card) : undefined}
                disabled={!playable}
                title={
                  playable
                    ? `Play ${label}`
                    : canPlayCards
                      ? 'Only a Knight may be played before you roll'
                      : 'Cannot play right now'
                }
              />
            );
          })}
          {player.devCards.boughtThisTurn.map((c, i) => (
            <DevCardChip
              key={`bt-${i}`}
              card={c}
              disabled
              title={`Just bought — playable next turn`}
            />
          ))}
          {player.devCards.victoryPoints > 0 && (
            <DevCardChip
              card="victoryPoint"
              count={player.devCards.victoryPoints}
              title="Hidden victory point (counts at game end)"
            />
          )}
          {!hasAnyCards && <span className="hand-empty">no dev cards</span>}
        </div>
      </div>
      )}
    </section>
  );
}
