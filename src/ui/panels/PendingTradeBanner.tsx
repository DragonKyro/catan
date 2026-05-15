import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { RESOURCES } from '@/game/types';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { Button } from '@/ui/shared/Button';
import { playerColorVar } from '@/ui/shared/playerColors';
import './PendingTradeBanner.css';

export function PendingTradeBanner() {
  const { game, dispatch, openDialog } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  if (!game?.pendingTrade) return null;
  const trade = game.pendingTrade;
  const proposer = game.players.find((p) => p.id === trade.proposerId)!;
  const acting = getActingPlayerId(game);
  const currentTurnId = game.playerOrder[game.currentPlayerIndex]!;

  // Who can press the human-facing buttons (accept/counter/reject)?
  // - solo: when a human is acting it's that human. When an AI is acting (so
  //   the AI is the proposer or current player), find any non-AI seat and
  //   let them respond — otherwise the banner is button-less and the player
  //   has no way to accept the offer.
  // - online: always our fixed seat.
  let viewerId: string | null = null;
  if (role === 'solo') {
    const actingPlayer = game.players.find((p) => p.id === acting);
    if (actingPlayer && !actingPlayer.isAI) {
      viewerId = acting;
    } else {
      viewerId = game.players.find((p) => !p.isAI)?.id ?? null;
    }
  } else {
    viewerId = getMyPlayerId(game);
  }
  const viewer = viewerId ? game.players.find((p) => p.id === viewerId) : null;

  const hasResources = (
    p: { resources: typeof proposer.resources },
    bank: typeof trade.receive,
  ): boolean => {
    for (const r of RESOURCES) {
      if ((bank[r] ?? 0) > p.resources[r]) return false;
    }
    return true;
  };

  const isProposer = viewerId === trade.proposerId;
  const isCurrent = viewerId === currentTurnId;
  // It's a counter if the proposer of the current pendingTrade isn't the
  // active turn player. In that case the original proposer (current turn
  // player) may accept or cancel.
  const isCounter = trade.proposerId !== currentTurnId;
  const canViewerAccept =
    !!viewer && !isProposer && hasResources(viewer, trade.receive);
  const canViewerCounter =
    !!viewer && !viewer.isAI && !isProposer && !isCounter && isCurrent === false;
  const viewerHasRejected = viewerId
    ? trade.rejectedBy.includes(viewerId)
    : false;

  // List of opponents to display as "responder dots" — everyone except the
  // proposer.
  const responders = game.players.filter((p) => p.id !== trade.proposerId);

  return (
    <div className="ptbanner">
      <div className="ptbanner-row">
        <span
          className="ptbanner-swatch"
          style={{ background: playerColorVar(proposer.color) }}
        />
        <strong>{proposer.name}</strong>
        <span style={{ color: 'var(--text-soft)' }}>
          {isCounter ? 'counters with' : 'offers'}
        </span>
        <span className="ptbanner-baskets">
          <span className="ptbanner-basket">
            {RESOURCES.filter((r) => (trade.give[r] ?? 0) > 0).map((r) => (
              <ResourceChip key={r} resource={r} count={trade.give[r]} size="sm" />
            ))}
          </span>
          <span style={{ color: 'var(--text-soft)' }}>→</span>
          <span className="ptbanner-basket">
            {RESOURCES.filter((r) => (trade.receive[r] ?? 0) > 0).map((r) => (
              <ResourceChip key={r} resource={r} count={trade.receive[r]} size="sm" />
            ))}
          </span>
        </span>
      </div>

      {responders.length > 0 && (
        <div className="ptbanner-row ptbanner-responders">
          {responders.map((p) => {
            const rejected = trade.rejectedBy.includes(p.id);
            const can = hasResources(p, trade.receive);
            return (
              <span
                key={p.id}
                className={`ptbanner-responder ${rejected ? 'is-rejected' : ''}`}
                title={
                  rejected
                    ? `${p.name} rejected`
                    : can
                      ? `${p.name} could accept`
                      : `${p.name} can't (insufficient resources)`
                }
              >
                <span
                  className="ptbanner-responder-dot"
                  style={{ background: playerColorVar(p.color) }}
                />
                <span className="ptbanner-responder-name">{p.name}</span>
                {rejected && <span className="ptbanner-responder-mark">✗</span>}
              </span>
            );
          })}
        </div>
      )}

      <div className="ptbanner-row ptbanner-actions">
        {isProposer && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => dispatch({ type: 'cancelTrade', playerId: proposer.id })}
          >
            Cancel
          </Button>
        )}
        {!isProposer && viewer && !viewer.isAI && (
          <>
            <Button
              size="sm"
              variant={canViewerAccept ? 'primary' : 'secondary'}
              disabled={!canViewerAccept}
              onClick={() => dispatch({ type: 'acceptTrade', playerId: viewer.id })}
              title={canViewerAccept ? 'Accept this offer' : "You don't have the resources"}
            >
              Accept
            </Button>
            {canViewerCounter && (
              <Button size="sm" onClick={() => openDialog('playerTrade')}>
                Counter
              </Button>
            )}
            {!isCurrent && !viewerHasRejected && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => dispatch({ type: 'rejectTrade', playerId: viewer.id })}
              >
                Reject
              </Button>
            )}
            {isCurrent && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => dispatch({ type: 'cancelTrade', playerId: viewer.id })}
              >
                Walk away
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
