import { useState } from 'react';
import type { Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import {
  FISH_COST_REMOVE_ROBBER,
  FISH_COST_TAKE_FROM_BANK,
  FISH_TOKEN_VALUE,
} from '@/game/modules/traders/constants';

type Effect = 'removeRobber' | 'takeFromBank';

// Auto-pick the smallest-value combination of the player's fish tokens that
// reaches `cost`. Greedy from largest values down — this minimizes the
// number of tokens spent (the rulebook lets excess fish be lost to the
// discard pile, so we don't aim for an exact match).
function pickTokensForCost(
  hand: Array<'one' | 'two' | 'three'>,
  cost: number,
): Array<'one' | 'two' | 'three'> | null {
  const sorted = [...hand].sort(
    (a, b) => FISH_TOKEN_VALUE[b] - FISH_TOKEN_VALUE[a],
  );
  const picked: Array<'one' | 'two' | 'three'> = [];
  let total = 0;
  for (const t of sorted) {
    if (total >= cost) break;
    picked.push(t);
    total += FISH_TOKEN_VALUE[t];
  }
  return total >= cost ? picked : null;
}

export function SpendFishDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const [effect, setEffect] = useState<Effect>('removeRobber');
  const [resource, setResource] = useState<Resource>('wheat');
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting);
  if (!player) return null;
  const hand = player.fishTokens ?? [];
  const total = hand.reduce((s, t) => s + FISH_TOKEN_VALUE[t], 0);

  const cost =
    effect === 'removeRobber' ? FISH_COST_REMOVE_ROBBER : FISH_COST_TAKE_FROM_BANK;
  const picked = pickTokensForCost(hand, cost);
  const canSubmit =
    picked != null &&
    (effect !== 'takeFromBank' || game.bank[resource] > 0) &&
    (effect !== 'removeRobber' || (game.robberActive ?? true));

  const submit = () => {
    if (!picked) return;
    if (effect === 'removeRobber') {
      dispatch({
        type: 'spendFish',
        playerId: acting,
        tokens: picked,
        effect: { kind: 'removeRobber' },
      });
    } else {
      dispatch({
        type: 'spendFish',
        playerId: acting,
        tokens: picked,
        effect: { kind: 'takeFromBank', resource },
      });
    }
    closeDialog();
  };

  return (
    <DialogShell
      title="Spend fish"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {effect === 'removeRobber'
              ? 'Drive off robber'
              : `Take 1 ${resource}`}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Fish hand: <strong>{total}</strong> fish across {hand.length} tokens.
        Excess fish on spent tokens is lost.
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Button
          variant={effect === 'removeRobber' ? 'primary' : 'secondary'}
          onClick={() => setEffect('removeRobber')}
        >
          🐠 Drive off robber (2)
        </Button>
        <Button
          variant={effect === 'takeFromBank' ? 'primary' : 'secondary'}
          onClick={() => setEffect('takeFromBank')}
        >
          🎁 Take from bank (4)
        </Button>
      </div>
      {effect === 'takeFromBank' && (
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: '0.85em',
              color: 'var(--text-soft)',
              marginBottom: 4,
            }}
          >
            Which resource?
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RESOURCES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={resource === r ? 'primary' : 'secondary'}
                disabled={game.bank[r] === 0}
                onClick={() => setResource(r)}
              >
                <ResourceChip
                  resource={r}
                  count={game.bank[r]}
                  size="sm"
                  dimmed={game.bank[r] === 0}
                />
              </Button>
            ))}
          </div>
        </div>
      )}
      <div
        style={{
          fontSize: '0.85em',
          color: 'var(--text-soft)',
          marginBottom: 4,
        }}
      >
        Discarding
      </div>
      <div>
        {picked ? (
          picked.map((t, i) => (
            <span
              key={i}
              style={{ marginRight: 6 }}
              title={`${FISH_TOKEN_VALUE[t]}-fish token`}
            >
              🐟 {FISH_TOKEN_VALUE[t]}
            </span>
          ))
        ) : (
          <span style={{ color: '#c83e3e' }}>
            Not enough fish — need {cost}, have {total}.
          </span>
        )}
      </div>
    </DialogShell>
  );
}
