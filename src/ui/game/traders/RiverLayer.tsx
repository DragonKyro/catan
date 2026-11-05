import type { BoardState, EdgeId, RiverPath } from '@/game/types';
import { getEdgeMidpoint, type Point } from '../boardLayout';

interface Props {
  board: BoardState;
  rivers: RiverPath[];
  // Bridge sites that nobody has bridged yet (drawn as a faint ford line so
  // players can see where roads are banned).
  openSites: EdgeId[];
}

// T&B Rivers of Catan: the two river tiles' water, drawn over the hex
// fills. Each river rises at a spring inside its mountain hex, meanders past
// the number disc of every hex it crosses (through the midpoint of each
// shared edge, where the bridge sites are), fans out into channels across
// the swamp and runs into the sea across the swamp's coastal edge. Pointer
// events off: it's decoration under the pieces and click ghosts.
export function RiverLayer({ board, rivers, openSites }: Props) {
  return (
    <g className="rivers" pointerEvents="none">
      {rivers.map((river, i) => (
        <River key={i} board={board} river={river} />
      ))}
      {openSites.map((eid) => (
        <BridgeSite key={eid} board={board} edge={eid} />
      ))}
    </g>
  );
}

function River({ board, river }: { board: BoardState; river: RiverPath }) {
  const hexes = river.hexes.map((id) => board.hexes[id]).filter((h) => h !== undefined);
  if (hexes.length === 0) return null;
  const crossings: Point[] = [];
  for (let i = 0; i + 1 < hexes.length; i++) {
    crossings.push(sharedEdgeMidpoint(board, hexes[i]!.id, hexes[i + 1]!.id));
  }
  const mouth = river.mouth ? getEdgeMidpoint(board, river.mouth) : null;

  const pts: Point[] = [];
  const first = hexes[0]!;
  const downstream0 = crossings[0] ?? mouth ?? first.center;
  const flow0 = unit(sub(downstream0, first.center));
  const side0 = perp(flow0);
  // Spring: upstream of the number disc, in the mountain's far half.
  const spring = add(first.center, add(scale(flow0, -27), scale(side0, 6)));
  pts.push(spring);
  hexes.forEach((hex, i) => {
    const entry = i === 0 ? spring : crossings[i - 1]!;
    const exit = crossings[i] ?? mouth ?? hex.center;
    const flow = unit(sub(exit, entry));
    // Meander past the disc, alternating sides hex by hex.
    const sideSign = i % 2 === 0 ? 1 : -1;
    pts.push(add(hex.center, scale(perp(flow), 23 * sideSign)));
    pts.push(exit);
  });
  let sea: Point | null = null;
  if (mouth) {
    const last = hexes[hexes.length - 1]!;
    sea = add(mouth, scale(unit(sub(mouth, last.center)), 16));
    pts.push(sea);
  }
  const d = smoothPath(pts);

  // Swamp delta: the last hex (a swamp) splits the river into channels.
  const swamp = hexes[hexes.length - 1]!;
  const swampEntry = crossings[crossings.length - 1] ?? spring;
  const swampExit = mouth ?? swamp.center;
  const channels = deltaChannels(swamp.center, swampEntry, swampExit);

  return (
    <g className="river">
      {swamp.terrain === 'swamp' && <SwampBed center={swamp.center} />}
      {/* Banks, water, glints. */}
      <path d={d} fill="none" stroke="#2f6f93" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <path d={d} fill="none" stroke="#69c1e6" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke="#e3f6ff"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeDasharray="5 9"
        opacity={0.9}
      />
      {swamp.terrain === 'swamp' &&
        channels.map((c, i) => (
          <g key={i}>
            <path d={c} fill="none" stroke="#2f6f93" strokeWidth={4.5} strokeLinecap="round" opacity={0.7} />
            <path d={c} fill="none" stroke="#7fcfee" strokeWidth={2.6} strokeLinecap="round" />
          </g>
        ))}
      {/* The spring: white water spilling out of the mountain. */}
      <circle cx={spring.x} cy={spring.y} r={5.2} fill="#69c1e6" stroke="#2f6f93" strokeWidth={1.6} />
      <circle cx={spring.x - 1.2} cy={spring.y - 1.2} r={2} fill="#f3fbff" />
      {sea && <circle cx={sea.x} cy={sea.y} r={4} fill="#9fdcf5" opacity={0.7} />}
    </g>
  );
}

