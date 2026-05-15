import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from './BoardSVG';
import { PlacementOverlay } from './PlacementOverlay';

// Live-game board: binds to the gameStore and overlays interactive
// placement ghosts. Pure SVG rendering lives in BoardSVG so that replay
// can reuse it with arbitrary historical GameStates.
export function Board() {
  const game = useGameStore((s) => s.game!);
  return <BoardSVG game={game} overlay={<PlacementOverlay />} />;
}
