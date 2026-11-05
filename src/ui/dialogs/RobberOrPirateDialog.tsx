import type { GameState, PlayerId } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { robberHexAllowed, robberStealCandidates } from '@/game/engine';
import {
  canMovePirateTo,
  pirateStealCandidates,
} from '@/game/modules/seafarers/actions/movePirate';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { useCanAct } from '@/ui/shared/useCanAct';

// Players the robber could rob from some legal hex.
function robberVictims(game: GameState, acting: PlayerId): Set<PlayerId> {
  const out = new Set<PlayerId>();
  for (const hid of game.board.hexIds) {
    if (!robberHexAllowed(game, hid, acting)) continue;
    for (const pid of robberStealCandidates(game, acting, hid)) out.add(pid);
  }
  return out;
}

function pirateVictims(game: GameState, acting: PlayerId): Set<PlayerId> {
  const out = new Set<PlayerId>();
  for (const hid of game.board.hexIds) {
    if (!canMovePirateTo(game, hid)) continue;
    for (const pid of pirateStealCandidates(game, acting, hid)) out.add(pid);
  }
  return out;
}

function names(game: GameState, ids: Set<PlayerId>): string {
  if (ids.size === 0) return 'nobody';
  return [...ids].map((id) => game.players.find((p) => p.id === id)?.name ?? id).join(', ');
}

// Shown after a 7-roll (or Knight) in Seafarers: move the robber (land) or
// the pirate (sea). Lists who each choice could rob.
export function RobberOrPirateDialog() {
  const { game, dispatch } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || game.phase !== 'chooseRobberOrPirate' || !acting || !canAct) return null;
  const robber = robberVictims(game, acting);
  const pirate = pirateVictims(game, acting);
  const clothNote = game.clothVillages ? ' (a resource card or a cloth token)' : '';

  return (
    <DialogShell title="Move the robber or the pirate?" blocking>
      <ul style={{ marginTop: 0, paddingLeft: 18, color: 'var(--text-soft)' }}>
        <li>
          <strong>Robber</strong> — blocks a land hex's production; rob a player with a building
          there. Could rob: {names(game, robber)}.
        </li>
        <li>
          <strong>Pirate</strong> — sits on a sea hex: no ships may be built on, or moved to or
          from, its edges. Rob a player with a ship there{clothNote}. Could rob:{' '}
          {names(game, pirate)}.
        </li>
      </ul>
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
