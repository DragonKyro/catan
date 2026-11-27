import { useLayoutEffect, type ReactNode } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import type { CommodityBank, CounterOffer, Player, ResourceBank } from '@/game/types';
import { hasAnsweredTrade } from '@/game/actions/trade';
import { COMMODITIES, RESOURCES } from '@/game/types';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { CoinIcon } from '@/ui/game/traders/TradersIcons';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import { Button } from '@/ui/shared/Button';
import { TradeLane } from '@/ui/shared/TradeLane';
import { playerColorVar } from '@/ui/shared/playerColors';
import './PendingTradeBanner.css';

export function PendingTradeBanner() {
  const { game, dispatch, openCounterDialog } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  // Auto-reject for any human seat that can't fulfill the trade's ask.
  // Cuts down on the AI's wait time on a trade no one can accept anyway,
  // and removes the "disabled Accept button" confusion.
  //
  // Runs as a useLayoutEffect so the rejection is dispatched synchronously
  // before AIDriver's evaluator useEffect inspects state. That way the
  // AI's "is any human still a possible responder?" check sees the
  // post-rejection state and can skip the fairness wait.
  useLayoutEffect(() => {
    if (!game?.pendingTrade) return;
    const t = game.pendingTrade;
    for (const p of game.players) {
      if (p.id === t.proposerId) continue;
      if (p.isAI) continue; // AIs handle themselves
      if (hasAnsweredTrade(t, p.id)) continue;
      // T&B coins: the gold asked for counts like a card.
      let canAccept = (t.receiveGold ?? 0) <= (p.gold ?? 0);
      for (const r of RESOURCES) {
        if ((t.receive[r] ?? 0) > p.resources[r]) {
          canAccept = false;
          break;
        }
      }
      // Cities & Knights: commodities asked for too.
      if (!holdsCommodities(p, t.receiveCommodities)) canAccept = false;
      if (!canAccept) {
        dispatch({ type: 'rejectTrade', playerId: p.id });
      }
    }
  }, [
    game?.pendingTrade,
    game?.players,
    dispatch,
  ]);

  if (!game?.pendingTrade) return null;
  const trade = game.pendingTrade;
  const proposer = game.players.find((p) => p.id === trade.proposerId)!;
  const acting = getActingPlayerId(game);
  const counters = trade.counters ?? [];
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? id;
  const colorOf = (id: string) => {
    const p = game.players.find((x) => x.id === id);
    return p ? playerColorVar(p.color) : undefined;
  };

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

  const hasResources = (p: Player, bank: typeof trade.receive): boolean => {
    if ((trade.receiveGold ?? 0) > (p.gold ?? 0)) return false;
    for (const r of RESOURCES) {
      if ((bank[r] ?? 0) > p.resources[r]) return false;
    }
    return holdsCommodities(p, bank === trade.receive ? trade.receiveCommodities : undefined);
  };

  const isProposer = viewerId === trade.proposerId;
  const canViewerAccept =
    !!viewer && !isProposer && hasResources(viewer, trade.receive);
  const canViewerCounter = !!viewer && !viewer.isAI && !isProposer;
  const viewerHasRejected = viewerId
    ? trade.rejectedBy.includes(viewerId)
    : false;
  const viewerCounter = viewerId ? counters.find((c) => c.by === viewerId) : undefined;
  // Can the proposer pay what a counter-offer asks for?
  const proposerCanPay = (c: CounterOffer) =>
    RESOURCES.every((r) => (c.receive[r] ?? 0) <= proposer.resources[r])
    && (c.receiveGold ?? 0) <= (proposer.gold ?? 0)
    && holdsCommodities(proposer, c.receiveCommodities);
  // Who said yes to the active player's offer: the proposer picks one of them.
  const accepted = trade.acceptedBy ?? [];
  const viewerHasAccepted = !!viewerId && accepted.includes(viewerId);
  const acceptors = accepted
    .map((id) => game.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  const waitingOn = game.players.filter((p) => p.id !== trade.proposerId && !hasAnsweredTrade(trade, p.id));

  // List of opponents to display as "responder dots" — everyone except the
  // proposer.
  const responders = game.players.filter((p) => p.id !== trade.proposerId);

  // The two sides of the offer, told from the viewer's seat: the proposer
  // reads their own offer, anyone else what taking it would mean for them.
  const offered = tradeCards(trade.give, trade.giveGold, trade.giveCommodities);
  const asked = tradeCards(trade.receive, trade.receiveGold, trade.receiveCommodities);
  const lanes = isProposer
    ? { title: 'Your offer', get: asked, give: offered, getLabel: 'You get', giveLabel: 'You give' }
    : viewer
      ? { title: `${proposer.name} offers you`, get: offered, give: asked, getLabel: 'You get', giveLabel: 'You give' }
      : { title: `${proposer.name} offers`, get: asked, give: offered, getLabel: `${proposer.name} gets`, giveLabel: `${proposer.name} gives` };

  return (
    <div className="ptbanner">
      <div className="ptbanner-row">
        <span
          className="ptbanner-swatch"
          style={{ background: playerColorVar(proposer.color) }}
        />
        <strong>{lanes.title}</strong>
      </div>
      <TradeLane side="get" label={lanes.getLabel} cards={lanes.get} />
      <TradeLane side="give" label={lanes.giveLabel} cards={lanes.give} />

      {responders.length > 0 && (
        <div className="ptbanner-row ptbanner-responders">
          {responders.map((p) => {
            const rejected = trade.rejectedBy.includes(p.id);
            const yes = accepted.includes(p.id);
            const countered = counters.some((c) => c.by === p.id);
            const can = hasResources(p, trade.receive);
            return (
              <span
                key={p.id}
                className={`ptbanner-responder ${rejected ? 'is-rejected' : ''} ${yes ? 'is-accepted' : ''}`}
                title={
                  rejected
                    ? `${p.name} rejected`
                    : yes
                      ? `${p.name} accepted`
                      : countered
                        ? `${p.name} made a counter-offer`
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
                {yes && <span className="ptbanner-responder-yes">✓</span>}
                {countered && <span className="ptbanner-responder-yes" aria-label="countered">↔</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Counter-offers sit beside the offer, which stays open to everyone. */}
      {counters.length > 0 && (
        <div className="ptbanner-counters">
          {counters.map((c) => {
            const theirs = tradeCards(c.give, c.giveGold, c.giveCommodities);
            const wants = tradeCards(c.receive, c.receiveGold, c.receiveCommodities);
            const mine = c.by === viewerId;
            return (
              <div key={c.by} className="ptbanner-counter">
                <span className="ptbanner-responder-dot" style={{ background: colorOf(c.by) }} />
                <span className="ptbanner-counter-who">{mine ? 'Your counter' : `${nameOf(c.by)} counters`}</span>
                {/* Told from the proposer's side when it's theirs to take. */}
                <span className="ptbanner-counter-terms">
                  {isProposer ? 'you get' : mine ? 'you give' : 'gives'} {theirs}
                  <span className="ptbanner-counter-sep">·</span>
                  {isProposer ? 'you give' : mine ? 'for' : 'wants'} {wants}
                </span>
                {isProposer && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!proposerCanPay(c)}
                    onClick={() => dispatch({ type: 'confirmTrade', playerId: proposer.id, with: c.by, counter: true })}
                    title={proposerCanPay(c) ? `Take ${nameOf(c.by)}'s counter-offer` : "You don't have what it asks for"}
                  >
                    Take
                  </Button>
                )}
                {mine && viewer && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => dispatch({ type: 'rejectTrade', playerId: viewer.id })}
                    title="Withdraw your counter-offer"
                  >
                    Take back
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="ptbanner-row ptbanner-actions">
        {isProposer && (
          <>
            {acceptors.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant="primary"
                onClick={() => dispatch({ type: 'confirmTrade', playerId: proposer.id, with: p.id })}
                title={`Trade with ${p.name}`}
              >
                <span className="ptbanner-responder-dot" style={{ background: playerColorVar(p.color) }} />
                Trade with {p.name}
              </Button>
            ))}
            {acceptors.length === 0 && counters.length === 0 && (
              <span className="ptbanner-note">Waiting for answers…</span>
            )}
            {(acceptors.length > 0 || counters.length > 0) && waitingOn.length > 0 && (
              <span className="ptbanner-note">
                {waitingOn.length === 1 ? `${waitingOn[0]!.name} hasn't answered` : `${waitingOn.length} haven't answered`}
              </span>
            )}
          </>
        )}
        {isProposer && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => dispatch({ type: 'cancelTrade', playerId: proposer.id })}
          >
            Cancel
          </Button>
        )}
        {!isProposer && viewer && !viewer.isAI && viewerHasAccepted && (
          <>
            <span className="ptbanner-note">You accepted — {proposer.name} picks who to trade with</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => dispatch({ type: 'rejectTrade', playerId: viewer.id })}
              title="Take your yes back"
            >
              Take back
            </Button>
          </>
        )}
        {!isProposer && viewer && !viewer.isAI && !viewerHasAccepted && (
          <>
            {viewerCounter && <span className="ptbanner-note">Or take the offer as it is:</span>}
            <Button
              size="sm"
              variant={canViewerAccept ? 'primary' : 'secondary'}
              disabled={!canViewerAccept}
              onClick={() => dispatch({ type: 'acceptTrade', playerId: viewer.id })}
              title={
                !canViewerAccept
                  ? "You don't have the resources"
                  : `Accept — ${proposer.name} then picks who to trade with`
              }
            >
              Accept
            </Button>
            {canViewerCounter && (
              <Button size="sm" onClick={() => openCounterDialog(viewer.id)}>
                {viewerCounter ? 'Change counter' : 'Counter'}
              </Button>
            )}
            {!viewerHasRejected && !viewerCounter && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => dispatch({ type: 'rejectTrade', playerId: viewer.id })}
              >
                Reject
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// One side of an offer as chips: resources, gold (T&B coins), commodities
// (Cities & Knights).
function tradeCards(
  resources: Partial<ResourceBank>,
  gold: number | undefined,
  commodities: Partial<CommodityBank> | undefined,
): ReactNode[] {
  return [
    ...RESOURCES.filter((r) => (resources[r] ?? 0) > 0).map((r) => (
      <ResourceChip key={r} resource={r} count={resources[r]} size="sm" />
    )),
    ...((gold ?? 0) > 0 ? [<GoldChip key="gold" n={gold!} />] : []),
    ...COMMODITIES.filter((c) => (commodities?.[c] ?? 0) > 0).map((c) => (
      <CommodityChip key={c} commodity={c} count={commodities![c]} size="sm" />
    )),
  ];
}

// Gold in a trade offer (T&B coins).
function GoldChip({ n }: { n: number }) {
  return (
    <span className="rchip rchip-sm" title={`${n} gold`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <CoinIcon size={14} />
      <span className="rchip-count">{n}</span>
    </span>
  );
}

// Cities & Knights: does the player hold the commodities a trade asks for?
function holdsCommodities(p: Player, want: Partial<CommodityBank> | undefined): boolean {
  if (!want) return true;
  for (const c of COMMODITIES) {
    if ((want[c] ?? 0) > (p.commodities?.[c] ?? 0)) return false;
  }
  return true;
}
