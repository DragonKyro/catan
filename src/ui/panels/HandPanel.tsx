import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { RESOURCES, COMMODITIES } from '@/game/types';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import { DevCardChip, DEV_LABEL } from '@/ui/shared/DevCardChip';
import { calculateVictoryPoints, calculateIslandChipVp } from '@/game/scoring/points';
import { playerColorVar } from '@/ui/shared/playerColors';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { FISH_TOKEN_VALUE } from '@/game/modules/traders/constants';
import './HandPanel.css';

function fishHandTooltip(tokens: Array<'one' | 'two' | 'three'>): string {
  const counts = { one: 0, two: 0, three: 0 };
  for (const t of tokens) counts[t]++;
  const total = tokens.reduce(
    (s, t) => s + (FISH_TOKEN_VALUE[t] ?? 0),
    0,
  );
  return `Fish tokens: ${counts.one}×1 + ${counts.two}×2 + ${counts.three}×3 = ${total} fish total`;
}

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
            <span className="hand-flag" title="Longest Road (+2 VP)">🛣️</span>
          )}
          {player.hasLargestArmy && (
            <span className="hand-flag" title="Largest Army (+2 VP)">⚔️</span>
          )}
          {(() => {
            const chipVp = calculateIslandChipVp(game, player.id);
            return chipVp > 0 ? (
              <span
                className="hand-flag"
                title={`Outer-island settlement bonuses (+${chipVp} VP)`}
              >
                🏝 +{chipVp}
              </span>
            ) : null;
          })()}
          {player.cloth && player.cloth > 0 && (
            <span
              className="hand-flag"
              title={`Cloth tokens — ${player.cloth} cloth = ${Math.floor(player.cloth / 2)} VP`}
            >
              🧵 {player.cloth}
            </span>
          )}
          {(player.cityWalls ?? 0) > 0 && (
            <span
              className="hand-flag"
              title={`City walls (+${(player.cityWalls ?? 0) * 2} to 7-roll hand limit)`}
            >
              🧱 {player.cityWalls}
            </span>
          )}
          {(player.gold ?? 0) > 0 && (
            <span
              className="hand-flag"
              title={`Gold — ${player.gold} coins. Spend 2 gold for any resource (max 2× per turn).`}
            >
              🪙 {player.gold}
            </span>
          )}
          {game.wealthTiles?.wealthiest === player.id && (
            <span className="hand-flag" title="Wealthiest Catanian (+1 VP)">
              👑
            </span>
          )}
          {game.wealthTiles?.poor.includes(player.id) && (
            <span className="hand-flag" title="Poor Catanian (-2 VP)">
              👜
            </span>
          )}
          {game.strongestPorts?.holder === player.id && (
            <span className="hand-flag" title="Strongest Ports (+2 VP)">
              ⚓
            </span>
          )}
          {(player.fishTokens?.length ?? 0) > 0 && (
            <span
              className="hand-flag"
              title={fishHandTooltip(player.fishTokens ?? [])}
            >
              🐟 {player.fishTokens!.length}
            </span>
          )}
          {game.oldBootHolder === player.id && (
            <span
              className="hand-flag"
              title="Old boot — you need +1 VP to win. Pass it during your turn to anyone with ≥ your VPs."
            >
              👢
            </span>
          )}
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

      {game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID) && (
        <div className="hand-commodities">
          {COMMODITIES.map((c) => {
            const n = player.commodities?.[c] ?? 0;
            return (
              <CommodityChip
                key={c}
                commodity={c}
                count={n}
                dimmed={n === 0}
              />
            );
          })}
        </div>
      )}

      <div className="hand-section">
        <div className="hand-cards">
          {Object.entries(cardCounts).map(([card, count]) => (
            <DevCardChip
              key={card}
              card={card as never}
              count={count}
              onClick={canPlayCards ? () => onPlay(card) : undefined}
              disabled={!canPlayCards}
              title={
                canPlayCards
                  ? `Play ${DEV_LABEL[card as keyof typeof DEV_LABEL]}`
                  : 'Cannot play right now'
              }
            />
          ))}
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
    </section>
  );
}
