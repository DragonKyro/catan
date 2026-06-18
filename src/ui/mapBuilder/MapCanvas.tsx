import { useCallback, useEffect, useMemo, useRef } from 'react';
import { buildGraphFromCoords } from '@/game/board/graph';
import { hexagonalDisk } from '@/game/modules/base/scenarios/helpers';
import { assembleBoardFromLayout } from '@/game/board/scenarioAssembly';
import { hexPolygonPoints, getEdgeMidpoint } from '@/ui/game/boardLayout';
import { PortMarker } from '@/ui/game/PortMarker';
import type { ScenarioLayout } from '@/game/board/scenarioTypes';
import type { CustomMap } from '@/game/customMap/types';
import type { BoardState } from '@/game/types';
import type { Tool } from './useBuilderState';
import { neighbourAxial } from '@/game/customMap/parse';
import './MapCanvas.css';

const TERRAIN_FILL: Record<string, string> = {
  wood: 'var(--terrain-wood)',
  brick: 'var(--terrain-brick)',
  sheep: 'var(--terrain-sheep)',
  wheat: 'var(--terrain-wheat)',
  ore: 'var(--terrain-ore)',
  desert: 'var(--terrain-desert)',
  sea: 'var(--terrain-sea)',
  gold: 'var(--terrain-gold)',
};

interface Props {
  map: CustomMap;
  tool: Tool;
  radius: number;
  onPaintHex: (q: number, r: number) => void;
  onPaintEdge: (q: number, r: number, direction: 0 | 1 | 2 | 3 | 4 | 5) => void;
  onPaintFog: (q: number, r: number) => void;
}

