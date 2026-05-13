import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { RESOURCES } from '@/game/types';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { Button } from '@/ui/shared/Button';
import './PendingTradeBanner.css';

const PLAYER_COLOR_CSS: Record<string, string> = {
  red: 'var(--player-red)',
  blue: 'var(--player-blue)',
  orange: 'var(--player-orange)',
  white: 'var(--player-white)',
};

export function PendingTradeBanner() {
  const { game, dispatch } = useGameStore();
  if (!game?.pendingTrade) return null;
  const trade = game.pendingTrade;
  const proposer = game.players.find((p) => p.id === trade.proposerId)!;
  const acting = getActingPlayerId(game);

  const hasReceive = (p: typeof proposer): boolean => {
    for (const r of RESOURCES) {
      if ((trade.receive[r] ?? 0) > p.resources[r]) return false;
    }
    return true;
  };

  const isProposer = acting === trade.proposerId;

  return (
    <div className="ptbanner">
      <div className="ptbanner-row">
        <span
          className="ptbanner-swatch"
          style={{ background: PLAYER_COLOR_CSS[proposer.color] }}
        />
        <strong>{proposer.name}</strong>
        <span style={{ color: 'var(--text-soft)' }}>offers</span>
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
      <div className="ptbanner-row ptbanner-actions">
        {isProposer ? (
          <Button size="sm" variant="danger" onClick={() => dispatch({ type: 'cancelTrade', playerId: proposer.id })}>
            Cancel trade
          </Button>
        ) : (
          game.players
            .filter((p) => p.id !== proposer.id && !p.isAI)
            .map((p) => {
              const can = hasReceive(p);
              return (
                <Button
                  key={p.id}
                  size="sm"
                  variant={can ? 'primary' : 'secondary'}
                  disabled={!can}
                  onClick={() => dispatch({ type: 'acceptTrade', playerId: p.id })}
                  title={can ? `${p.name} accepts` : `${p.name} doesn't have those resources`}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: PLAYER_COLOR_CSS[p.color],
                      marginRight: 4,
                    }}
                  />
                  {p.name}: accept
                </Button>
              );
            })
        )}
      </div>
    </div>
  );
}
