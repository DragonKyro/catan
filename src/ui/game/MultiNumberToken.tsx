import { numberPips } from '@/game/board/hexNumbers';

interface Props {
  // Every number the hex produces on (see Hex.extraNumbers).
  numbers: number[];
  x: number;
  y: number;
}

// Number discs for a hex with several numbers (T&B: Rivers of Catan's 2 + 12
// hex, Fishing on Catan's lake printed 11 12 / 2 3). Two numbers sit side by
// side; four make a 2 x 2 grid with the high pair on top, as on the lake
// tile.
export function MultiNumberToken({ numbers, x, y }: Props) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const layout: Array<{ n: number; dx: number; dy: number }> =
    sorted.length === 4
      ? [
          { n: sorted[2]!, dx: -11.5, dy: -11 },
          { n: sorted[3]!, dx: 11.5, dy: -11 },
          { n: sorted[0]!, dx: -11.5, dy: 11 },
          { n: sorted[1]!, dx: 11.5, dy: 11 },
        ]
      : sorted
          .slice()
          .reverse()
          .map((n, i) => ({ n, dx: (i - (sorted.length - 1) / 2) * 25, dy: 0 }));
  const r = sorted.length === 4 ? 10.5 : 12.5;
  return (
    <g className="multi-number-token" transform={`translate(${x}, ${y})`}>
      {layout.map(({ n, dx, dy }) => {
        const hot = n === 6 || n === 8;
        const pips = numberPips(n);
        const ink = hot ? 'var(--token-hot)' : '#1a1a1a';
        return (
          <g key={n} transform={`translate(${dx}, ${dy})`}>
            <circle r={r} fill="var(--token-fill)" stroke="var(--token-edge)" strokeWidth={1.4} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              y={-2}
              fontSize={r > 11 ? 12.5 : 11}
              fontWeight={700}
              fill={ink}
            >
              {n}
            </text>
            <g transform={`translate(0, ${r * 0.55})`}>
              {Array.from({ length: pips }).map((_, i) => (
                <circle key={i} cx={(i - (pips - 1) / 2) * 2.3} cy={0} r={0.8} fill={ink} />
              ))}
            </g>
          </g>
        );
      })}
    </g>
  );
}
