import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { getBankTradeRate } from '@/game/actions/trade';
import { GOLD_PER_RESOURCE, MAX_GOLD_SPENDS_PER_TURN } from '@/game/modules/traders/constants';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';
import { useCanAct } from '@/ui/shared/useCanAct';
import { CoinIcon, MoneyBagIcon } from '@/ui/game/traders/TradersIcons';

// Coins (Rivers of Catan; any scenario with state.coinsInPlay): spend 2 gold
// for a card of your choice (twice a turn), or buy 1 gold with cards at your
// bank rate for that resource.
export function CoinsDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || !acting || !game.coinsInPlay || game.phase !== 'main' || !canAct) return null;
  const player = game.players.find((p) => p.id === acting)!;
  const gold = player.gold ?? 0;
  const used = game.goldSpendsThisTurn ?? 0;
  const spendsLeft = MAX_GOLD_SPENDS_PER_TURN - used;
  const canSpend = gold >= GOLD_PER_RESOURCE && spendsLeft > 0;
  const tiles = game.wealthTiles;
  return (
    <DialogShell title="Coins" onClose={closeDialog} footer={<Button onClick={closeDialog}>Done</Button>}>
      <p style={{ marginTop: 0, color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <CoinIcon size={18} /> You have <strong style={{ color: 'var(--text)' }}>{gold} gold</strong>.
        {tiles?.wealthiest === acting && (
          <span title="Wealthiest Catanian (+1 VP)">
            <MoneyBagIcon size={16} /> Wealthiest (+1 VP)
          </span>
        )}
        {tiles?.poor.includes(acting) && (
          <span title="Poor Catanian (-2 VP)">
            <MoneyBagIcon size={16} poor /> Poor (−2 VP)
          </span>
        )}
      </p>

      <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', marginBottom: 4 }}>
        Spend {GOLD_PER_RESOURCE} gold → 1 card ({spendsLeft} of {MAX_GOLD_SPENDS_PER_TURN} left this turn)
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {RESOURCES.map((r) => (
          <Button
            key={r}
            size="sm"
            disabled={!canSpend || game.bank[r] <= 0}
            title={
              !canSpend
                ? spendsLeft <= 0
                  ? 'Already bought twice with gold this turn'
                  : `Needs ${GOLD_PER_RESOURCE} gold`
                : game.bank[r] <= 0
                  ? `The supply has no ${RESOURCE_LABEL[r].toLowerCase()}`
                  : `Pay ${GOLD_PER_RESOURCE} gold for 1 ${RESOURCE_LABEL[r].toLowerCase()}`
            }
            onClick={() => dispatch({ type: 'spendGold', playerId: acting, resource: r })}
          >
            <ResourceChip resource={r} size="sm" />
          </Button>
        ))}
      </div>

      <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', marginBottom: 4 }}>
        Buy 1 gold with cards (your bank rate)
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {RESOURCES.map((r) => {
          const rate = getBankTradeRate(game, acting, r);
          const ok = player.resources[r] >= rate;
          return (
            <Button
              key={r}
              size="sm"
              disabled={!ok}
              title={ok ? `Give ${rate} ${RESOURCE_LABEL[r].toLowerCase()} for 1 gold` : `Needs ${rate} ${RESOURCE_LABEL[r].toLowerCase()}`}
              onClick={() => dispatch({ type: 'buyGold', playerId: acting, give: r })}
            >
              <ResourceChip resource={r} count={rate} size="sm" dimmed={!ok} />
              <span aria-hidden> →</span> <CoinIcon size={14} />
            </Button>
          );
        })}
      </div>
      <p style={{ marginBottom: 0, fontSize: '0.8em', color: 'var(--text-soft)' }}>
        {game.explorersPirates
          ? "Coins aren't resource cards: they don't count for a 7. A pirate takes 1 gold from a player with no cards to steal."
          : "Coins aren't resource cards: they don't count for a 7, can't be stolen or taken by Monopoly."}
        {tiles && ' The richest player alone is Wealthiest (+1 VP); everyone tied for the least gold is Poor (−2 VP).'}
      </p>
    </DialogShell>
  );
}
