import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { RESOURCES } from '@/game/types';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { DevCardChip, DEV_LABEL } from '@/ui/shared/DevCardChip';
import { Button } from '@/ui/shared/Button';
import { calculateVictoryPoints } from '@/game/scoring/points';
import './HandPanel.css';

export function HandPanel() {
  const { game, dispatch, openDialog, uiMode, setMode } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  if (!game) return null;

  // Whose hand do we display?
  // - solo: the acting player (rotates through hot-seat).
  // - online player: always the local seat (us).
  // - spectator: no hand visible.
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

  let viewedId: string;
  if (role === 'solo') {
    viewedId = getActingPlayerId(game);
  } else {
    const myPid = getMyPlayerId(game);
    if (!myPid) return null;
    viewedId = myPid;
  }
  const player = game.players.find((p) => p.id === viewedId)!;
  const acting = getActingPlayerId(game);
  const isMyTurn = viewedId === acting;
  // In solo mode, when we're viewing an AI's turn, treat their cards as
  // private — show counts but not the actual resources or dev card types.
  const hideAICards = role === 'solo' && player.isAI;
  // Card-playing is allowed only when it's our turn AND we're not an AI being
  // watched in solo mode (AI cards aren't human-clickable).
  const canPlayCards =
    !player.isAI &&
    isMyTurn &&
    (game.phase === 'main' || game.phase === 'rollOrPlayKnight') &&
    !game.hasPlayedDevCardThisTurn &&
    uiMode.kind === 'idle';
  // For visible VP, when hiding AI cards we omit hidden VPs (treat like an
  // opponent) so the player doesn't get extra info by glancing at the hand.
  const vp = calculateVictoryPoints(game, player.id, !hideAICards);

  const cardCounts: Record<string, number> = {};
  for (const c of player.devCards.unplayed) {
    cardCounts[c] = (cardCounts[c] ?? 0) + 1;
  }

  let totalResources = 0;
  for (const r of RESOURCES) totalResources += player.resources[r];
  const totalDevCards =
    player.devCards.unplayed.length + player.devCards.boughtThisTurn.length;

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
        <h3>
          {role === 'solo' ? (player.isAI ? `${player.name}'s hand` : 'Your hand') : 'Your hand'}
        </h3>
        <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          {player.isAI && <span className="hand-ai">AI</span>}
          <span className="hand-vp" title="Victory points">{vp} VP</span>
        </span>
      </header>

      {hideAICards ? (
        <div className="hand-resources hand-hidden" title="AI hand — face-down">
          <span className="hand-facedown">
            <span className="hand-facedown-icon" aria-hidden>🂠</span>
            <span className="hand-facedown-count">{totalResources}</span>
            <span className="hand-facedown-label">resources</span>
          </span>
        </div>
      ) : (
        <div className="hand-resources">
          {RESOURCES.map((r) => (
            <ResourceChip key={r} resource={r} count={player.resources[r]} dimmed={player.resources[r] === 0} />
          ))}
        </div>
      )}

      <div className="hand-section">
        <div className="hand-section-label">Development cards</div>
        <div className="hand-cards">
          {hideAICards ? (
            totalDevCards > 0 ? (
              <span className="hand-facedown">
                <span className="hand-facedown-icon" aria-hidden>🂡</span>
                <span className="hand-facedown-count">{totalDevCards}</span>
                <span className="hand-facedown-label">cards</span>
              </span>
            ) : (
              <span className="hand-empty">No development cards</span>
            )
          ) : (
            <>
              {Object.entries(cardCounts).map(([card, count]) => (
                <DevCardChip
                  key={card}
                  card={card as never}
                  count={count}
                  onClick={canPlayCards ? () => onPlay(card) : undefined}
                  disabled={!canPlayCards}
                  title={canPlayCards ? `Play ${DEV_LABEL[card as keyof typeof DEV_LABEL]}` : 'Cannot play right now'}
                />
              ))}
              {player.devCards.boughtThisTurn.map((c, i) => (
                <DevCardChip key={`bt-${i}`} card={c} faceDown title="Bought this turn — playable next turn" />
              ))}
              {player.devCards.victoryPoints > 0 && (
                <DevCardChip
                  card="victoryPoint"
                  count={player.devCards.victoryPoints}
                  title="Hidden victory point (counts at game end)"
                />
              )}
              {Object.keys(cardCounts).length === 0 &&
                player.devCards.boughtThisTurn.length === 0 &&
                player.devCards.victoryPoints === 0 && (
                  <span className="hand-empty">No development cards</span>
                )}
            </>
          )}
        </div>
      </div>

      <div className="hand-flags">
        {player.hasLongestRoad && (
          <Button variant="ghost" size="sm" title="Longest Road bonus (+2 VP)">
            🛣️ Longest Road
          </Button>
        )}
        {player.hasLargestArmy && (
          <Button variant="ghost" size="sm" title="Largest Army bonus (+2 VP)">
            ⚔️ Largest Army
          </Button>
        )}
      </div>
    </section>
  );
}
