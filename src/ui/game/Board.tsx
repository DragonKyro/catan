import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from './BoardSVG';
import { PlacementOverlay } from './PlacementOverlay';

// Live-game board: binds to the gameStore and overlays interactive
// placement ghosts. Pure SVG rendering lives in BoardSVG so that replay
// can reuse it with arbitrary historical GameStates.
export function Board() {
  const game = useGameStore((s) => s.game!);
  const pulseToken = useGameStore((s) => s.lastRolledHighlight);
  const setLastRolledHighlight = useGameStore((s) => s.setLastRolledHighlight);

  // Auto-clear the pulse after the CSS animation finishes (~1.5s).
  useEffect(() => {
    if (pulseToken == null) return;
    const id = window.setTimeout(() => setLastRolledHighlight(null), 1500);
    return () => window.clearTimeout(id);
  }, [pulseToken, setLastRolledHighlight]);

  return <BoardSVG game={game} overlay={<PlacementOverlay />} pulseToken={pulseToken} />;
}
