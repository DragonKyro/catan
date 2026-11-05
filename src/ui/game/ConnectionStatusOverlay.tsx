import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { getActingPlayerId } from '@/game/helpers';
import './ConnectionStatusOverlay.css';

// Brief blips (a phone switching networks) shouldn't flash the banner.
const RECONNECT_BANNER_DELAY_MS = 2000;

/** A banner while this device's own link to the game server is down. Moves made meanwhile go through on reconnect. */
function ReconnectingBanner() {
  const up = useNetworkStore((s) => s.serverConnected);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (up) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), RECONNECT_BANNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [up]);
  if (!show) return null;
  return (
    <div className="conn-banner" role="status">
      <span className="conn-banner-spinner" /> Reconnecting to the game server…
    </div>
  );
}

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
  const banner = <ReconnectingBanner />;
  if (game.phase === 'gameOver') return banner;

  const actingId = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === actingId);
  if (!player || player.isAI) return banner;

  const uuid = uuidForPlayer(actingId);
  if (!uuid || onlineUuids.has(uuid)) return banner;

  return (
    <>
      {banner}
      <div className="conn-overlay">
        <div className="conn-overlay-card">
          <div className="conn-overlay-spinner" />
          <h3>Waiting for {player.name}</h3>
          <p>They've disconnected. The game will resume when they rejoin.</p>
        </div>
      </div>
    </>
  );
}
