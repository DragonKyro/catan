import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';

// Shown after a 7-roll (or knight) when Seafarers is active: pick whether
// to move the robber (land) or the pirate (sea).
export function RobberOrPirateDialog() {
  const { game, dispatch } = useGameStore();
  if (!game || game.phase !== 'chooseRobberOrPirate') return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting);
  if (player?.isAI) return null; // AI picks itself via AIDriver

  return (
    <DialogShell title="Move the robber or the pirate?" blocking>
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        The robber blocks production on a land hex and lets you steal from a
        player with a settlement or city there. The pirate sits on a sea hex
        and lets you steal from a player with a ship there.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button onClick={() => dispatch({ type: 'choosePirate', playerId: acting })}>
          ☠ Move pirate
        </Button>
        <Button
          variant="primary"
          onClick={() => dispatch({ type: 'chooseRobber', playerId: acting })}
        >
          🦹 Move robber
        </Button>
      </div>
    </DialogShell>
  );
}
