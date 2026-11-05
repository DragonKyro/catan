import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import { calculateMerchantTrainsVp } from '@/game/modules/traders/scoring/merchantTrains';
import { legalWagonPlacements, placementLabel } from '@/game/modules/traders/merchantTrains/trains';
import { votesOf } from '@/game/modules/traders/merchantTrains/voting';

const DECIDED: Record<string, string> = {
  majority: 'majority',
  location: 'most votes',
  mostVotes: 'biggest bidder',
  activePlayer: 'active player',
  noVotes: 'no bids',
  onlyOption: 'only spot',
};

// Scenario tab: Merchant Trains — the trains on the board, the wagon
// supply, who scores from wagons, and the current / last voting round.
export function MerchantTrainsBlock({ game }: { game: GameState }) {
  const trains = game.merchantTrains ?? [];
  const wagons = game.wagons ?? [];
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? id;
  const vote = game.wagonVote;
  const last = game.lastWagonVote;
  return (
    <div className="scenario-panel-block">
      <div className="scenario-panel-block-head">
        <span>Merchant Trains</span>
        <span className="scenario-panel-block-sum">
          {wagons.length} placed · {game.wagonSupply ?? 0} in supply · {legalWagonPlacements(game).length} open spots
        </span>
      </div>
      <ul className="scenario-panel-chips">
        {trains.length === 0 && (
          <li className="scenario-panel-chip">
            <span className="scenario-panel-chip-name unclaimed">No trains yet — three start points at the watering hole</span>
          </li>
        )}
        {trains.map((t) => {
          const n = wagons.filter((w) => w.train === t.id).length;
          const status = t.mergedInto
            ? `merged into ${t.mergedInto}`
            : t.ended
              ? 'ended'
              : 'running';
          return (
            <li key={t.id} className={`scenario-panel-chip${t.ended ? '' : ' is-claimed'}`}>
              <span className="scenario-panel-chip-vp">🚂 {t.id}</span>
              <span className="scenario-panel-chip-name">
                {n} wagon{n === 1 ? '' : 's'} · {status}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="scenario-panel-chips">
        {game.players.map((p) => {
          const vp = calculateMerchantTrainsVp(game, p.id);
          return (
            <li key={p.id} className={`scenario-panel-chip${vp > 0 ? ' is-claimed' : ''}`}>
              <span className="scenario-panel-chip-vp">+{vp}</span>
              <span className="scenario-panel-chip-swatch" style={{ background: playerColorVar(p.color) }} aria-hidden />
              <span className="scenario-panel-chip-name">{p.name} (buildings between 2 wagons)</span>
            </li>
          );
        })}
      </ul>
      {vote && (
        <div className="scenario-panel-note">
          <strong>Voting now</strong> ({name(vote.acquirerId)}'s wagon):{' '}
          {vote.order
            .map((id) => {
              const bid = vote.bids[id];
              if (!bid) return `${name(id)} …`;
              return votesOf(bid) === 0 ? `${name(id)} passed` : `${name(id)} ${votesOf(bid)}`;
            })
            .join(' · ')}
        </div>
      )}
      {last && !vote && (
        <div className="scenario-panel-note">
          Last wagon: {placementLabel(game, last.placement).replace(/^new train/, 'started a train')} —{' '}
          {DECIDED[last.decidedBy]}
          {last.chooser ? ` (${name(last.chooser)})` : ''}
          {Object.values(last.bids).some((b) => votesOf(b) > 0) &&
            `; bids ${Object.entries(last.bids)
              .filter(([, b]) => votesOf(b) > 0)
              .map(([id, b]) => `${name(id)} ${votesOf(b)}`)
              .join(', ')}`}
        </div>
      )}
      <div className="scenario-panel-note">
        Build a settlement or city to collect a wagon (one a turn). At the end of your turn
        everyone bids wool / wheat, starting with you: more than half the votes chooses the spot;
        otherwise votes go to spots. A wagon on a road counts as an extra road for the Longest
        Route; a building between two wagons is worth +1 VP.
      </div>
    </div>
  );
}
