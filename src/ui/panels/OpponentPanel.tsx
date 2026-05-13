import { useGameStore, getActingPlayerId } from '@/store/gameStore';
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
  const acting = getActingPlayerId(game);
  const opponents = game.players.filter((p) => p.id !== acting);
  return (
    <section className="opps">
      {opponents.map((p) => {
        // Opponents' VP excludes hidden VP cards.
        const visibleVp = calculateVictoryPoints(game, p.id, false);
        const cards = p.devCards.unplayed.length + p.devCards.boughtThisTurn.length;
        return (
          <div key={p.id} className="opp">
            <div className="opp-head">
              <span
                className="opp-swatch"
                style={{ background: PLAYER_COLOR_CSS[p.color] }}
              />
              <span className="opp-name">{p.name}</span>
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
