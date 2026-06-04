import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { canPlaceWagon } from '@/game/modules/traders/merchantTrains/placement';
import type { EdgeId } from '@/game/types';

// Dialog used during the Merchant Trains end-of-turn voting phase. Each
// player gets a turn to submit a bid (wool / wheat) or pass; once everyone
// has spoken, the engine auto-resolves and either places the wagon
// directly or transitions to the placeWagon phase for the winning placer.
//
// In hot-seat solo we render this for the currently-acting "viewer" — the
// last-acknowledged human, falling back to whichever seat the handoff
// system would surface. In online we render for the local seat. In both
// cases the dialog disables itself if the local seat has already
// submitted.
export function WagonVoteDialog() {
  const { game, dispatch, handoffAcknowledgedForPlayer } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  const [woolBid, setWoolBid] = useState(0);
  const [wheatBid, setWheatBid] = useState(0);
  const [target, setTarget] = useState<EdgeId | null>(null);
  if (!game || game.phase !== 'wagonVoting' || !game.wagonVote) return null;

  // Pick whose seat the dialog represents. Spectators see nothing.
  let viewerId: string | null = null;
  if (role === 'spectator') return null;
  if (role === 'solo') {
    // Find any human who hasn't bid yet — preferring the last-acked one.
    const candidates = game.players.filter(
      (p) => !p.isAI && !game.wagonVote!.bids[p.id],
    );
    viewerId =
      candidates.find((p) => p.id === handoffAcknowledgedForPlayer)?.id ??
      candidates[0]?.id ??
      null;
  } else {
    viewerId = getMyPlayerId(game);
  }
  if (!viewerId) return null;
  const viewer = game.players.find((p) => p.id === viewerId);
  if (!viewer) return null;
  // Already submitted? Show a wait-state.
  const alreadyBid = !!game.wagonVote.bids[viewerId];

  // Legal targets — every edge that canPlaceWagon accepts. Computed once
  // per dialog mount; the list doesn't change mid-voting.
  const legalEdges = useMemo<EdgeId[]>(
    () =>
      game.board.edgeIds.filter((eid) => canPlaceWagon(game, eid)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.board.edgeIds.length, game.wagons?.length, game.wateringHoleHexId],
  );

  if (alreadyBid) {
    const need = game.players.length - Object.keys(game.wagonVote.bids).length;
    return (
      <DialogShell title="Vote submitted" onClose={() => {}}>
        <p style={{ margin: 0, color: 'var(--text-soft)' }}>
          Waiting for {need} other {need === 1 ? 'player' : 'players'} to vote…
        </p>
      </DialogShell>
    );
  }

  const wool = viewer.resources.sheep;
  const wheat = viewer.resources.wheat;
  const totalBid = woolBid + wheatBid;
  const isAbstain = totalBid === 0;
  const acquirer = game.players.find(
    (p) => p.id === game.wagonVote!.acquirerId,
  );

  const submit = () => {
    if (isAbstain) {
      dispatch({
        type: 'submitWagonVote',
        playerId: viewerId,
        cards: {},
        target: null,
      });
      return;
    }
    if (!target) return;
    dispatch({
      type: 'submitWagonVote',
      playerId: viewerId,
      cards: { sheep: woolBid, wheat: wheatBid },
      target,
    });
  };

  return (
    <DialogShell
      title={`Wagon vote — ${acquirer?.name ?? 'someone'} built this turn`}
      onClose={() => {}}
      footer={
        <>
          <Button
            onClick={() => {
              setWoolBid(0);
              setWheatBid(0);
              setTarget(null);
              dispatch({
                type: 'submitWagonVote',
                playerId: viewerId,
                cards: {},
                target: null,
              });
            }}
          >
            Pass
          </Button>
          <Button
            variant="primary"
            disabled={isAbstain || !target}
            onClick={submit}
          >
            Bid {totalBid}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Bid wool and/or wheat to direct the wagon. Bids are forfeit to the
        supply regardless of outcome.
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <ResourceChip resource="sheep" count={wool} />
        <Button
          size="sm"
          disabled={woolBid <= 0}
          onClick={() => setWoolBid((n) => Math.max(0, n - 1))}
        >
          −
        </Button>
        <span style={{ alignSelf: 'center' }}>{woolBid}</span>
        <Button
          size="sm"
          disabled={woolBid >= wool}
          onClick={() => setWoolBid((n) => Math.min(wool, n + 1))}
        >
          +
        </Button>
        <span style={{ width: 16 }} />
        <ResourceChip resource="wheat" count={wheat} />
        <Button
          size="sm"
          disabled={wheatBid <= 0}
          onClick={() => setWheatBid((n) => Math.max(0, n - 1))}
        >
          −
        </Button>
        <span style={{ alignSelf: 'center' }}>{wheatBid}</span>
        <Button
          size="sm"
          disabled={wheatBid >= wheat}
          onClick={() => setWheatBid((n) => Math.min(wheat, n + 1))}
        >
          +
        </Button>
      </div>
      {totalBid > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: '0.85em',
              color: 'var(--text-soft)',
              marginBottom: 4,
            }}
          >
            Target edge — {legalEdges.length} legal placement
            {legalEdges.length === 1 ? '' : 's'} available
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              maxHeight: 140,
              overflow: 'auto',
            }}
          >
            {legalEdges.map((eid, i) => (
              <Button
                key={eid}
                size="sm"
                variant={target === eid ? 'primary' : 'secondary'}
                onClick={() => setTarget(eid)}
              >
                Edge #{i + 1}
              </Button>
            ))}
          </div>
          {!target && (
            <p
              style={{
                color: '#c83e3e',
                marginTop: 6,
                marginBottom: 0,
                fontSize: '0.85em',
              }}
            >
              Pick a target edge to bid.
            </p>
          )}
        </div>
      )}
    </DialogShell>
  );
}
