import type { Commodity, CommodityBank, GameState, PlayerId, Resource, ResourceBank, TradeGood } from '@/game/types';
import { COMMODITIES, RESOURCES } from '@/game/types';
import { ResourceChip, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';
import { CommodityChip, COMMODITY_LABEL } from '@/ui/shared/CommodityChip';
import { playerColorVar } from '@/ui/shared/playerColors';
import { calculateVictoryPoints } from '@/game/scoring/points';
import './ck.css';

export function goodLabel(g: TradeGood): string {
  return (COMMODITIES as readonly string[]).includes(g)
    ? COMMODITY_LABEL[g as Commodity]
    : RESOURCE_LABEL[g as Resource];
}

export function GoodChip({ good, count, size }: { good: TradeGood; count?: number; size?: 'sm' | 'md' | 'lg' }) {
  return (COMMODITIES as readonly string[]).includes(good) ? (
    <CommodityChip commodity={good as Commodity} count={count} size={size} />
  ) : (
    <ResourceChip resource={good as Resource} count={count} size={size} />
  );
}

// One-of choice between resources and/or commodities.
export function GoodChoice({
  goods,
  value,
  onChange,
  disabled,
}: {
  goods: readonly TradeGood[];
  value: TradeGood | null;
  onChange: (g: TradeGood) => void;
  disabled?: (g: TradeGood) => boolean;
}) {
  return (
    <div className="ck-goods">
      {goods.map((g) => (
        <button
          key={g}
          type="button"
          className={`ck-good${value === g ? ' is-selected' : ''}`}
          onClick={() => onChange(g)}
          disabled={disabled?.(g)}
          aria-pressed={value === g}
          title={goodLabel(g)}
        >
          <GoodChip good={g} />
        </button>
      ))}
    </div>
  );
}

export const ALL_GOODS: readonly TradeGood[] = [...RESOURCES, ...COMMODITIES];

export interface Selection {
  resources: Partial<ResourceBank>;
  commodities: Partial<CommodityBank>;
}

export const EMPTY_SELECTION: Selection = { resources: {}, commodities: {} };

export function selectionCount(s: Selection): number {
  let n = 0;
  for (const r of RESOURCES) n += s.resources[r] ?? 0;
  for (const c of COMMODITIES) n += s.commodities[c] ?? 0;
  return n;
}

// +/- picker over a hand of resources and commodities, capped by what's
// held and by `max` cards in total.
export function HandPicker({
  resources,
  commodities,
  value,
  onChange,
  max,
}: {
  resources: ResourceBank;
  commodities: CommodityBank;
  value: Selection;
  onChange: (s: Selection) => void;
  max: number;
}) {
  const total = selectionCount(value);
  const row = (good: TradeGood, have: number, cur: number, set: (n: number) => void) => (
    <div key={good} className="rpicker-row">
      <GoodChip good={good} />
      <button
        type="button"
        className="rpicker-btn"
        onClick={() => set(cur - 1)}
        disabled={cur === 0}
        aria-label={`Fewer ${good}`}
      >
        −
      </button>
      <span className="rpicker-value">{cur}</span>
      <button
        type="button"
        className="rpicker-btn"
        onClick={() => set(cur + 1)}
        disabled={cur >= have || total >= max}
        aria-label={`More ${good}`}
      >
        +
      </button>
      <span className="rpicker-cap">/ {have}</span>
    </div>
  );
  return (
    <div className="rpicker">
      {RESOURCES.filter((r) => resources[r] > 0).map((r) =>
        row(r, resources[r], value.resources[r] ?? 0, (n) =>
          onChange({ ...value, resources: { ...value.resources, [r]: n } }),
        ),
      )}
      {COMMODITIES.filter((c) => commodities[c] > 0).map((c) =>
        row(c, commodities[c], value.commodities[c] ?? 0, (n) =>
          onChange({ ...value, commodities: { ...value.commodities, [c]: n } }),
        ),
      )}
    </div>
  );
}

export function Swatch({ game, pid }: { game: GameState; pid: PlayerId }) {
  const p = game.players.find((x) => x.id === pid);
  return <span className="ck-swatch" style={{ background: playerColorVar(p?.color ?? 'white') }} aria-hidden />;
}

export function playerName(game: GameState, pid: PlayerId): string {
  return game.players.find((p) => p.id === pid)?.name ?? pid;
}

// Pick one other player (with a note per player, e.g. their VPs).
export function PlayerChoice({
  game,
  players,
  value,
  onChange,
  note,
}: {
  game: GameState;
  players: PlayerId[];
  value: PlayerId | null;
  onChange: (pid: PlayerId) => void;
  note?: (pid: PlayerId) => string;
}) {
  if (players.length === 0) return <p className="ck-soft">Nobody qualifies.</p>;
  return (
    <div className="ck-players">
      {players.map((pid) => (
        <button
          key={pid}
          type="button"
          className={`ck-player${value === pid ? ' is-selected' : ''}`}
          onClick={() => onChange(pid)}
          aria-pressed={value === pid}
        >
          <Swatch game={game} pid={pid} />
          <span>{playerName(game, pid)}</span>
          {note && <span className="ck-soft">{note(pid)}</span>}
        </button>
      ))}
    </div>
  );
}

export function vpNote(game: GameState) {
  return (pid: PlayerId) => `${calculateVictoryPoints(game, pid, false)} VP`;
}

export function handSize(game: GameState, pid: PlayerId): number {
  const p = game.players.find((x) => x.id === pid);
  if (!p) return 0;
  let n = 0;
  for (const r of RESOURCES) n += p.resources[r];
  for (const c of COMMODITIES) n += p.commodities?.[c] ?? 0;
  return n;
}
