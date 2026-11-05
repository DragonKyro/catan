import { useState, type ReactNode } from 'react';
import type { GameState, PlayerId } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { useCanAct } from '@/ui/shared/useCanAct';
import { playerColorVar } from '@/ui/shared/playerColors';
import { voteBidders, votesOf } from '@/game/modules/traders/merchantTrains/voting';
import { legalWagonPlacements } from '@/game/modules/traders/merchantTrains/trains';
import { tagOf } from '@/ui/game/traders/WagonSpots';
import './WagonVoteDialog.css';

// Merchant Trains voting round (end of a turn in which the active player
// built a settlement or city). Everyone sees the public bids as they come
// in; the seat whose turn it is gets the controls:
//   - bid stage: lay wool / wheat face up, or pass;
//   - assign stage (no absolute majority): click a lettered spot on the
//     board to give all your votes to it;
//   - placement: the chosen player clicks the spot for the wagon.
// The lettered spots on the board are drawn by WagonSpots.
export function WagonVoteDialog() {
  const { game, dispatch } = useGameStore();
  const [wool, setWool] = useState(0);
  const [wheat, setWheat] = useState(0);
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || !acting) return null;
  const vote = game.wagonVote;
  if (!vote || (game.phase !== 'wagonVoting' && game.phase !== 'placeWagon')) return null;
  const name = (id: PlayerId) => game.players.find((p) => p.id === id)?.name ?? id;
  const me = game.players.find((p) => p.id === acting)!;
  const spots = legalWagonPlacements(game).length;
  const total = vote.order.reduce((n, id) => n + votesOf(vote.bids[id]), 0);

  let prompt: string;
  let controls: ReactNode = null;
  if (game.phase === 'placeWagon') {
    const why = placeReason(game);
    prompt = canAct
      ? `${why} You choose: click a lettered spot on the board for the wagon.`
      : `${why} ${name(acting)} chooses where the wagon goes…`;
  } else if (vote.stage === 'bid') {
    if (canAct) {
      prompt =
        'Bid wool / wheat face up (1 card = 1 vote) or pass. More than half of all votes chooses the lettered spot; bids go to the supply.';
      const n = wool + wheat;
      controls = (
        <div className="wagonvote-bid">
          <Stepper label="sheep" have={me.resources.sheep} value={wool} onChange={setWool} />
          <Stepper label="wheat" have={me.resources.wheat} value={wheat} onChange={setWheat} />
          <div className="wagonvote-bid-buttons">
            <Button
              onClick={() => {
                setWool(0);
                setWheat(0);
                dispatch({ type: 'submitWagonVote', playerId: acting, cards: {} });
              }}
            >
              Pass
            </Button>
            <Button
              variant="primary"
              disabled={n === 0}
              onClick={() => {
                setWool(0);
                setWheat(0);
                dispatch({ type: 'submitWagonVote', playerId: acting, cards: { sheep: wool, wheat } });
              }}
            >
              Bid {n} {n === 1 ? 'vote' : 'votes'}
            </Button>
          </div>
        </div>
      );
    } else {
      prompt = `${name(acting)} is bidding…`;
    }
  } else {
    prompt = canAct
      ? `No one has a majority. Give your ${votesOf(vote.bids[acting])} vote(s) to one spot: click a lettered wagon on the board.`
      : `No majority — ${name(acting)} is assigning their votes…`;
  }

  return (
    <DialogShell title={`Wagon vote — ${name(vote.acquirerId)} collected a wagon`} blocking>
      <p className="wagonvote-prompt">{prompt}</p>
      <ul className="wagonvote-bids">
        {vote.order.map((id, i) => {
          const bid = vote.bids[id];
          const p = game.players.find((x) => x.id === id)!;
          const isTurn = game.phase === 'wagonVoting' && id === acting;
          const loc = vote.assignments[id];
          return (
            <li key={id} className={`wagonvote-pill${isTurn ? ' is-turn' : ''}`}>
              <span className="wagonvote-dot" style={{ background: playerColorVar(p.color) }} />
              <span className="wagonvote-name">
                {p.name}
                {i === 0 ? ' ★' : ''}
              </span>
              {bid === undefined ? (
                <span className="wagonvote-soft">{isTurn ? '…' : '—'}</span>
              ) : votesOf(bid) === 0 ? (
                <span className="wagonvote-soft">pass</span>
              ) : (
                <>
                  {bid.sheep > 0 && <ResourceChip resource="sheep" count={bid.sheep} size="sm" />}
                  {bid.wheat > 0 && <ResourceChip resource="wheat" count={bid.wheat} size="sm" />}
                </>
              )}
              {loc && <span className="wagonvote-tag">→ {tagOf(game, loc)}</span>}
            </li>
          );
        })}
      </ul>
      <p className="wagonvote-soft wagonvote-foot">
        ★ active player · {total} vote{total === 1 ? '' : 's'} so far · {spots} lettered spot{spots === 1 ? '' : 's'} on the board
        {vote.stage === 'assign' && ` · ${voteBidders(vote).length} bidders assign`}
      </p>
      {controls}
    </DialogShell>
  );
}

function placeReason(game: GameState): string {
  const pending = game.pendingWagonPlacement;
  switch (pending?.reason) {
    case 'majority':
      return 'Majority of the votes.';
    case 'mostVotes':
      return 'No spot had the most votes; the biggest bidder chooses.';
    case 'noVotes':
      return 'Nobody bid, so the active player chooses.';
    default:
      return 'Tied votes, so the active player chooses.';
  }
}

function Stepper({
  label,
  have,
  value,
  onChange,
}: {
  label: 'sheep' | 'wheat';
  have: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="wagonvote-stepper">
      <ResourceChip resource={label} count={have} size="sm" dimmed={have === 0} />
      <Button size="sm" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </Button>
      <span className="wagonvote-count">{value}</span>
      <Button size="sm" disabled={value >= have} onClick={() => onChange(Math.min(have, value + 1))}>
        +
      </Button>
    </div>
  );
}
