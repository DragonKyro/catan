import { useState } from 'react';
import type { Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourcePicker } from '@/ui/shared/ResourcePicker';
import './PlayerTradeDialog.css';

export function PlayerTradeDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  const [give, setGive] = useState<Partial<ResourceBank>>({});
  const [receive, setReceive] = useState<Partial<ResourceBank>>({});
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;

  let totalGive = 0;
  let totalReceive = 0;
  for (const r of RESOURCES) {
    totalGive += give[r] ?? 0;
    totalReceive += receive[r] ?? 0;
  }
  const canPropose =
    totalGive > 0 && totalReceive > 0 && !game.pendingTrade;

  return (
    <DialogShell
      title="Propose a trade"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canPropose}
            onClick={() => {
              dispatch({ type: 'proposeTrade', playerId: acting, give, receive });
              closeDialog();
            }}
          >
            Propose to all
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)', fontSize: '0.9em' }}>
        Set what you'll give and what you want. Any opponent who has the resources can accept.
      </p>
      <div className="ptrade-section">
        <div className="ptrade-section-label">You give</div>
        <ResourcePicker
          values={give}
          available={player.resources as Record<Resource, number>}
          onChange={setGive}
        />
      </div>
      <div className="ptrade-section">
        <div className="ptrade-section-label">You want</div>
        <ResourcePicker values={receive} onChange={setReceive} />
      </div>
    </DialogShell>
  );
}
