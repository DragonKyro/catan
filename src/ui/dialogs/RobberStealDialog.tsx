import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { totalResources } from '@/game/resources';
import { playerColorVar } from '@/ui/shared/playerColors';

export function RobberStealDialog() {
  const { game, dispatch, pendingRobberHex, setPendingRobberHex } = useGameStore();
  if (!game || !pendingRobberHex) return null;
  const acting = getActingPlayerId(game);

  const candidates: string[] = [];
  for (const v of Object.values(game.board.vertices)) {
    if (!v.hexes.includes(pendingRobberHex)) continue;
    for (const p of game.players) {
      if (p.id === acting) continue;
      if (p.settlements.includes(v.id) || p.cities.includes(v.id)) {
        if (totalResources(p.resources) > 0 && !candidates.includes(p.id)) {
          candidates.push(p.id);
        }
      }
    }
  }

  return (
    <DialogShell
      title="Steal from?"
      onClose={() => setPendingRobberHex(null)}
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Pick a player to steal one resource card from at random.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((pid) => {
          const p = game.players.find((x) => x.id === pid)!;
          return (
            <Button
              key={pid}
              fullWidth
              onClick={() =>
                dispatch({
                  type: 'moveRobber',
                  playerId: acting,
                  hex: pendingRobberHex,
                  stealFrom: pid,
                })
              }
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: playerColorVar(p.color),
                  marginRight: 8,
                  border: '1px solid #00000040',
                }}
              />
              {p.name} ({totalResources(p.resources)} cards)
            </Button>
          );
        })}
      </div>
    </DialogShell>
  );
}
