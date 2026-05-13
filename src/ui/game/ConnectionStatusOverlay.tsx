import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { getActingPlayerId } from '@/game/helpers';
import './ConnectionStatusOverlay.css';

// Renders an overlay when the current acting player is a human who is
// offline. While they're gone, no actions can advance the game (the engine
// enforces "only the current player can act"), so we surface this clearly.
export function ConnectionStatusOverlay() {
  const game = useGameStore((s) => s.game);
  const connection = useNetworkStore((s) => s.connection);
  const onlineUuids = useNetworkStore((s) => s.onlineUuids);
  const uuidForPlayer = useNetworkStore((s) => s.uuidForPlayer);

  if (!game) return null;
  if (connection !== 'in-game') return null;
  if (game.phase === 'gameOver') return null;

  const actingId = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === actingId);
  if (!player || player.isAI) return null;

  const uuid = uuidForPlayer(actingId);
  if (!uuid || onlineUuids.has(uuid)) return null;

  return (
    <div className="conn-overlay">
      <div className="conn-overlay-card">
        <div className="conn-overlay-spinner" />
        <h3>Waiting for {player.name}</h3>
        <p>They've disconnected. The game will resume when they rejoin.</p>
      </div>
    </div>
  );
}
