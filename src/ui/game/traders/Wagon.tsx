import type { BoardState, EdgeId, VertexId } from '@/game/types';

interface Props {
  board: BoardState;
  edge: EdgeId;
  // The intersection the wagon faces (its train's front when placed).
  // Without one the wagon faces the edge's second vertex.
  front?: VertexId;
  // Ghost rendering for the voting round's candidate spots.
  ghost?: boolean;
  // Highlight (hovered spot).
  active?: boolean;
  // Letter tag drawn over a ghost (voting locations).
  tag?: string;
  // Where along the edge to centre the wagon (0..1 toward `front`); two
  // candidate spots sharing an edge sit side by side.
  at?: number;
}

// Placement of a wagon along its edge: the centre point, the unit vector
// toward the front, and whether the side view must be flipped so the wheels
// stay at the bottom.
export function wagonFrame(
  board: BoardState,
  edge: EdgeId,
  front: VertexId | undefined,
  at = 0.5,
) {
  const e = board.edges[edge]!;
  const [a, b] = front === e.vertices[0] ? [e.vertices[1], e.vertices[0]] : [e.vertices[0], e.vertices[1]];
  const p1 = board.vertices[a]!.position;
  const p2 = board.vertices[b]!.position;
  const x = p1.x + (p2.x - p1.x) * at;
  const y = p1.y + (p2.y - p1.y) * at;
  const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  return { x, y, angle, flip: Math.abs(angle) > 90 };
}

// A merchant-train wagon (Merchant Trains): a neutral grey piece drawn side
// on, nose toward the front of its train — a raised cab and a drawbar at
// the front, the cargo box behind — so a string of wagons reads nose to
// tail and you can tell which way a train runs. Sits on top of roads, a
// little shorter than an edge, so the road colour still shows at both ends.
export function Wagon({ board, edge, front, ghost, active, tag, at }: Props) {
  if (!board.edges[edge]) return null;
  const f = wagonFrame(board, edge, front, at);
  const body = ghost ? (active ? '#f4e7b5' : '#e9e9e9') : '#8b8f94';
  const cab = ghost ? (active ? '#fff6cf' : '#f4f4f4') : '#b6babf';
  const line = ghost ? '#3b3b3b' : '#1c1c1c';
  return (
    <g
      className={ghost ? 'wagon wagon-ghost' : 'wagon'}
      transform={`translate(${f.x}, ${f.y})`}
      pointerEvents="none"
      opacity={ghost ? (active ? 0.95 : 0.78) : 1}
    >
      <g transform={`rotate(${f.angle}) scale(1, ${f.flip ? -1 : 1})`}>
        {/* drawbar at the nose */}
        <line x1={9} y1={2.6} x2={14.5} y2={2.6} stroke={line} strokeWidth={1.6} strokeLinecap="round" />
        {/* cargo box (tail) */}
        <rect
          x={-12}
          y={-4.2}
          width={14}
          height={8.4}
          rx={1.4}
          fill={body}
          stroke={line}
          strokeWidth={1.1}
          strokeDasharray={ghost ? '2 1.4' : undefined}
        />
        {/* slats */}
        {!ghost && (
          <path d="M-7.5,-4 V4 M-3,-4 V4" stroke="#6c7075" strokeWidth={0.7} />
        )}
        {/* raised cab (front) */}
        <path
          d="M1.6,4.2 V-6.6 Q1.6,-7.6 2.6,-7.6 H7.6 Q10,-7.6 10,-5.2 V4.2 Z"
          fill={cab}
          stroke={line}
          strokeWidth={1.1}
          strokeLinejoin="round"
          strokeDasharray={ghost ? '2 1.4' : undefined}
        />
        <rect x={4} y={-5.8} width={4.2} height={3.2} rx={0.6} fill={ghost ? '#cfd8df' : '#6f8796'} />
        {/* wheels */}
        <circle cx={-8} cy={4.4} r={2.5} fill={line} />
        <circle cx={5.5} cy={4.4} r={2.5} fill={line} />
        <circle cx={-8} cy={4.4} r={0.8} fill="#d8d8d8" />
        <circle cx={5.5} cy={4.4} r={0.8} fill="#d8d8d8" />
      </g>
      {tag && (
        <g transform="translate(0, -12)">
          <circle r={6.4} fill={active ? '#f2b705' : '#1f2933'} stroke="#fff" strokeWidth={1.3} />
          <text
            y={2.6}
            textAnchor="middle"
            fontSize={8}
            fontWeight={800}
            fill={active ? '#1f2933' : '#fff'}
          >
            {tag}
          </text>
        </g>
      )}
    </g>
  );
}
