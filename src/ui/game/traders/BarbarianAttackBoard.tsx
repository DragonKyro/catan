import type { BoardState, GameState, HexId, PlayerColor } from '@/game/types';
import { hexPolygonPoints } from '../boardLayout';
import { PLAYER_COLOR_HEX } from '@/ui/shared/playerColors';
import { castleHexes, isHexConquered } from '@/game/modules/traders/barbarianAttack/state';
import { edgeKey } from '@/game/board/coords';

// Barbarian Attack board art (rulebook pp.15-18): the castle tile with its
// coloured edge pips, grey barbarian figures (1-3) on coastal hexes, conquered
// hexes with their number disc turned face down, and knights on edges in the
// players' colours. Pointer events are off — the overlay handles clicks.

// Castle tile pips by edge direction (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE):
// purple 1 / 6 on the "/" edges, green 2 / 5 on the "\" edges, brown 3 / 4 on
// the vertical edges — the knight-loss die key.
export const EDGE_COLOR_HEX = { purple: '#6b2f93', green: '#1d9a58', brown: '#8a5a2b' } as const;
const CASTLE_PIPS: Array<{ color: keyof typeof EDGE_COLOR_HEX; face: number }> = [
  { color: 'brown', face: 4 },
  { color: 'purple', face: 6 },
  { color: 'green', face: 5 },
  { color: 'brown', face: 3 },
  { color: 'purple', face: 1 },
  { color: 'green', face: 2 },
];

// Drawn right after the hex tiles (under roads and pieces).
export function BarbarianAttackHexLayer({ game }: { game: GameState }) {
  const ba = game.barbarianAttack;
  if (!ba) return null;
  const board = game.board;
  return (
    <g className="barbarian-attack-hexes" pointerEvents="none">
      {castleHexes(ba).map((h) => (
        <CastleTile key={h} board={board} hexId={h} />
      ))}
      {ba.coastalHexes.map((h) => {
        const n = ba.barbarians[h] ?? 0;
        if (n === 0) return null;
        return (
          <g key={h}>
            {isHexConquered(game, h) && <ConqueredHex board={board} hexId={h} />}
            <BarbarianGroup board={board} hexId={h} count={n} />
          </g>
        );
      })}
    </g>
  );
}

function CastleTile({ board, hexId }: { board: BoardState; hexId: HexId }) {
  const hex = board.hexes[hexId];
  if (!hex) return null;
  const { x, y } = hex.center;
  return (
    <g className="ba-castle">
      <polygon points={hexPolygonPoints(board, hexId)} fill="#7cb342" stroke="#1a1a1a40" strokeWidth={1.5} />
      <polygon
        points={hexPolygonPoints(board, hexId)}
        fill="none"
        stroke="#e8d9a8"
        strokeWidth={3}
        strokeOpacity={0.55}
        transform={`translate(${x} ${y}) scale(0.9) translate(${-x} ${-y})`}
      />
      <g transform={`translate(${x}, ${y + 2})`}>
        {/* Curtain wall */}
        <path d="M-17,10 L-17,-2 L17,-2 L17,10 Z" fill="#a08870" stroke="#3b2f25" strokeWidth={1} />
        <path d="M-17,-2 h4 v-2 h3 v2 h4 v-2 h3 v2 h4 v-2 h3 v2 h4 v-2 h3 v2 h3" fill="none" stroke="#3b2f25" strokeWidth={0.9} />
        {/* Keep */}
        <rect x={-7} y={-14} width={14} height={14} fill="#b59a7e" stroke="#3b2f25" strokeWidth={1} />
        <path d="M-9,-14 L0,-21 L9,-14 Z" fill="#c4452b" stroke="#5a1d12" strokeWidth={0.9} />
        {/* Towers */}
        <rect x={-19} y={-9} width={6} height={19} fill="#9c846b" stroke="#3b2f25" strokeWidth={1} />
        <path d="M-20.5,-9 L-16,-15 L-11.5,-9 Z" fill="#c4452b" stroke="#5a1d12" strokeWidth={0.8} />
        <rect x={13} y={-9} width={6} height={19} fill="#9c846b" stroke="#3b2f25" strokeWidth={1} />
        <path d="M11.5,-9 L16,-15 L20.5,-9 Z" fill="#c4452b" stroke="#5a1d12" strokeWidth={0.8} />
        {/* Gate + windows */}
        <path d="M-3,10 L-3,4 Q0,1 3,4 L3,10 Z" fill="#3b2f25" />
        <rect x={-1.2} y={-10} width={2.4} height={3.4} fill="#3b2f25" />
        {/* Pennant */}
        <line x1={0} y1={-21} x2={0} y2={-27} stroke="#3b2f25" strokeWidth={0.8} />
        <path d="M0,-27 L5,-25.5 L0,-24 Z" fill="#e53935" />
      </g>
      {hex.corners.map((_, d) => {
        const a = board.vertices[hex.corners[d]!]!.position;
        const b = board.vertices[hex.corners[(d + 1) % 6]!]!.position;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const px = x + (mx - x) * 0.74;
        const py = y + (my - y) * 0.74;
        const pip = CASTLE_PIPS[d]!;
        return <DiePip key={d} x={px} y={py} color={EDGE_COLOR_HEX[pip.color]} face={pip.face} r={5.4} />;
      })}
    </g>
  );
}

