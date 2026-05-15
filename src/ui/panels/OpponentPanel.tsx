import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { totalResources } from '@/game/resources';
import './OpponentPanel.css';

const PLAYER_COLOR_CSS: Record<string, string> = {
  red: 'var(--player-red)',
  blue: 'var(--player-blue)',
  orange: 'var(--player-orange)',
  white: 'var(--player-white)',
};

export function OpponentPanel() {
  const game = useGameStore((s) => s.game!);
  const role = useNetworkStore((s) => s.role);
  const onlineUuids = useNetworkStore((s) => s.onlineUuids);
  const uuidForPlayer = useNetworkStore((s) => s.uuidForPlayer);

  // Choose which players to show as "opponents" (i.e., not in HandPanel).
  // - solo: everyone except the acting player.
  // - online player: everyone except me.
  // - spectator: everyone.
  let hiddenId: string | null = null;
  if (role === 'solo') hiddenId = getActingPlayerId(game);
  else if (role === 'guest' || role === 'host') hiddenId = getMyPlayerId(game);

  const opponents = game.players.filter((p) => p.id !== hiddenId);
  const actingId = getActingPlayerId(game);

  return (
    <section className="opps">
      {opponents.map((p) => {
        const visibleVp = calculateVictoryPoints(game, p.id, false);
        const cards = p.devCards.unplayed.length + p.devCards.boughtThisTurn.length;
        const isActing = p.id === actingId;
        const uuid = uuidForPlayer(p.id);
        const onlineStatus: 'na' | 'online' | 'offline' =
          role === 'solo' || p.isAI
            ? 'na'
            : uuid && onlineUuids.has(uuid)
              ? 'online'
              : 'offline';
        return (
          <div key={p.id} className={`opp ${isActing ? 'opp-acting' : ''}`}>
            <div className="opp-head">
              <span
                className="opp-swatch"
                style={{ background: PLAYER_COLOR_CSS[p.color] }}
              />
              <span className="opp-name">
                {p.name}
                {p.isAI && <span className="opp-tag">AI</span>}
                {onlineStatus !== 'na' && (
                  <span className={`opp-dot ${onlineStatus}`} />
                )}
              </span>
              <span className="opp-vp" title="Visible VP">{visibleVp}+ VP</span>
            </div>
            <div className="opp-stats">
              <span title="Resource cards">🂠 {totalResources(p.resources)}</span>
              <span title="Dev cards (face down)">🂡 {cards}</span>
              <span title="Knights played">⚔️ {p.devCards.playedKnights}</span>
              <span title="Roads">🛣️ {p.roads.length}</span>
              {p.hasLongestRoad && <span title="Longest Road">★ Road</span>}
              {p.hasLargestArmy && <span title="Largest Army">★ Army</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
