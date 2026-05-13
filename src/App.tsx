import { useGameStore } from '@/store/gameStore';
import { NewGame } from '@/ui/newGame/NewGame';
import { GameView } from '@/ui/game/GameView';

export default function App() {
  const game = useGameStore((s) => s.game);
  return (
    <div className="app-root">
      {game ? <GameView /> : <NewGame />}
    </div>
  );
}
