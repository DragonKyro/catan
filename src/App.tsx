import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { useReplayStore } from '@/store/replayStore';
import { HomeMenu } from '@/ui/newGame/HomeMenu';
import { LobbyScreen } from '@/ui/lobby/LobbyScreen';
import { GameView } from '@/ui/game/GameView';
import { ReplayScreen } from '@/ui/replay/ReplayScreen';

export default function App() {
  const game = useGameStore((s) => s.game);
  const connection = useNetworkStore((s) => s.connection);
  const replayData = useReplayStore((s) => s.data);

  // Replay overrides everything — it's a top-level view triggered either
  // from GameOver ("Watch replay") or HomeMenu ("Load replay"). Exiting
  // replay restores whichever underlying view is active.
  if (replayData) {
    return (
      <div className="app-root">
        <ReplayScreen />
      </div>
    );
  }
  // Game running takes priority over network screens.
  if (game) {
    return (
      <div className="app-root">
        <GameView />
      </div>
    );
  }
  // In a network session before game starts → lobby (or "connecting" placeholder).
  if (connection === 'lobby' || connection === 'connecting') {
    return (
      <div className="app-root">
        <LobbyScreen />
      </div>
    );
  }
  return (
    <div className="app-root">
      <HomeMenu />
    </div>
  );
}
