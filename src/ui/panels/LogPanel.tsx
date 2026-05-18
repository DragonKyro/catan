import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useLogStore, type LogEntry } from '@/store/logStore';
import type { Player, PlayerId, Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { RESOURCE_ICON } from '@/ui/shared/ResourceChip';
import { playerColorVar } from '@/ui/shared/playerColors';
import './LogPanel.css';

interface Props {
  // When embedded inside a tabbed area we drop the heading and outer border.
  embedded?: boolean;
}

export function LogPanel({ embedded }: Props) {
  const entries = useLogStore((s) => s.entries);
  const game = useGameStore((s) => s.game);
  const logRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  // Auto-scroll only when the user is already pinned to the bottom.
  // If they scrolled up to read history, new entries won't yank them down.
  const wasAtBottomRef = useRef(true);

  const playerById = useMemo(
    () =>
      new Map<PlayerId, Player>(
        (game?.players ?? []).map((p) => [p.id, p]),
      ),
    [game?.players],
  );

  const visibleEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => entryMatches(e, playerById, q));
  }, [entries, search, playerById]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleEntries.length]);

  // Track user's scroll position so we know whether to snap on the next
  // entry. ~6px tolerance covers fractional scroll on zoom etc.
  const onScroll = () => {
    const el = logRef.current;
    if (!el) return;
    wasAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 6;
  };

  if (!game) return null;
  const hidden = entries.length - visibleEntries.length;

  return (
    <section className={`log ${embedded ? 'log-embedded' : ''}`}>
      {!embedded && (
        <header className="log-header">
          <h3>Game log</h3>
        </header>
      )}
      <div className="log-search">
        <input
          type="search"
          className="log-search-input"
          placeholder="Search log (e.g. monopoly, knight, Alice)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search game log"
        />
        {search && (
          <button
            type="button"
            className="log-search-clear"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>
      <div className="log-list" ref={logRef} onScroll={onScroll}>
        {entries.length === 0 && (
          <div className="log-empty">Nothing has happened yet.</div>
        )}
        {entries.length > 0 && visibleEntries.length === 0 && (
          <div className="log-empty">
            No log entries match &ldquo;{search}&rdquo;.
          </div>
        )}
        {visibleEntries.map((e) => (
          <LogLine key={e.id} entry={e} playerById={playerById} />
        ))}
      </div>
      {search && hidden > 0 && (
        <div className="log-search-meta">
          Showing {visibleEntries.length} of {entries.length} entries
        </div>
      )}
    </section>
  );
}

// Flatten a log entry into a single lowercase string for search matching.
// Includes the entry kind name, every player display name involved,
// resource keys, and any literal labels the renderer would show. This way
// a search for "monopoly" matches playMonopoly, "knight" matches playKnight,
// resource names match trade/discard/gain lines, etc.
function entryMatches(
  entry: LogEntry,
  playerById: Map<PlayerId, Player>,
  qLower: string,
): boolean {
  const parts: string[] = [entry.kind.toLowerCase()];
  const pushName = (id: PlayerId) => {
    const p = playerById.get(id);
    if (p) parts.push(p.name.toLowerCase());
  };
  const pushBank = (bank: Partial<ResourceBank>) => {
    for (const r of RESOURCES) {
      if ((bank[r] ?? 0) > 0) parts.push(r);
    }
  };
  switch (entry.kind) {
    case 'roll':
      pushName(entry.player);
      parts.push('roll', 'dice', String(entry.dice[0] + entry.dice[1]));
      break;
    case 'gain':
      pushName(entry.player);
      parts.push('gain', 'got', 'received');
      pushBank(entry.gained);
      break;
    case 'build':
      pushName(entry.player);
      parts.push('build', entry.what);
      break;
    case 'buyDevCard':
      pushName(entry.player);
      parts.push('buy', 'dev card', 'development');
      break;
    case 'playKnight':
      pushName(entry.player);
      parts.push('play', 'knight');
      break;
    case 'playRoadBuilding':
      pushName(entry.player);
      parts.push('play', 'road building', 'road-building');
      break;
    case 'playYearOfPlenty':
      pushName(entry.player);
      parts.push('play', 'year of plenty', 'year-of-plenty');
      for (const r of entry.resources) parts.push(r);
      break;
    case 'playMonopoly':
      pushName(entry.player);
      parts.push('play', 'monopoly', entry.resource, String(entry.taken));
      break;
    case 'discard':
      pushName(entry.player);
      parts.push('discard');
      pushBank(entry.resources);
      break;
    case 'moveRobber':
      pushName(entry.player);
      parts.push('robber', 'move');
      if (entry.stoleFrom) {
        pushName(entry.stoleFrom);
        parts.push('stole', 'steal');
      }
      break;
    case 'bankTrade':
      pushName(entry.player);
      parts.push('bank', 'trade', entry.give, entry.receive);
      break;
    case 'tradeProposed':
      pushName(entry.proposer);
      parts.push('offer', 'propose', 'trade');
      pushBank(entry.give);
      pushBank(entry.receive);
      break;
    case 'tradeAccepted':
      pushName(entry.proposer);
      pushName(entry.acceptor);
      parts.push('accept', 'trade');
      pushBank(entry.give);
      pushBank(entry.receive);
      break;
    case 'tradeCancelled':
      pushName(entry.proposer);
      parts.push('cancel', 'trade');
      break;
    case 'tradeRejected':
      pushName(entry.proposer);
      pushName(entry.rejector);
      parts.push('reject', 'trade');
      break;
    case 'tradeCountered':
      pushName(entry.counterer);
      parts.push('counter', 'trade');
      pushBank(entry.give);
      pushBank(entry.receive);
      break;
    case 'endTurn':
      pushName(entry.player);
      parts.push('end turn');
      break;
    case 'volcanoEruption':
      pushName(entry.victim);
      parts.push(
        'volcano',
        entry.effect === 'destroyed'
          ? 'settlement destroyed'
          : 'city downgraded',
      );
      break;
    case 'turnBegins':
      parts.push('turn', `turn ${entry.turnNumber}`);
      break;
    case 'win':
      pushName(entry.player);
      parts.push('win', 'winner');
      break;
  }
  return parts.join(' ').includes(qLower);
}

function LogLine({
  entry,
  playerById,
}: {
  entry: LogEntry;
  playerById: Map<PlayerId, Player>;
}) {
  const pname = (id: PlayerId) => {
    const p = playerById.get(id);
    if (!p) return id;
    return (
      <span
        className="log-name"
        style={{ color: playerColorVar(p.color) }}
      >
        {p.name}
      </span>
    );
  };

  switch (entry.kind) {
    case 'roll': {
      const total = entry.dice[0] + entry.dice[1];
      return (
        <div className="log-line">
          {pname(entry.player)} rolled{' '}
          <span className="log-dice">
            {entry.dice[0]} + {entry.dice[1]} = <strong>{total}</strong>
          </span>
        </div>
      );
    }
    case 'gain':
      return (
        <div className="log-line log-line-gain">
          {pname(entry.player)} got <Bank bank={entry.gained} />
        </div>
      );
    case 'build':
      return (
        <div className="log-line">
          {pname(entry.player)} built a {entry.what}
        </div>
      );
    case 'buyDevCard':
      return <div className="log-line">{pname(entry.player)} bought a dev card</div>;
    case 'playKnight':
      return <div className="log-line">{pname(entry.player)} played a knight</div>;
    case 'playRoadBuilding':
      return (
        <div className="log-line">
          {pname(entry.player)} played Road Building
        </div>
      );
    case 'playYearOfPlenty':
      return (
        <div className="log-line">
          {pname(entry.player)} played Year of Plenty:{' '}
          {entry.resources.map((r, i) => (
            <span key={i} className="log-rchip" title={r}>
              {RESOURCE_ICON[r]}
            </span>
          ))}
        </div>
      );
    case 'playMonopoly':
      return (
        <div className="log-line">
          {pname(entry.player)} played Monopoly on{' '}
          <span className="log-rchip" title={entry.resource}>
            {RESOURCE_ICON[entry.resource]}
          </span>{' '}
          and took {entry.taken}
        </div>
      );
    case 'discard':
      return (
        <div className="log-line log-line-discard">
          {pname(entry.player)} discarded <Bank bank={entry.resources} />
        </div>
      );
    case 'moveRobber':
      if (entry.stoleFrom) {
        return (
          <div className="log-line">
            {pname(entry.player)} moved the robber and stole from{' '}
            {pname(entry.stoleFrom)}
          </div>
        );
      }
      return (
        <div className="log-line">{pname(entry.player)} moved the robber</div>
      );
    case 'bankTrade':
      return (
        <div className="log-line">
          {pname(entry.player)} traded {entry.giveAmount}
          <span className="log-rchip">{RESOURCE_ICON[entry.give]}</span>→
          <span className="log-rchip">{RESOURCE_ICON[entry.receive]}</span>{' '}
          with the bank
        </div>
      );
    case 'tradeProposed':
      return (
        <div className="log-line">
          {pname(entry.proposer)} offered <Bank bank={entry.give} /> for{' '}
          <Bank bank={entry.receive} />
        </div>
      );
    case 'tradeAccepted':
      return (
        <div className="log-line log-line-trade">
          {pname(entry.acceptor)} accepted {pname(entry.proposer)}'s trade:{' '}
          <Bank bank={entry.give} /> ↔ <Bank bank={entry.receive} />
        </div>
      );
    case 'tradeCancelled':
      return (
        <div className="log-line log-soft">
          {pname(entry.proposer)} cancelled their trade
        </div>
      );
    case 'tradeRejected':
      return (
        <div className="log-line log-soft">
          {pname(entry.rejector)} rejected {pname(entry.proposer)}'s trade
        </div>
      );
    case 'tradeCountered':
      return (
        <div className="log-line">
          {pname(entry.counterer)} countered with <Bank bank={entry.give} /> for{' '}
          <Bank bank={entry.receive} />
        </div>
      );
    case 'endTurn':
      return (
        <div className="log-line log-soft">{pname(entry.player)} ended turn</div>
      );
    case 'volcanoEruption':
      return (
        <div className="log-line">
          🌋 {pname(entry.victim)}'s{' '}
          {entry.effect === 'destroyed'
            ? 'settlement was destroyed'
            : 'city was downgraded to a settlement'}
        </div>
      );
    case 'turnBegins':
      return (
        <div className="log-line log-line-turn">
          ── Turn {entry.turnNumber} ──
        </div>
      );
    case 'win':
      return (
        <div className="log-line log-line-win">
          🏆 {pname(entry.player)} wins!
        </div>
      );
  }
}

function Bank({ bank }: { bank: Partial<ResourceBank> }) {
  const entries: [Resource, number][] = [];
  for (const r of RESOURCES) {
    const n = bank[r] ?? 0;
    if (n !== 0) entries.push([r, n]);
  }
  if (entries.length === 0) return <span className="log-rchip">∅</span>;
  return (
    <span className="log-bank">
      {entries.map(([r, n]) => (
        <span key={r} className="log-rchip" title={r}>
          {n}
          {RESOURCE_ICON[r]}
        </span>
      ))}
    </span>
  );
}
