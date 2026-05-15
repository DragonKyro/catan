import { useRef, useState } from 'react';
import type { Player, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import type { MatchStats, TimelineSnapshot } from '@/store/logStore';
import { playerColorVar } from '@/ui/shared/playerColors';
import { RESOURCE_ICON, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';
import './MatchGraph.css';

// Top-level tabs. Compound tabs (resources / production / bonus / trades /
// robber) carry a sub-selector that picks between the metrics inside them.
type Tab =
  | 'vp'
  | 'resources'
  | 'byPlayer'
  | 'byResource'
  | 'production'
  | 'bonus'
  | 'trades'
  | 'robber'
  | 'time'
  | 'gameStats';

const TAB_LABEL: Record<Tab, string> = {
  vp: 'Victory points',
  resources: 'Resources',
  byPlayer: 'By player',
  byResource: 'By resource',
  production: 'Production',
  bonus: 'Bonus race',
  trades: 'Trades',
  robber: 'Robber',
  time: 'Player time',
  gameStats: 'Game stats',
};

type ResourcesSub = 'earned' | 'hand';
// Production: a single dropdown — 'all' shows the total; any Resource shows
// that resource's production line per player.
type ProductionSub = 'all' | Resource;
type BonusSub = 'knights' | 'longestRoad' | 'devCardsBought';
type TradesSub = 'count' | 'efficiency';
type RobberSub = 'discards' | 'stealBalance' | 'blockedByRobber';
type GameStatsSub = 'rolls' | 'circulation';

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

const RESOURCE_COLOR: Record<Resource, string> = {
  wood: 'var(--terrain-wood)',
  brick: 'var(--terrain-brick)',
  sheep: 'var(--terrain-sheep)',
  wheat: 'var(--terrain-wheat)',
  ore: 'var(--terrain-ore)',
};

interface Series {
  id: string;
  label: string;
  color: string;
  valueAt: (snap: TimelineSnapshot) => number;
}

export function MatchGraph({ players, timeline, stats }: Props) {
  const [tab, setTab] = useState<Tab>('vp');
  const [byPlayerId, setByPlayerId] = useState<string>(players[0]?.id ?? '');
  const [byResource, setByResource] = useState<Resource>('wood');
  const [resourcesSub, setResourcesSub] = useState<ResourcesSub>('earned');
  const [productionSub, setProductionSub] = useState<ProductionSub>('all');
  const [bonusSub, setBonusSub] = useState<BonusSub>('knights');
  const [tradesSub, setTradesSub] = useState<TradesSub>('count');
  const [robberSub, setRobberSub] = useState<RobberSub>('discards');
  const [gameStatsSub, setGameStatsSub] = useState<GameStatsSub>('rolls');

  const tabs: Tab[] = [
    'vp',
    'resources',
    'byPlayer',
    'byResource',
    'production',
    'bonus',
    'trades',
    'robber',
    'time',
    'gameStats',
  ];

  const perPlayerSeries = (extract: (snap: TimelineSnapshot, pid: string) => number): Series[] =>
    players.map((p) => ({
      id: p.id,
      label: p.name,
      color: playerColorVar(p.color),
      valueAt: (snap) => extract(snap, p.id),
    }));

  let chart: React.ReactNode = null;
  let legend: React.ReactNode = null;
  let subSelector: React.ReactNode = null;

  if (tab === 'vp') {
    const series = perPlayerSeries((s, pid) => s.perPlayer[pid]?.vp ?? 0);
    chart = <MultiLineChart series={series} timeline={timeline} label={TAB_LABEL.vp} />;
    legend = <SeriesLegend series={series} />;
  } else if (tab === 'resources') {
    const extract: (snap: TimelineSnapshot, pid: string) => number =
      resourcesSub === 'earned'
        ? (s, pid) => s.perPlayer[pid]?.gainedTotal ?? 0
        : (s, pid) => s.perPlayer[pid]?.handTotal ?? 0;
    const label = resourcesSub === 'earned' ? 'Resources earned' : 'Resources in hand';
    const series = perPlayerSeries(extract);
    chart = <MultiLineChart series={series} timeline={timeline} label={label} />;
    legend = <SeriesLegend series={series} />;
    subSelector = (
      <SubSelector
        label="View"
        value={resourcesSub}
        onChange={(v) => setResourcesSub(v as ResourcesSub)}
        options={[
          { value: 'earned', label: 'Earned' },
          { value: 'hand', label: 'In hand' },
        ]}
      />
    );
  } else if (tab === 'byPlayer') {
    const series: Series[] = RESOURCES.map((r) => ({
      id: r,
      label: RESOURCE_LABEL[r],
      color: RESOURCE_COLOR[r],
      valueAt: (snap) => snap.perPlayer[byPlayerId]?.gainedByResource?.[r] ?? 0,
    }));
    chart = (
      <MultiLineChart
        series={series}
        timeline={timeline}
        label={`Resources earned by ${players.find((p) => p.id === byPlayerId)?.name ?? '?'}`}
      />
    );
    legend = (
      <SeriesLegend
        series={series.map((s, i) => ({
          ...s,
          label: `${RESOURCE_ICON[RESOURCES[i]!]} ${s.label}`,
        }))}
      />
    );
    subSelector = (
      <div className="mgraph-subselector">
        <label>
          Player:&nbsp;
          <select value={byPlayerId} onChange={(e) => setByPlayerId(e.target.value)}>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  } else if (tab === 'byResource') {
    const series = perPlayerSeries(
      (s, pid) => s.perPlayer[pid]?.gainedByResource?.[byResource] ?? 0,
    );
    chart = (
      <MultiLineChart
        series={series}
        timeline={timeline}
        label={`${RESOURCE_LABEL[byResource]} earned per player`}
      />
    );
    legend = <SeriesLegend series={series} />;
    subSelector = (
      <div className="mgraph-subselector">
        <label>
          Resource:&nbsp;
          <select
            value={byResource}
            onChange={(e) => setByResource(e.target.value as Resource)}
          >
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {RESOURCE_ICON[r]} {RESOURCE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  } else if (tab === 'production') {
    if (productionSub === 'all') {
      const series = perPlayerSeries((s, pid) => {
        const m = s.perPlayer[pid]?.expectedPipsByResource;
        if (!m) return 0;
        let total = 0;
        for (const r of RESOURCES) total += m[r] ?? 0;
        return total;
      });
      chart = (
        <MultiLineChart series={series} timeline={timeline} label="Expected production (total)" />
      );
      legend = <SeriesLegend series={series} />;
    } else {
      const r = productionSub;
      const series = perPlayerSeries(
        (s, pid) => s.perPlayer[pid]?.expectedPipsByResource?.[r] ?? 0,
      );
      chart = (
        <MultiLineChart
          series={series}
          timeline={timeline}
          label={`Expected ${RESOURCE_LABEL[r]} production`}
        />
      );
      legend = <SeriesLegend series={series} />;
    }
    subSelector = (
      <SubSelector
        label="Resource"
        value={productionSub}
        onChange={(v) => setProductionSub(v as ProductionSub)}
        options={[
          { value: 'all', label: 'All' },
          ...RESOURCES.map((r) => ({
            value: r,
            label: `${RESOURCE_ICON[r]} ${RESOURCE_LABEL[r]}`,
          })),
        ]}
      />
    );
  } else if (tab === 'bonus') {
    const extract: (snap: TimelineSnapshot, pid: string) => number =
      bonusSub === 'knights'
        ? (s, pid) => s.perPlayer[pid]?.knightsPlayed ?? 0
        : bonusSub === 'longestRoad'
          ? (s, pid) => s.perPlayer[pid]?.longestRoadLength ?? 0
          : (s, pid) => s.perPlayer[pid]?.devCardsBought ?? 0;
    const label =
      bonusSub === 'knights'
        ? 'Knights played'
        : bonusSub === 'longestRoad'
          ? 'Longest road'
          : 'Dev cards bought';
    const series = perPlayerSeries(extract);
    chart = <MultiLineChart series={series} timeline={timeline} label={label} />;
    legend = <SeriesLegend series={series} />;
    subSelector = (
      <SubSelector
        label="Metric"
        value={bonusSub}
        onChange={(v) => setBonusSub(v as BonusSub)}
        options={[
          { value: 'knights', label: 'Knights played' },
          { value: 'longestRoad', label: 'Longest road' },
          { value: 'devCardsBought', label: 'Dev cards bought' },
        ]}
      />
    );
  } else if (tab === 'trades') {
    const extract: (snap: TimelineSnapshot, pid: string) => number =
      tradesSub === 'count'
        ? (s, pid) => s.perPlayer[pid]?.tradesCount ?? 0
        : (s, pid) => {
            const tp = s.perPlayer[pid];
            if (!tp || tp.tradesGiven <= 0) return 0;
            return tp.tradesReceived / tp.tradesGiven;
          };
    const label = tradesSub === 'count' ? 'Trades' : 'Trade efficiency';
    const series = perPlayerSeries(extract);
    chart = <MultiLineChart series={series} timeline={timeline} label={label} />;
    legend = <SeriesLegend series={series} />;
    subSelector = (
      <SubSelector
        label="Metric"
        value={tradesSub}
        onChange={(v) => setTradesSub(v as TradesSub)}
        options={[
          { value: 'count', label: 'Count' },
          { value: 'efficiency', label: 'Efficiency' },
        ]}
      />
    );
  } else if (tab === 'robber') {
    const extract: (snap: TimelineSnapshot, pid: string) => number =
      robberSub === 'discards'
        ? (s, pid) => s.perPlayer[pid]?.discardedTo7 ?? 0
        : robberSub === 'stealBalance'
          ? (s, pid) => s.perPlayer[pid]?.stealBalance ?? 0
          : (s, pid) => s.perPlayer[pid]?.blockedByRobber ?? 0;
    const label =
      robberSub === 'discards'
        ? 'Cards discarded (7s)'
        : robberSub === 'stealBalance'
          ? 'Net steal balance'
          : 'Blocked by robber';
    const series = perPlayerSeries(extract);
    chart = <MultiLineChart series={series} timeline={timeline} label={label} />;
    legend = <SeriesLegend series={series} />;
    subSelector = (
      <SubSelector
        label="Metric"
        value={robberSub}
        onChange={(v) => setRobberSub(v as RobberSub)}
        options={[
          { value: 'discards', label: 'Cards discarded (7s)' },
          { value: 'stealBalance', label: 'Net steal balance' },
          { value: 'blockedByRobber', label: 'Blocked by robber' },
        ]}
      />
    );
  } else if (tab === 'time') {
    // Cumulative time per player in seconds. Y-axis units are seconds so
    // the numbers stay readable for typical game lengths.
    const series = perPlayerSeries(
      (s, pid) => (s.perPlayer[pid]?.playerTimeMs ?? 0) / 1000,
    );
    chart = (
      <MultiLineChart series={series} timeline={timeline} label="Cumulative time per player (s)" />
    );
    legend = <SeriesLegend series={series} />;
  } else if (tab === 'gameStats') {
    chart =
      gameStatsSub === 'rolls' ? (
        <RollFrequencyChart rollCounts={stats.rollCounts} />
      ) : (
        <CirculationChart circulation={stats.resourcesInCirculation} />
      );
    subSelector = (
      <SubSelector
        label="View"
        value={gameStatsSub}
        onChange={(v) => setGameStatsSub(v as GameStatsSub)}
        options={[
          { value: 'rolls', label: 'Dice frequency' },
          { value: 'circulation', label: 'Resource circulation' },
        ]}
      />
    );
  }

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
      {subSelector}
      {chart}
      {legend}
    </div>
  );
}

function SubSelector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="mgraph-subselector">
      <SubSelectorInline label={label} value={value} onChange={onChange} options={options} />
    </div>
  );
}

function SubSelectorInline({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      {label}:&nbsp;
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SeriesLegend({ series }: { series: Series[] }) {
  return (
    <div className="mgraph-legend">
      {series.map((s) => (
        <span key={s.id} className="mgraph-legend-item">
          <span className="mgraph-legend-swatch" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// Snap yMax up to a round number and produce tick values that are all
// distinct. Tries to land on a stride of 1/2/5/10/20/25/50/100/...
function niceYTicks(yMaxRaw: number): { yMax: number; yTicks: number[] } {
  if (yMaxRaw <= 0) return { yMax: 1, yTicks: [0, 1] };
  // Pick a stride from a nice-number sequence, then round yMax up to a
  // multiple of stride * 4 (so we get ~5 ticks total).
  const niceStrides = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  let stride = 1;
  for (const s of niceStrides) {
    if (yMaxRaw / s <= 5) {
      stride = s;
      break;
    }
    stride = s;
  }
  // For small ratios (e.g. tradeEfficiency), allow fractional strides.
  if (yMaxRaw < 1) {
    return {
      yMax: 1,
      yTicks: [0, 0.25, 0.5, 0.75, 1],
    };
  }
  const yMax = Math.ceil(yMaxRaw / stride) * stride;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += stride) ticks.push(v);
  return { yMax, yTicks: ticks };
}

function MultiLineChart({
  series,
  timeline,
  label,
}: {
  series: Series[];
  timeline: TimelineSnapshot[];
  label: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (timeline.length === 0) {
    return <div className="mgraph-empty">No game data to graph.</div>;
  }

  let yMaxRaw = 1;
  for (const snap of timeline) {
    for (const s of series) {
      const v = s.valueAt(snap);
      if (v > yMaxRaw) yMaxRaw = v;
    }
  }
  // Snap yMax up to a "nice" round number so y-axis ticks are clean
  // integers (e.g. yMax=4 → ticks [0,1,2,3,4]; yMax=14 → ticks [0,5,10,15]).
  // This also prevents the "duplicate tick labels" effect we'd get when
  // Math.round((yMax * i) / 4) collapses two adjacent ticks to the same
  // integer (e.g. yMax=3 → ticks [0,1,2,2,3]).
  const { yMax, yTicks } = niceYTicks(yMaxRaw);

  const xMax = timeline[timeline.length - 1]!.step;
  const xOf = (step: number) =>
    PAD_L + (step / Math.max(1, xMax)) * (W - PAD_L - PAD_R);
  const yOf = (v: number) => H - PAD_B - (v / yMax) * (H - PAD_T - PAD_B);

  const lines = series.map((s) => {
    const pts: string[] = [];
    pts.push(`M ${xOf(0)} ${yOf(0)}`);
    for (const snap of timeline) {
      pts.push(`L ${xOf(snap.step)} ${yOf(s.valueAt(snap))}`);
    }
    return { series: s, d: pts.join(' ') };
  });

  // X-axis turn labels: tick the timeline indices where turnNumber
  // changes. With many turns we'd overlap labels, so thin out evenly.
  const turnTicks: Array<{ step: number; turn: number }> = [];
  let lastTurn = -1;
  for (const snap of timeline) {
    if (snap.turnNumber !== lastTurn && snap.turnNumber > 0) {
      turnTicks.push({ step: snap.step, turn: snap.turnNumber });
      lastTurn = snap.turnNumber;
    }
  }
  // Aim for ~10 visible turn labels max.
  const turnStride = Math.max(1, Math.ceil(turnTicks.length / 10));
  const visibleTurnTicks = turnTicks.filter((_, i) => i % turnStride === 0);

  // Convert a screen-space mouse event to the closest timeline index by
  // translating into viewBox coordinates and snapping to the nearest step.
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const vbX = (e.clientX - rect.left) * scaleX;
    if (vbX < PAD_L || vbX > W - PAD_R) {
      setHoverIdx(null);
      return;
    }
    // step ≈ ((vbX - PAD_L) / chartWidth) * xMax; then snap to nearest timeline index
    const stepGuess = ((vbX - PAD_L) / (W - PAD_L - PAD_R)) * xMax;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < timeline.length; i++) {
      const d = Math.abs(timeline[i]!.step - stepGuess);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  };
  const onLeave = () => setHoverIdx(null);

  const hovered = hoverIdx != null ? timeline[hoverIdx] : null;
  const hoverX = hovered ? xOf(hovered.step) : 0;
  // Tooltip anchored at the crosshair; flip to left of the line if near
  // the right edge so it doesn't get clipped. Width slightly wider now
  // that the header is "Turn N · step M" instead of just "step M".
  const TOOLTIP_W = 150;
  const tooltipOnRight = hoverX < W - TOOLTIP_W - 10;

  return (
    <div className="mgraph-svg-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mgraph-svg"
        preserveAspectRatio="xMidYMid meet"
        aria-label={label}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
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
        {/* Turn-number ticks along the x-axis. */}
        {visibleTurnTicks.map((tt) => (
          <g key={`turn-${tt.turn}`}>
            <line
              x1={xOf(tt.step)}
              x2={xOf(tt.step)}
              y1={H - PAD_B}
              y2={H - PAD_B + 3}
              className="mgraph-axis"
            />
            <text
              x={xOf(tt.step)}
              y={H - PAD_B + 12}
              textAnchor="middle"
              className="mgraph-tick"
            >
              {tt.turn}
            </text>
          </g>
        ))}
        <text x={W / 2} y={H - 4} textAnchor="middle" className="mgraph-axislabel">
          turn →
        </text>
        {lines.map(({ series: s, d }) => (
          <path
            key={s.id}
            d={d}
            stroke={s.color}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
        ))}
        {/* Crosshair + per-series markers at the hovered step */}
        {hovered && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD_T}
              y2={H - PAD_B}
              className="mgraph-crosshair"
            />
            {series.map((s) => {
              const v = s.valueAt(hovered);
              return (
                <circle
                  key={s.id}
                  cx={hoverX}
                  cy={yOf(v)}
                  r={3.5}
                  fill={s.color}
                  stroke="#1a1a1a"
                  strokeWidth={1}
                />
              );
            })}
            <g
              transform={`translate(${
                tooltipOnRight ? hoverX + 8 : hoverX - 8
              }, ${PAD_T + 4})`}
            >
              <rect
                x={tooltipOnRight ? 0 : -TOOLTIP_W}
                y={0}
                width={TOOLTIP_W}
                height={Math.max(28, 14 + series.length * 12)}
                className="mgraph-tooltip-bg"
                rx={4}
              />
              <text
                x={tooltipOnRight ? 6 : -(TOOLTIP_W - 6)}
                y={12}
                className="mgraph-tooltip-head"
              >
                Turn {hovered.turnNumber || '—'} · step {hovered.step}
              </text>
              {series.map((s, i) => {
                const v = s.valueAt(hovered);
                return (
                  <g key={s.id}>
                    <rect
                      x={tooltipOnRight ? 6 : -(TOOLTIP_W - 6)}
                      y={18 + i * 12}
                      width={6}
                      height={6}
                      fill={s.color}
                    />
                    <text
                      x={tooltipOnRight ? 16 : -(TOOLTIP_W - 16)}
                      y={24 + i * 12}
                      className="mgraph-tooltip-row"
                    >
                      {s.label}: {Number.isInteger(v) ? v : v.toFixed(2)}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        )}
      </svg>
    </div>
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
  const { yMax: niceMax, yTicks: niceTicks } = niceYTicks(max);
  const yOf = (v: number) =>
    H - PAD_B - ((v / niceMax) * (H - PAD_T - PAD_B));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mgraph-svg"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Dice roll frequency"
    >
      {/* Grid */}
      {niceTicks.map((tv) => (
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
  const { yMax: niceMax, yTicks: niceTicks } = niceYTicks(max);
  const yOf = (v: number) =>
    H - PAD_B - ((v / niceMax) * (H - PAD_T - PAD_B));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mgraph-svg"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Cumulative resources in circulation"
    >
      {niceTicks.map((tv) => (
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
              fill={RESOURCE_COLOR[r]}
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
