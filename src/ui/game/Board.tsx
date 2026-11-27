import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from './BoardSVG';
import { PlacementOverlay } from './PlacementOverlay';
import './Board.css';

type Point = { x: number; y: number };
// zoom is the scale factor (1 = native); pan is CSS-pixel offset applied
// BEFORE scale so it feels uniform across zoom levels.
type View = { zoom: number; pan: Point };

type Gesture =
  | { kind: 'pan'; start: Point; startPan: Point; dragging: boolean }
  | { kind: 'pinch'; startDist: number; startMid: Point; startView: View; origin: Point };

const HOME_VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } };

// Live-game board: binds to the gameStore, overlays interactive placement
// ghosts, and adds wheel-zoom + drag-pan + two-finger pinch-zoom + a
// recenter button. Pure SVG rendering lives in BoardSVG so that replay can
// reuse it with arbitrary historical GameStates (replay stays un-zoomed).
export function Board() {
  const game = useGameStore((s) => s.game!);
  const pulseToken = useGameStore((s) => s.lastRolledHighlight);
  const setLastRolledHighlight = useGameStore((s) => s.setLastRolledHighlight);

  // The ref mirrors the state so gesture handlers always start from the
  // latest view, even between a pointermove's update and the next render.
  const [view, setViewState] = useState<View>(HOME_VIEW);
  const viewRef = useRef(view);
  const setView = (v: View) => {
    viewRef.current = v;
    setViewState(v);
  };
  const zoomBy = (factor: number) => setView({ ...viewRef.current, zoom: clampZoom(viewRef.current.zoom * factor) });

  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Pointers currently down on the board (at most two: one pans, two pinch).
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  // A pan doesn't start until the pointer has moved more than
  // DRAG_THRESHOLD_PX from the down position — below that we treat the
  // gesture as a click and let it through to the SVG so that settlement /
  // road / hex placement still works.
  const DRAG_THRESHOLD_PX = 4;
  // Set to true on the last pointerup of a pan or pinch — the next click
  // event (synthesized after pointerup) is then swallowed so the gesture
  // doesn't also fire a placement.
  const justDraggedRef = useRef(false);

  // Auto-clear the production pulse after the CSS animation finishes (~1.5s).
  useEffect(() => {
    if (pulseToken == null) return;
    const id = window.setTimeout(() => setLastRolledHighlight(null), 1500);
    return () => window.clearTimeout(id);
  }, [pulseToken, setLastRolledHighlight]);

  // Wheel-to-zoom. React's onWheel is passive in modern browsers (can't
  // preventDefault to stop page scroll), so we attach a non-passive listener
  // via addEventListener. Safari's non-standard gesture events are cancelled
  // too, so a pinch on the board never zooms the page instead.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Negative deltaY = wheel up = zoom in. Scale step is proportional to
      // current zoom so each notch feels the same regardless of zoom level.
      zoomBy(1 - e.deltaY * 0.0015);
    };
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', stopGesture);
    el.addEventListener('gesturechange', stopGesture);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', stopGesture);
      el.removeEventListener('gesturechange', stopGesture);
    };
  }, []);

  const recenter = () => setView(HOME_VIEW);

  // The inner div's transform origin (its untransformed centre) in client
  // coordinates. offsetLeft/offsetWidth ignore the transform.
  const boardOrigin = (): Point => {
    const wrap = wrapRef.current!.getBoundingClientRect();
    const inner = innerRef.current!;
    return {
      x: wrap.left + inner.offsetLeft + inner.offsetWidth / 2,
      y: wrap.top + inner.offsetTop + inner.offsetHeight / 2,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only left-button drags pan. Right-click + middle-click left alone so
    // they can still hit native context menus if anything wires them up.
    if (e.button !== 0) return;
    const pointers = pointersRef.current;
    if (pointers.size >= 2) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      gestureRef.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, startPan: viewRef.current.pan, dragging: false };
      return;
    }
    // Second finger: switch to pinch. Capture both pointers so the gesture
    // survives fingers sliding off the board.
    for (const id of pointers.keys()) capture(e.currentTarget, id);
    const [a, b] = [...pointers.values()];
    gestureRef.current = {
      kind: 'pinch',
      startDist: Math.max(1, distance(a, b)),
      startMid: midpoint(a, b),
      startView: viewRef.current,
      origin: boardOrigin(),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    const g = gestureRef.current;
    if (!g || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.values()];
      const { startView: sv, startMid: m0, origin: o } = g;
      const zoom = clampZoom((sv.zoom * distance(a, b)) / g.startDist);
      const m = midpoint(a, b);
      // Keep the board point that was under the fingers' starting midpoint
      // under their current midpoint: screen = origin + pan + zoom * local.
      const k = zoom / sv.zoom;
      setView({
        zoom,
        pan: {
          x: m.x - o.x - k * (m0.x - o.x - sv.pan.x),
          y: m.y - o.y - k * (m0.y - o.y - sv.pan.y),
        },
      });
      return;
    }

    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      g.dragging = true;
      capture(e.currentTarget, e.pointerId);
    }
    setView({ ...viewRef.current, pan: { x: g.startPan.x + dx, y: g.startPan.y + dy } });
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.delete(e.pointerId)) return;
    release(e.currentTarget, e.pointerId);
    const g = gestureRef.current;
    if (pointers.size === 1) {
      // One finger lifted mid-pinch: keep panning with the other from where
      // it is now, so the board doesn't jump.
      const [rest] = [...pointers.values()];
      gestureRef.current = { kind: 'pan', start: rest, startPan: viewRef.current.pan, dragging: true };
      return;
    }
    gestureRef.current = null;
    if (g && (g.kind === 'pinch' || g.dragging)) {
      justDraggedRef.current = true;
      // Clear the click-suppression flag after the browser's synthesized
      // click event has had a chance to fire and be swallowed.
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
    }
  };

  // Swallow click events that were the tail of a drag — otherwise the SVG
  // would interpret the gesture as a placement click.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const g = gestureRef.current;
  return (
    <div
      className="board-pan-wrap"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClickCapture={onClickCapture}
    >
      <div
        className="board-pan-inner"
        ref={innerRef}
        style={{
          transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
          cursor: g && (g.kind === 'pinch' || g.dragging) ? 'grabbing' : undefined,
        }}
      >
        <BoardSVG game={game} overlay={<PlacementOverlay />} pulseToken={pulseToken} />
      </div>
      <div className="board-zoom-ctrls" aria-label="Board view controls">
        <button
          type="button"
          className="board-zoom-btn"
          onClick={() => zoomBy(1.25)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="board-zoom-btn"
          onClick={() => zoomBy(0.75)}
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

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Pointer capture calls can throw if the element already lost the pointer —
// safe to ignore, the move handler keeps working without explicit capture.
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* ignore */
  }
}

function release(el: Element, pointerId: number) {
  try {
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
  } catch {
    /* ignore */
  }
}
