import { useState } from 'react';
import type { Player, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import type { MatchStats, TimelineSnapshot } from '@/store/logStore';
import { playerColorVar } from '@/ui/shared/playerColors';
import { RESOURCE_ICON, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';
import './MatchGraph.css';

type Metric = 'vp' | 'gainedTotal' | 'handTotal';

const PLAYER_METRIC_LABEL: Record<Metric, string> = {
  vp: 'Victory points',
  gainedTotal: 'Resources earned',
  handTotal: 'Resources in hand',
};

type Tab = Metric | 'rolls' | 'circulation';

const TAB_LABEL: Record<Tab, string> = {
  vp: 'Victory points',
  gainedTotal: 'Resources earned',
  handTotal: 'Resources in hand',
  rolls: 'Dice frequency',
  circulation: 'Resource circulation',
};

interface Props {
  players: Player[];
  timeline: TimelineSnapshot[];
  stats: MatchStats;
}

const W = 520;
const H = 200;
const PAD_L = 28;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 22;

export function MatchGraph({ players, timeline, stats }: Props) {
  const [tab, setTab] = useState<Tab>('vp');

  const tabs: Tab[] = ['vp', 'gainedTotal', 'handTotal', 'rolls', 'circulation'];

  return (
    <div className="mgraph">
      <div className="mgraph-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`mgraph-tab ${tab === t ? 'is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {(tab === 'vp' || tab === 'gainedTotal' || tab === 'handTotal') && (
        <LineChart
          players={players}
          timeline={timeline}
          metric={tab}
          label={PLAYER_METRIC_LABEL[tab]}
        />
      )}
      {tab === 'rolls' && <RollFrequencyChart rollCounts={stats.rollCounts} />}
      {tab === 'circulation' && (
        <CirculationChart circulation={stats.resourcesInCirculation} />
      )}

      {(tab === 'vp' || tab === 'gainedTotal' || tab === 'handTotal') && (
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
      )}
    </div>
  );
}

function LineChart({
  players,
  timeline,
  metric,
  label,
}: {
  players: Player[];
  timeline: TimelineSnapshot[];
  metric: Metric;
  label: string;
}) {
  if (timeline.length === 0) {
    return <div className="mgraph-empty">No game data to graph.</div>;
  }

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

  const lines = players.map((p) => {
    const pts: string[] = [];
    pts.push(`M ${xOf(0)} ${yOf(0)}`);
    for (const snap of timeline) {
      const v = snap.perPlayer[p.id]?.[metric] ?? 0;
      pts.push(`L ${xOf(snap.step)} ${yOf(v)}`);
    }
    return { player: p, d: pts.join(' ') };
  });

  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) yTicks.push(Math.round((yMax * i) / 4));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mgraph-svg"
      preserveAspectRatio="xMidYMid meet"
      aria-label={label}
    >
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
      <line
        x1={PAD_L}
        x2={W - PAD_R}
        y1={H - PAD_B}
        y2={H - PAD_B}
        className="mgraph-axis"
      />
      <text x={W / 2} y={H - 6} textAnchor="middle" className="mgraph-axislabel">
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
  );
}

function RollFrequencyChart({
  rollCounts,
}: {
  rollCounts: Record<number, number>;
}) {
  const totals = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  let max = 1;
  let grand = 0;
  for (const n of totals) {
    const c = rollCounts[n] ?? 0;
    if (c > max) max = c;
    grand += c;
  }
  if (grand === 0) {
    return <div className="mgraph-empty">No dice rolled yet.</div>;
  }
  // Expected probability of each total (2d6).
  const probFor: Record<number, number> = {
    2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
  };

  const barW = (W - PAD_L - PAD_R) / totals.length;
  const yOf = (v: number) =>
    H - PAD_B - ((v / max) * (H - PAD_T - PAD_B));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mgraph-svg"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Dice roll frequency"
    >
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const tv = Math.round(max * f);
        return (
          <g key={i}>
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
        );
      })}
      {/* Bars */}
      {totals.map((n, i) => {
        const c = rollCounts[n] ?? 0;
        const x = PAD_L + i * barW + 3;
        const y = yOf(c);
        const w = barW - 6;
        const h = H - PAD_B - y;
        const expected = (probFor[n] / 36) * grand;
        return (
          <g key={n}>
            <rect
              x={x}
              y={y}
              width={w}
              height={Math.max(0, h)}
              className={n === 7 ? 'mgraph-bar mgraph-bar-seven' : 'mgraph-bar'}
            >
              <title>
                {n}: rolled {c}× (expected ~{expected.toFixed(1)})
              </title>
            </rect>
            {/* Expected line */}
            <line
              x1={x - 1}
              x2={x + w + 1}
              y1={yOf(expected)}
              y2={yOf(expected)}
              className="mgraph-expected"
            />
            <text
              x={x + w / 2}
              y={H - PAD_B + 12}
              textAnchor="middle"
              className="mgraph-tick"
            >
              {n}
            </text>
          </g>
        );
      })}
      <line
        x1={PAD_L}
        x2={W - PAD_R}
        y1={H - PAD_B}
        y2={H - PAD_B}
        className="mgraph-axis"
      />
    </svg>
  );
}

function CirculationChart({
  circulation,
}: {
  circulation: Record<Resource, number>;
}) {
  const resources: Resource[] = [...RESOURCES];
  let max = 1;
  let total = 0;
  for (const r of resources) {
    const c = circulation[r] ?? 0;
    if (c > max) max = c;
    total += c;
  }
  if (total === 0) {
    return (
      <div className="mgraph-empty">No resources have entered circulation yet.</div>
    );
  }
  const barW = (W - PAD_L - PAD_R) / resources.length;
  const yOf = (v: number) =>
    H - PAD_B - ((v / max) * (H - PAD_T - PAD_B));

  const colorFor: Record<Resource, string> = {
    wood: 'var(--terrain-wood)',
    brick: 'var(--terrain-brick)',
    sheep: 'var(--terrain-sheep)',
    wheat: 'var(--terrain-wheat)',
    ore: 'var(--terrain-ore)',
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mgraph-svg"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Cumulative resources in circulation"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const tv = Math.round(max * f);
        return (
          <g key={i}>
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
        );
      })}
      {resources.map((r, i) => {
        const c = circulation[r] ?? 0;
        const x = PAD_L + i * barW + 6;
        const y = yOf(c);
        const w = barW - 12;
        const h = H - PAD_B - y;
        return (
          <g key={r}>
            <rect
              x={x}
              y={y}
              width={w}
              height={Math.max(0, h)}
              fill={colorFor[r]}
              stroke="#1a1a1a"
              strokeWidth={1}
              rx={2}
            >
              <title>
                {RESOURCE_LABEL[r]}: {c} produced
              </title>
            </rect>
            <text
              x={x + w / 2}
              y={H - PAD_B + 14}
              textAnchor="middle"
              className="mgraph-tick"
              fontSize="13"
            >
              {RESOURCE_ICON[r]}
            </text>
            <text
              x={x + w / 2}
              y={y - 4}
              textAnchor="middle"
              className="mgraph-tick"
              fontWeight="700"
              fill="var(--text)"
            >
              {c}
            </text>
          </g>
        );
      })}
      <line
        x1={PAD_L}
        x2={W - PAD_R}
        y1={H - PAD_B}
        y2={H - PAD_B}
        className="mgraph-axis"
      />
    </svg>
  );
}
