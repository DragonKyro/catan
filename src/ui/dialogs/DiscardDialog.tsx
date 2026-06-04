import { useState } from 'react';
import type { Resource, ResourceBank, Commodity, CommodityBank } from '@/game/types';
import { RESOURCES, COMMODITIES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourcePicker } from '@/ui/shared/ResourcePicker';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';

export function DiscardDialog() {
  const { game, dispatch } = useGameStore();
  const [picked, setPicked] = useState<Partial<ResourceBank>>({});
  const [pickedCom, setPickedCom] = useState<Partial<CommodityBank>>({});
  if (!game || game.phase !== 'discard' || !game.discardState) return null;
  const acting = getActingPlayerId(game);
  const required = game.discardState.required[acting];
  if (required === undefined) return null;
  const player = game.players.find((p) => p.id === acting)!;
  // AI players discard themselves via the AIDriver — no dialog needed for
  // them (and we don't want to flash their hand to the human).
  if (player.isAI) return null;
  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);

  let total = 0;
  for (const r of RESOURCES) total += picked[r] ?? 0;
  for (const c of COMMODITIES) total += pickedCom[c] ?? 0;

  const commodities = player.commodities ?? { paper: 0, cloth: 0, coin: 0 };
  const playerHasCommodities =
    commodities.paper + commodities.cloth + commodities.coin > 0;

  const changeCom = (c: Commodity, delta: number) => {
    const cur = pickedCom[c] ?? 0;
    const next = Math.max(0, cur + delta);
    if (next > commodities[c]) return;
    setPickedCom({ ...pickedCom, [c]: next });
  };

  return (
    <DialogShell title={`${player.name} must discard ${required} cards`} blocking>
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Selected: <strong style={{ color: total === required ? 'var(--success)' : 'var(--accent)' }}>{total}</strong> / {required}
      </p>
      <ResourcePicker
        values={picked}
        available={player.resources as Record<Resource, number>}
        onChange={setPicked}
      />
      {hasCK && playerHasCommodities && (
        <div className="rpicker" style={{ marginTop: 8 }}>
          {COMMODITIES.map((c) => {
            const cur = pickedCom[c] ?? 0;
            const cap = commodities[c];
            const atCap = cur >= cap;
            return (
              <div key={c} className="rpicker-row">
                <CommodityChip commodity={c} />
                <button
                  type="button"
                  className="rpicker-btn"
                  onClick={() => changeCom(c, -1)}
                  disabled={cur === 0}
                  aria-label={`Decrease ${c}`}
                >
                  −
                </button>
                <span className="rpicker-value">{cur}</span>
                <button
                  type="button"
                  className="rpicker-btn"
                  onClick={() => changeCom(c, 1)}
                  disabled={atCap}
                  aria-label={`Increase ${c}`}
                >
                  +
                </button>
                <span className="rpicker-cap">/ {cap}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <Button
          variant="primary"
          disabled={total !== required}
          onClick={() => {
            if (hasCK) {
              dispatch({
                type: 'discardCK',
                playerId: acting,
                resources: picked,
                commodities: pickedCom,
              });
            } else {
              dispatch({ type: 'discard', playerId: acting, resources: picked });
            }
            setPicked({});
            setPickedCom({});
          }}
        >
          Confirm discard
        </Button>
      </div>
    </DialogShell>
  );
}
