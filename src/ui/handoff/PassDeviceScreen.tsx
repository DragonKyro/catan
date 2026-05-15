import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { Button } from '@/ui/shared/Button';
import { playerColorVar } from '@/ui/shared/playerColors';
import './PassDeviceScreen.css';

export function PassDeviceScreen() {
  const game = useGameStore((s) => s.game!);
  const acknowledgeHandoff = useGameStore((s) => s.acknowledgeHandoff);
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const isDiscard = game.phase === 'discard';
  return (
    <div className="handoff">
      <div className="handoff-card">
        <div className="handoff-eyebrow">Pass the device</div>
        <div
          className="handoff-swatch"
          style={{ background: playerColorVar(player.color) }}
        />
        <h2 className="handoff-name">{player.name}</h2>
        <p className="handoff-instruction">
          {isDiscard ? 'You need to discard cards.' : "It's your turn."}
        </p>
        <Button variant="primary" size="lg" onClick={acknowledgeHandoff}>
          {isDiscard ? 'Start discarding' : 'Begin turn'}
        </Button>
      </div>
    </div>
  );
}
