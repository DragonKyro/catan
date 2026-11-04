import type { Hex } from '@/game/types';

// Pointy-top hexagon points around (cx, cy) with circumradius r.
function hexPoints(cx: number, cy: number, r: number): string {
  const out: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 90) * Math.PI) / 180;
    out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}

// T&B Fishing on Catan lake tile: a grassy shore around open water with
// ripples, reeds and a fish. The four printed numbers (2 / 3 / 11 / 12) are
// drawn on top by HexTile (MultiNumberToken).
export function LakeArt({ hex }: { hex: Hex }) {
  const { x, y } = hex.center;
  return (
    <g className="hex-texture lake-art" pointerEvents="none">
      <polygon points={hexPoints(x, y, 47)} fill="#7fa35a" opacity={0.95} />
      <ellipse cx={x} cy={y} rx={37} ry={35} fill="#2f80ad" stroke="#e8f6fb" strokeWidth={1.6} />
      <ellipse cx={x - 3} cy={y - 3} rx={29} ry={27} fill="#3d94c2" opacity={0.8} />
      {[
        [-20, -24, 9],
        [18, 25, 8],
        [-27, 16, 6],
      ].map(([dx, dy, w], i) => (
        <path
          key={i}
          d={`M${x + dx! - w!},${y + dy!} q${w},-3.5 ${w! * 2},0`}
          fill="none"
          stroke="#d9f1fb"
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.8}
        />
      ))}
      {[
        [-34, -6],
        [33, -12],
        [4, 37],
      ].map(([dx, dy], i) => (
        <g key={i} transform={`translate(${x + dx!}, ${y + dy!})`}>
          <line x1={-1.5} y1={2} x2={-2.6} y2={-5} stroke="#2f4a1c" strokeWidth={0.9} strokeLinecap="round" />
          <line x1={0.6} y1={2} x2={0.9} y2={-6.5} stroke="#2f4a1c" strokeWidth={0.9} strokeLinecap="round" />
          <ellipse cx={0.9} cy={-7} rx={0.9} ry={1.7} fill="#5a3a16" />
        </g>
      ))}
      <g transform={`translate(${x + 24}, ${y + 3}) rotate(-20)`} opacity={0.8}>
        <path d="M-4,0 Q-1.5,-2.6 3,-1 Q4.6,0 3,1 Q-1.5,2.6 -4,0 Z" fill="#d9f1fb" />
        <path d="M-4,0 L-6.5,-2 L-6.5,2 Z" fill="#d9f1fb" />
      </g>
    </g>
  );
}
