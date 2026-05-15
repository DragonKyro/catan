import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { HomeMenu } from '@/ui/newGame/HomeMenu';
import { LobbyScreen } from '@/ui/lobby/LobbyScreen';
import { GameView } from '@/ui/game/GameView';

export default function App() {
  const game = useGameStore((s) => s.game);
  const connection = useNetworkStore((s) => s.connection);

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