// A coloured round die face (yellow pips), like the castle tile's markers.
export function DiePip({ x, y, color, face, r }: { x: number; y: number; color: string; face: number; r: number }) {
  const o = r * 0.45;
  const spots: Array<[number, number]> = (
    {
      1: [[0, 0]],
      2: [[-o, -o], [o, o]],
      3: [[-o, -o], [0, 0], [o, o]],
      4: [[-o, -o], [o, -o], [-o, o], [o, o]],
      5: [[-o, -o], [o, -o], [0, 0], [-o, o], [o, o]],
      6: [[-o, -o], [o, -o], [-o, 0], [o, 0], [-o, o], [o, o]],
    } as Record<number, Array<[number, number]>>
  )[face]!;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={r} fill={color} stroke="#ffffffb0" strokeWidth={0.8} />
      {spots.map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={r * 0.17} fill="#ffd54f" />
      ))}
    </g>
  );
}

// Conquered: the hex dims and its number disc lies face down.
function ConqueredHex({ board, hexId }: { board: BoardState; hexId: HexId }) {
  const hex = board.hexes[hexId]!;
  const { x, y } = hex.center;
  return (
    <g className="ba-conquered">
      <polygon points={hexPolygonPoints(board, hexId)} fill="#1b1410" fillOpacity={0.38} />
      {hex.numberToken !== null && (
        <g transform={`translate(${x}, ${y})`}>
          <circle r={17.5} fill="#6d4a2b" stroke="#2a1a0e" strokeWidth={1.6} />
          <circle r={13.5} fill="none" stroke="#a37a52" strokeWidth={1} strokeDasharray="2 2" />
          {/* Crossed axes */}
          <g stroke="#e9d8bd" strokeWidth={1.8} strokeLinecap="round">
            <line x1={-7} y1={-7} x2={7} y2={7} />
            <line x1={7} y1={-7} x2={-7} y2={7} />
          </g>
          <path d="M-7,-7 q-3.5,1 -3,4.5 q2.5,-0.5 4.5,-3 Z" fill="#e9d8bd" />
          <path d="M7,-7 q3.5,1 3,4.5 q-2.5,-0.5 -4.5,-3 Z" fill="#e9d8bd" />
        </g>
      )}
    </g>
  );
}

// Up to 3 barbarians: two flanking the number disc, the third below it.
const GROUP_OFFSETS: Array<[number, number]> = [
  [-27, 2],
  [27, 2],
  [0, 27],
];

function BarbarianGroup({ board, hexId, count }: { board: BoardState; hexId: HexId; count: number }) {
  const hex = board.hexes[hexId]!;
  return (
    <g className="ba-barbarians">
      {GROUP_OFFSETS.slice(0, Math.min(3, count)).map(([dx, dy], i) => (
        <BarbarianFigure key={i} x={hex.center.x + dx} y={hex.center.y + dy} scale={1.3} />
      ))}
    </g>
  );
}