// Mud islands and reed tufts across a swamp.
function SwampBed({ center }: { center: Point }) {
  const tufts: Array<[number, number]> = [
    [-24, -14],
    [-12, 22],
    [20, 18],
    [26, -8],
    [-2, -28],
    [-30, 8],
  ];
  return (
    <g>
      {tufts.map(([dx, dy], i) => (
        <g key={i} transform={`translate(${center.x + dx}, ${center.y + dy})`}>
          <ellipse rx={6.5} ry={3.4} fill="#6e5a2a" opacity={0.55} />
          <line x1={-1.5} y1={0} x2={-2.5} y2={-6} stroke="#2f3b17" strokeWidth={0.9} strokeLinecap="round" />
          <line x1={0.5} y1={0} x2={0.8} y2={-7.5} stroke="#2f3b17" strokeWidth={0.9} strokeLinecap="round" />
          <line x1={2.2} y1={0} x2={3.6} y2={-5.5} stroke="#2f3b17" strokeWidth={0.9} strokeLinecap="round" />
          <ellipse cx={0.8} cy={-8} rx={0.9} ry={1.8} fill="#4a3313" />
        </g>
      ))}
    </g>
  );
}

// An unbridged bridge site: a dotted ford line along the edge.
function BridgeSite({ board, edge }: { board: BoardState; edge: EdgeId }) {
  const e = board.edges[edge];
  if (!e) return null;
  const p1 = board.vertices[e.vertices[0]]!.position;
  const p2 = board.vertices[e.vertices[1]]!.position;
  return (
    <line
      className="bridge-site"
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke="#f4ead2"
      strokeWidth={2.2}
      strokeDasharray="2 4"
      strokeLinecap="round"
      opacity={0.85}
    />
  );
}

// Side channels across the swamp, fanning out from where the river enters
// and gathering again at the mouth.
function deltaChannels(center: Point, entry: Point, exit: Point): string[] {
  const flow = unit(sub(exit, entry));
  const side = perp(flow);
  const out: string[] = [];
  for (const [off, bend] of [
    [-20, -0.3],
    [17, 0.25],
    [-9, 0.55],
  ] as Array<[number, number]>) {
    const a = add(entry, scale(flow, 9));
    const mid = add(center, add(scale(side, off), scale(flow, bend * 12)));
    const b = add(exit, scale(flow, -7));
    out.push(smoothPath([a, mid, b]));
  }
  return out;
}

function sharedEdgeMidpoint(board: BoardState, a: string, b: string): Point {
  const ha = board.hexes[a]!;
  const hb = board.hexes[b]!;
  const common = ha.corners.filter((v) => hb.corners.includes(v));
  if (common.length === 2) {
    const p1 = board.vertices[common[0]!]!.position;
    const p2 = board.vertices[common[1]!]!.position;
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }
  return { x: (ha.center.x + hb.center.x) / 2, y: (ha.center.y + hb.center.y) / 2 };
}

// Catmull-Rom spline through the points, as cubic Bezier segments.
export function smoothPath(pts: Point[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]!.x},${pts[0]!.y}`;
  let d = `M${f(pts[0]!.x)},${f(pts[0]!.y)}`;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

const f = (n: number) => Math.round(n * 10) / 10;
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const unit = (a: Point): Point => {
  const m = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / m, y: a.y / m };
};
const perp = (a: Point): Point => ({ x: -a.y, y: a.x });
