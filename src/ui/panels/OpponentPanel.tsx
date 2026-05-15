import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { totalResources } from '@/game/resources';
import { playerColorVar } from '@/ui/shared/playerColors';
import './OpponentPanel.css';

export function OpponentPanel() {
  const game = useGameStore((s) => s.game!);
  const role = useNetworkStore((s) => s.role);
  const onlineUuids = useNetworkStore((s) => s.onlineUuids);
  const uuidForPlayer = useNetworkStore((s) => s.uuidForPlayer);

  // The right-panel player list shows EVERY player so the active-turn
  // highlight has a place to land (the local player's full hand still lives
  // in the bottom strip — this is just a status row).
  const opponents = game.players;
  const actingId = getActingPlayerId(game);

  // Mark "you" so the player can find themselves quickly. In solo mode we
  // call out the device-bound human; online uses the local seat.
  let localId: string | null = null;
  if (role === 'solo') {
    localId =
      game.players.find((p) => !p.isAI)?.id ?? null;
  } else if (role === 'guest' || role === 'host') {
    localId = getMyPlayerId(game);
  }

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
                style={{ background: playerColorVar(p.color) }}
              />
              <span className="opp-name">
                {p.name}
                {p.id === localId && <span className="opp-tag">YOU</span>}
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