// The builder canvas. Renders:
//   1. The disk envelope (empty placeholder cells across the radius-N disk),
//   2. The painted positions on top (with fixed terrain / fixed token shown),
//   3. Port markers,
//   4. A clickable overlay for hexes + their 6 edges,
//   5. Fog overlay for Seafarers fog hexes.
//
// We attempt to use the real assembler when the pools are balanced (so the
// preview looks like a real game); when they aren't, we fall back to a
// static "skeleton" render so the user can still see what they've painted.
export function MapCanvas({
  map,
  tool,
  radius,
  onPaintHex,
  onPaintEdge,
  onPaintFog,
}: Props) {
  const { board, error } = useBoardOrSkeleton(map.layout, radius);
  // Size the viewBox to the full disk envelope (not just painted cells) so
  // the canvas grows as the user bumps the radius. Otherwise an unfilled
  // r=5 map would render at the same scale as an r=3 map.
  const vb = useMemo(() => diskViewBox(radius, 90), [radius]);

  // Build the set of land coords for fog rendering.
  const fogSet = useMemo(
    () => new Set(map.fogHexes.map((f) => `${f.q},${f.r}`)),
    [map.fogHexes],
  );
  const painted = useMemo(
    () => new Map(map.layout.positions.map((p) => [`${p.q},${p.r}`, p])),
    [map.layout.positions],
  );

  // The full disk envelope so clicks on empty cells still register.
  const diskCoords = useMemo(() => hexagonalDisk(radius), [radius]);

  // Drag-paint state. The `painting` ref flips true on mousedown over any
  // hex / ghost cell and false on mouseup or pointer leave. `lastKey` keeps
  // us from re-painting the same cell on every mousemove event.
  const painting = useRef(false);
  const lastKey = useRef<string | null>(null);

  const paintCell = useCallback(
    (q: number, r: number) => {
      const key = `${q},${r}`;
      if (lastKey.current === key) return;
      lastKey.current = key;
      if (tool.kind === 'fog') onPaintFog(q, r);
      else onPaintHex(q, r);
    },
    [tool.kind, onPaintFog, onPaintHex],
  );

  const onCellPointerDown = (q: number, r: number) => {
    painting.current = true;
    lastKey.current = null; // ensure the click itself always paints
    paintCell(q, r);
  };

  const onCellPointerEnter = (q: number, r: number) => {
    if (!painting.current) return;
    paintCell(q, r);
  };

  const stopPainting = () => {
    painting.current = false;
    lastKey.current = null;
  };

  // Window-level pointerup so a release outside the SVG still ends the drag.
  useEffect(() => {
    const onUp = () => {
      painting.current = false;
      lastKey.current = null;
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  return (
    <div className="map-canvas">
      <svg
        className="map-canvas-svg"
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerUp={stopPainting}
        onPointerLeave={stopPainting}
      >
        <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="var(--ocean)" />

        {/* Disk envelope: faint empty cells under the painted layout so the
            user knows the click target for every disk position. */}
        <g className="disk-envelope">
          {diskCoords.map(({ q, r }) => {
            const key = `${q},${r}`;
            // Skip if it's already a painted hex — the painted-positions
            // layer will draw it.
            if (board.hexes[key]) return null;
            const ghost = ghostPolygon(q, r);
            return (
              <polygon
                key={key}
                className="map-canvas-ghost"
                points={ghost.points}
                onPointerDown={() => onCellPointerDown(q, r)}
                onPointerEnter={() => onCellPointerEnter(q, r)}
              />
            );
          })}
        </g>

        {/* Painted hexes (terrain + token). */}
        <g className="painted-hexes">
          {board.hexIds.map((id) => {
            const hex = board.hexes[id]!;
            const points = hexPolygonPoints(board, id);
            const def = painted.get(`${hex.coord.q},${hex.coord.r}`);
            const fill = TERRAIN_FILL[hex.terrain] ?? 'var(--ocean)';
            const isFoggy = fogSet.has(id);
            const showToken = hex.numberToken !== null && !isFoggy;
            return (
              <g
                key={id}
                className="map-canvas-hex"
                onPointerDown={() => onCellPointerDown(hex.coord.q, hex.coord.r)}
                onPointerEnter={() => onCellPointerEnter(hex.coord.q, hex.coord.r)}
              >
                <polygon points={points} fill={fill} stroke="#1a1a1a40" strokeWidth={1.5} />
                {def?.fixedTerrain && (
                  <text
                    x={hex.center.x}
                    y={hex.center.y - 18}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#1a1a1a90"
                    fontWeight={600}
                  >
                    📌
                  </text>
                )}
                {showToken && (
                  <g transform={`translate(${hex.center.x}, ${hex.center.y})`}>
                    <circle r={15} fill="var(--token-fill)" stroke="var(--token-edge)" strokeWidth={1.2} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={14}
                      fontWeight={700}
                      fill={
                        hex.numberToken === 6 || hex.numberToken === 8
                          ? 'var(--token-hot)'
                          : '#1a1a1a'
                      }
                    >
                      {hex.numberToken}
                    </text>
                  </g>
                )}
                {def?.fixedToken != null && (
                  <text
                    x={hex.center.x}
                    y={hex.center.y + 22}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#1a1a1a90"
                    fontWeight={600}
                  >
                    📌
                  </text>
                )}
                {isFoggy && (
                  <g transform={`translate(${hex.center.x}, ${hex.center.y})`} opacity={0.7}>
                    <circle cx={-10} cy={2} r={9} fill="#e8edf2" />
                    <circle cx={0} cy={-4} r={11} fill="#e8edf2" />
                    <circle cx={10} cy={2} r={9} fill="#e8edf2" />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Ports rendered using the live PortMarker. */}
        <g className="painted-ports">
          {board.ports.map((p) => (
            <PortMarker key={p.edge} board={board} port={p} />
          ))}
        </g>

        {/* Edge overlay — invisible click targets on each edge of every
            painted hex, used by the port tool. Only rendered when a port
            tool is active so users don't lose hex clicks to misses. */}
        {(tool.kind === 'port' || tool.kind === 'erase') && (
          <g className="edge-overlay">
            {board.hexIds.flatMap((id) => {
              const hex = board.hexes[id]!;
              return [0, 1, 2, 3, 4, 5].map((dir) => {
                const direction = dir as 0 | 1 | 2 | 3 | 4 | 5;
                const corner1 = hex.corners[dir]!;
                const corner2 = hex.corners[(dir + 1) % 6]!;
                const v1 = board.vertices[corner1]!.position;
                const v2 = board.vertices[corner2]!.position;
                const eid = sharedEdge(board, corner1, corner2);
                if (!eid) return null;
                const mid = getEdgeMidpoint(board, eid);
                return (
                  <g
                    key={`${id}-${dir}`}
                    className="edge-target"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPaintEdge(hex.coord.q, hex.coord.r, direction);
                    }}
                  >
                    <line
                      x1={v1.x}
                      y1={v1.y}
                      x2={v2.x}
                      y2={v2.y}
                      stroke="transparent"
                      strokeWidth={12}
                    />
                    <circle cx={mid.x} cy={mid.y} r={3.5} fill="#ffffff60" />
                  </g>
                );
              });
            })}
          </g>
        )}
      </svg>
      {error && (
        <div className="map-canvas-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

// Try to assemble the layout into a real board with a stable seed. When the
// pools don't balance the assembler throws, so we fall back to a skeleton
// board with everything pinned to a placeholder terrain and no tokens.
function useBoardOrSkeleton(
  layout: ScenarioLayout,
  radius: number,
): { board: BoardState; error: string | null } {
  return useMemo(() => {
    try {
      const r = assembleBoardFromLayout(layout, 12345);
      return { board: r.board, error: null };
    } catch (e) {
      const board = skeletonBoard(layout, radius);
      return {
        board,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [layout, radius]);
}

// Render a static skeleton (no shuffle / no token assignment) of whatever
// positions the user has painted, so the canvas remains usable while the
// pools are temporarily unbalanced.
function skeletonBoard(layout: ScenarioLayout, _radius: number): BoardState {
  const coords = layout.positions.map((p) => ({ q: p.q, r: p.r }));
  const graph = buildGraphFromCoords(coords);
  const hexes: BoardState['hexes'] = {};
  for (const hexId of graph.hexIds) {
    const coord = graph.hexCoords.get(hexId)!;
    const corners = graph.hexCorners.get(hexId)!;
    const def = layout.positions.find((p) => p.q === coord.q && p.r === coord.r)!;
    const terrain =
      def.kind === 'sea'
        ? 'sea'
        : def.kind === 'desert'
          ? 'desert'
          : (def.fixedTerrain ?? 'wheat');
    hexes[hexId] = {
      id: hexId,
      coord,
      terrain,
      numberToken: def.fixedToken ?? null,
      corners,
      center: cornerCenter(graph, corners),
    };
  }
  return {
    hexes,
    vertices: graph.vertices,
    edges: graph.edges,
    ports: [],
    robberHex: graph.hexIds[0]!,
    hexIds: graph.hexIds,
    vertexIds: graph.vertexIds,
    edgeIds: graph.edgeIds,
  };
}

function cornerCenter(
  graph: ReturnType<typeof buildGraphFromCoords>,
  corners: string[],
): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  for (const vid of corners) {
    cx += graph.vertices[vid]!.position.x;
    cy += graph.vertices[vid]!.position.y;
  }
  cx /= corners.length;
  cy /= corners.length;
  return { x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100 };
}

function sharedEdge(board: BoardState, v1: string, v2: string): string | null {
  const eid = Object.values(board.edges).find(
    (e) =>
      (e.vertices[0] === v1 && e.vertices[1] === v2) ||
      (e.vertices[0] === v2 && e.vertices[1] === v1),
  );
  return eid ? eid.id : null;
}

// Approximate a hex polygon for a ghost (empty-disk) cell using the
// pointy-top axial → cartesian conversion. Used only for placeholder
// click targets — once the cell is painted the real graph renders it.
function ghostPolygon(q: number, r: number): { points: string } {
  const size = 50;
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`);
  }
  return { points: pts.join(' ') };
}

// ViewBox covering the entire radius-N disk (including unpainted ghost
// cells) so the canvas scale stays consistent — and grows — as the user
// changes radius.
function diskViewBox(radius: number, padding: number) {
  const size = 50;
  const w = size * Math.sqrt(3);
  const halfW = w * (radius + 0.5);
  const halfH = size * 1.5 * radius + size;
  return {
    x: -halfW - padding,
    y: -halfH - padding,
    width: 2 * (halfW + padding),
    height: 2 * (halfH + padding),
  };
}

// Avoid relying on neighbourAxial here at runtime to keep the bundle thin;
// re-export it from parse.ts where it lives.
export { neighbourAxial };
