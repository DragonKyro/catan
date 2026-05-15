import { useState } from 'react';
import type { Player } from '@/game/types';
import type { TimelineSnapshot } from '@/store/logStore';
import { playerColorVar } from '@/ui/shared/playerColors';
import './MatchGraph.css';

type Metric = 'vp' | 'gainedTotal' | 'handTotal';

const METRIC_LABEL: Record<Metric, string> = {
  vp: 'Victory points',
  gainedTotal: 'Total resources produced',
  handTotal: 'Resources in hand',
};

interface Props {
  players: Player[];
  timeline: TimelineSnapshot[];
}

const W = 520;
const H = 200;
const PAD_L = 28;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 20;

export function MatchGraph({ players, timeline }: Props) {
  const [metric, setMetric] = useState<Metric>('vp');

  if (timeline.length === 0) {
    return <div className="mgraph-empty">No game data to graph.</div>;
  }

  // Determine y-axis range
  let yMax = 1;
  for (const snap of timeline) {
    for (const p of players) {
      const v = snap.perPlayer[p.id]?.[metric] ?? 0;
      if (v > yMax) yMax = v;
    }
  }
  yMax = Math.ceil(yMax * 1.1);

  const xMax = timeline[timeline.length - 1]!.step;

  const xOf = (step: number) =>
    PAD_L + ((step / Math.max(1, xMax)) * (W - PAD_L - PAD_R));
  const yOf = (v: number) =>
    H - PAD_B - ((v / yMax) * (H - PAD_T - PAD_B));

  // Build path for each player
  const lines = players.map((p) => {
    const pts: string[] = [];
    // Start each line at (0,0) so the graph reads from game start.
    pts.push(`M ${xOf(0)} ${yOf(0)}`);
    for (const snap of timeline) {
      const v = snap.perPlayer[p.id]?.[metric] ?? 0;
      pts.push(`L ${xOf(snap.step)} ${yOf(v)}`);
    }
    return { player: p, d: pts.join(' ') };
  });

  // Y-axis ticks
  const yTicks: number[] = [];
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(Math.round((yMax * i) / tickCount));
  }

  return (
    <div className="mgraph">
      <div className="mgraph-tabs" role="tablist">
        {(['vp', 'gainedTotal', 'handTotal'] as Metric[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={metric === m}
            className={`mgraph-tab ${metric === m ? 'is-active' : ''}`}
            onClick={() => setMetric(m)}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mgraph-svg"
        preserveAspectRatio="xMidYMid meet"
        aria-label={METRIC_LABEL[metric]}
      >
        {/* y-axis ticks + grid */}
        {yTicks.map((tv) => (
          <g key={tv}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yOf(tv)}
              y2={yOf(tv)}
              className="mgraph-grid"
            />
            <text
              x={PAD_L - 4}
              y={yOf(tv) + 3}
              textAnchor="end"
              className="mgraph-tick"
            >
              {tv}
            </text>
          </g>
        ))}
        {/* x-axis */}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={H - PAD_B}
          y2={H - PAD_B}
          className="mgraph-axis"
        />
        <text x={W / 2} y={H - 4} textAnchor="middle" className="mgraph-axislabel">
          turns →
        </text>
        {lines.map(({ player, d }) => (
          <path
            key={player.id}
            d={d}
            stroke={playerColorVar(player.color)}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="mgraph-legend">
        {players.map((p) => (
          <span key={p.id} className="mgraph-legend-item">
            <span
              className="mgraph-legend-swatch"
              style={{ background: playerColorVar(p.color) }}
            />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