// Grey barbarian with a horned helmet.
export function BarbarianFigure({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <ellipse cy={8.2} rx={6.4} ry={2} fill="#000" opacity={0.3} />
      <path d="M-6,8.5 Q-6.6,0 -3.4,-1.8 L3.4,-1.8 Q6.6,0 6,8.5 Z" fill="#8d9298" stroke="#25272b" strokeWidth={1} />
      <path d="M-3.2,2 L3.2,2" stroke="#5b6066" strokeWidth={1.1} />
      <circle cy={-5.2} r={3.7} fill="#9aa0a6" stroke="#25272b" strokeWidth={1} />
      <path d="M-3.4,-6.6 Q-6.8,-7.6 -6.6,-11.6 Q-4.8,-8.8 -2.2,-8.4 Z" fill="#efe6cf" stroke="#25272b" strokeWidth={0.7} />
      <path d="M3.4,-6.6 Q6.8,-7.6 6.6,-11.6 Q4.8,-8.8 2.2,-8.4 Z" fill="#efe6cf" stroke="#25272b" strokeWidth={0.7} />
      <rect x={-2.4} y={-5.6} width={4.8} height={1.1} rx={0.5} fill="#25272b" />
    </g>
  );
}

// Knights on edges, drawn above roads.
export function BarbarianAttackKnights({ game }: { game: GameState }) {
  const ba = game.barbarianAttack;
  if (!ba) return null;
  return (
    <g className="ba-knights" pointerEvents="none">
      {Object.entries(ba.knights).map(([edge, pid]) => {
        const e = game.board.edges[edge];
        const p = game.players.find((pl) => pl.id === pid);
        if (!e || !p) return null;
        const a = game.board.vertices[e.vertices[0]]!.position;
        const b = game.board.vertices[e.vertices[1]]!.position;
        return <KnightFigure key={edge} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} color={p.color} />;
      })}
    </g>
  );
}

// A standing knight: helmet, surcoat in the player's colour, white shield,
// lance. Upright regardless of the edge, so it never reads as a road.
export function KnightFigure({ x, y, color, scale = 1 }: { x: number; y: number; color: PlayerColor; scale?: number }) {
  const fill = PLAYER_COLOR_HEX[color];
  return (
    <g transform={`translate(${x}, ${y - 2}) scale(${scale})`}>
      <ellipse cy={8.4} rx={6.6} ry={2} fill="#000" opacity={0.32} />
      <line x1={6.6} y1={-13} x2={6.6} y2={8} stroke="#3a2a1a" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M6.6,-15.2 L8.3,-11.8 L4.9,-11.8 Z" fill="#d9d9d9" stroke="#3a2a1a" strokeWidth={0.5} />
      <path d="M-5.4,8.4 L-5.4,-0.6 Q-5.4,-3.8 -2.6,-4.4 L2.6,-4.4 Q5.4,-3.8 5.4,-0.6 L5.4,8.4 Z" fill={fill} stroke="#141414" strokeWidth={1.1} />
      <circle cy={-7.6} r={3.8} fill="#cfd3d6" stroke="#141414" strokeWidth={1} />
      <rect x={-2.8} y={-8.3} width={5.6} height={1.2} fill="#141414" />
      <path d="M-3.6,-1 h5.4 v3.4 q0,2.6 -2.7,3.6 q-2.7,-1 -2.7,-3.6 Z" fill="#f5f5f5" stroke="#141414" strokeWidth={0.7} />
      <path d="M-0.9,-0.4 v4.8 M-2.9,1.6 h4" stroke={fill} strokeWidth={1} />
    </g>
  );
}

// Edge id for direction d of a hex (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE).
export function hexEdgeAt(board: BoardState, hexId: HexId, d: number) {
  const c = board.hexes[hexId]!.corners;
  return edgeKey(c[d]!, c[(d + 1) % 6]!);
}
