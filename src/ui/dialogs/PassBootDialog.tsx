import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { playerColorVar } from '@/ui/shared/playerColors';
import { calculateVictoryPoints } from '@/game/scoring/points';

// Pass the old boot to an opponent with ≥ your visible VPs.
//
// The rulebook explicitly excludes hidden VP dev cards from the
// comparison — we pass `includeHidden=false` to `calculateVictoryPoints`.
export function PassBootDialog() {
  const { game, dispatch, closeDialog } = useGameStore();
  if (!game) return null;
  const acting = getActingPlayerId(game);
  if (game.oldBootHolder !== acting) {
    // Caller should have gated on this; just close defensively.
    closeDialog();
    return null;
  }
  const myVp = calculateVictoryPoints(game, acting, false);
  const eligible = game.players.filter((p) => {
    if (p.id === acting) return false;
    return calculateVictoryPoints(game, p.id, false) >= myVp;
  });
  return (
    <DialogShell
      title="Pass the old boot"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Keep it</Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Pass to any player with at least your visible VPs ({myVp}). They'll
        need +1 VP to win until they pass it on or the game ends.
      </p>
      {eligible.length === 0 ? (
        <p>
          No-one currently qualifies. Catch up first, or wait until an
          opponent overtakes you.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {eligible.map((p) => (
            <Button
              key={p.id}
              onClick={() => {
                dispatch({
                  type: 'passOldBoot',
                  playerId: acting,
                  to: p.id,
                });
                closeDialog();
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: playerColorVar(p.color),
                  marginRight: 8,
                  verticalAlign: 'middle',
                }}
              />
              {p.name} — {calculateVictoryPoints(game, p.id, false)} VP
            </Button>
          ))}
        </div>
      )}
    </DialogShell>
  );
}
