import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from './BoardSVG';
import { PlacementOverlay } from './PlacementOverlay';
import './Board.css';

// Live-game board: binds to the gameStore, overlays interactive placement
// ghosts, and adds wheel-zoom + drag-pan + a recenter button. Pure SVG
// rendering lives in BoardSVG so that replay can reuse it with arbitrary
// historical GameStates (replay stays un-zoomed).
export function Board() {
  const game = useGameStore((s) => s.game!);
  const pulseToken = useGameStore((s) => s.lastRolledHighlight);
  const setLastRolledHighlight = useGameStore((s) => s.setLastRolledHighlight);

  // Pan/zoom state. zoom is the scale factor (1 = native); pan is CSS-pixel
  // offset applied BEFORE scale so it feels uniform across zoom levels.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  // Drag tracking. We don't enter drag mode until the pointer has moved
  // more than DRAG_THRESHOLD_PX from the down position — below that we
  // treat the gesture as a click and let it through to the SVG so that
  // settlement / road / hex placement still works.
  const DRAG_THRESHOLD_PX = 4;
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
    pointerId: number;
    dragging: boolean;
  } | null>(null);
  // Set to true on pointerup if we were actually dragging — the next click
  // event (synthesized after pointerup) is then swallowed so a drag doesn't
  // also fire a placement.
  const justDraggedRef = useRef(false);

  // Auto-clear the production pulse after the CSS animation finishes (~1.5s).
  useEffect(() => {
    if (pulseToken == null) return;
    const id = window.setTimeout(() => setLastRolledHighlight(null), 1500);
    return () => window.clearTimeout(id);
  }, [pulseToken, setLastRolledHighlight]);

  // Wheel-to-zoom. React's onWheel is passive in modern browsers (can't
  // preventDefault to stop page scroll), so we attach a non-passive listener
  // via addEventListener.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Negative deltaY = wheel up = zoom in. Scale step is proportional to
      // current zoom so each notch feels the same regardless of zoom level.
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => clampZoom(z + delta * z));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const recenter = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only left-button drags pan. Right-click + middle-click left alone so
    // they can still hit native context menus if anything wires them up.
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPan: pan,
      pointerId: e.pointerId,
      dragging: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      ds.dragging = true;
      try {
        (e.currentTarget as Element).setPointerCapture(ds.pointerId);
      } catch {
        /* setPointerCapture can throw if the element already lost the
           pointer — safe to ignore, the move handler will keep working
           without explicit capture. */
      }
    }
    setPan({ x: ds.startPan.x + dx, y: ds.startPan.y + dy });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current;
    if (!ds) return;
    if (ds.dragging) {
      justDraggedRef.current = true;
      // Clear the click-suppression flag after the browser's synthesized
      // click event has had a chance to fire and be swallowed.
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
      try {
        (e.currentTarget as Element).releasePointerCapture(ds.pointerId);
      } catch {
        /* ignore — see onPointerMove */
      }
    }
    dragRef.current = null;
  };

  // Swallow click events that were the tail of a drag — otherwise the SVG
  // would interpret the gesture as a placement click.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div
      className="board-pan-wrap"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      <div
        className="board-pan-inner"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          cursor: dragRef.current?.dragging ? 'grabbing' : undefined,
        }}
      >
        <BoardSVG game={game} overlay={<PlacementOverlay />} pulseToken={pulseToken} />
      </div>
      <div className="board-zoom-ctrls" aria-label="Board view controls">
        <button
          type="button"
          className="board-zoom-btn"
          onClick={() => setZoom((z) => clampZoom(z + 0.25 * z))}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="board-zoom-btn"
          onClick={() => setZoom((z) => clampZoom(z - 0.25 * z))}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="board-zoom-btn board-zoom-recenter"
          onClick={recenter}
          title="Recenter board (reset pan + zoom)"
          aria-label="Recenter board"
        >
          ⊙
        </button>
      </div>
    </div>
  );
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}
