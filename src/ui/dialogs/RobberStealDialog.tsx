import type { Action, PlayerId } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { totalResources } from '@/game/resources';
import { playerColorVar } from '@/ui/shared/playerColors';
import { pirateStealCandidates } from '@/game/modules/seafarers/actions/movePirate';
import { stealResourceCandidates } from '@/game/modules/seafarers/pirateIslands';
import { useCanAct } from '@/ui/shared/useCanAct';
import { robberStealCandidates } from '@/game/engine';

// "Steal from whom?" after the robber or pirate lands on a hex with several
// victims, and on a 7 in Pirate Islands (no robber: rob anyone, or no one).
// Cloth for Catan: the pirate may take a cloth token instead of a card.
export function RobberStealDialog() {
  const { game, dispatch, pendingRobberHex, setPendingRobberHex, pendingPirateHex, setPendingPirateHex } =
    useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || !acting || !canAct) return null;

  let mode: 'robber' | 'pirate' | 'any' | null = null;
  if (pendingRobberHex) mode = 'robber';
  else if (pendingPirateHex) mode = 'pirate';
  else if (game.phase === 'stealResource') mode = 'any';
  if (!mode) return null;

  let candidates: PlayerId[] = [];
  if (mode === 'robber') {
    candidates = robberStealCandidates(game, acting, pendingRobberHex!);
  } else if (mode === 'pirate') {
    candidates = pirateStealCandidates(game, acting, pendingPirateHex!);
  } else {
    candidates = stealResourceCandidates(game, acting);
  }
  const cloth = mode === 'pirate' && game.clothVillages !== undefined;

  const steal = (pid: PlayerId | null, stealCloth = false) => {
    let action: Action;
    if (mode === 'robber') {
      action = { type: 'moveRobber', playerId: acting, hex: pendingRobberHex!, stealFrom: pid };
    } else if (mode === 'pirate') {
      action = {
        type: 'movePirate',
        playerId: acting,
        hex: pendingPirateHex!,
        stealFrom: pid,
        ...(stealCloth ? { stealCloth: true } : {}),
      };
    } else {
      action = { type: 'stealResource', playerId: acting, stealFrom: pid };
    }
    dispatch(action);
  };
  const close =
    mode === 'robber'
      ? () => setPendingRobberHex(null)
      : mode === 'pirate'
        ? () => setPendingPirateHex(null)
        : undefined;

  return (
    <DialogShell
      title={mode === 'any' ? 'A 7! Steal from whom?' : 'Steal from whom?'}
      onClose={close}
      blocking={mode === 'any'}
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        {mode === 'any'
          ? 'There is no robber in this scenario: you may steal one random resource card from any player.'
          : cloth
            ? 'Take one random resource card — or one cloth token — from a player with a ship here.'
            : 'Pick a player to steal one resource card from at random.'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((pid) => {
          const p = game.players.find((x) => x.id === pid)!;
          const cards = totalResources(p.resources);
          const swatch = (
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
          );
          return (
            <div key={pid} style={{ display: 'flex', gap: 8 }}>
              <Button fullWidth disabled={cards === 0} onClick={() => steal(pid)}>
                {swatch}
                {p.name} ({cards} card{cards === 1 ? '' : 's'})
              </Button>
              {cloth && (p.cloth ?? 0) > 0 && (
                <Button onClick={() => steal(pid, true)} title="Take a cloth token instead">
                  🧵 Cloth ({p.cloth})
                </Button>
              )}
            </div>
          );
        })}
        {mode === 'any' && (
          <Button variant="ghost" onClick={() => steal(null)}>
            {candidates.length === 0 ? 'Nobody has cards — continue' : "Don't steal"}
          </Button>
        )}
      </div>
    </DialogShell>
  );
}
