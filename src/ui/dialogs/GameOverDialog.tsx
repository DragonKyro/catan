import { useState, type CSSProperties } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { useLogStore } from '@/store/logStore';
import {
  useReplayStore,
  downloadReplay,
  REPLAY_FILE_VERSION,
  type ReplayData,
} from '@/store/replayStore';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { playerColorVar } from '@/ui/shared/playerColors';
import { MatchGraph } from './MatchGraph';
import { tradeBreakdown } from '@/store/tradeStats';
import type { Player } from '@/game/types';
import './GameOverDialog.css';

type Tab = 'summary';

export function GameOverDialog() {
  const { game, resetGame } = useGameStore();
  const timeline = useLogStore((s) => s.timeline);
  const stats = useLogStore((s) => s.stats);
  const initialState = useLogStore((s) => s.initialState);
  const actions = useLogStore((s) => s.actions);
  const entries = useLogStore((s) => s.entries);
  const startTime = useLogStore((s) => s.startTime);
  const lastActionT = useLogStore((s) => s.lastActionT);
  const [minimized, setMinimized] = useState(false);
  const [tab] = useState<Tab>('summary');
  const loadReplay = useReplayStore((s) => s.load);
  const role = useNetworkStore((s) => s.role);
  const leaveRoom = useNetworkStore((s) => s.leaveRoom);
  if (!game || !game.winner) return null;
  const winner = game.players.find((p) => p.id === game.winner)!;
  const canReplay = initialState !== null && actions.length > 0;

  const buildReplay = (): ReplayData | null => {
    if (!initialState) return null;
    return {
      version: REPLAY_FILE_VERSION,
      savedAt: new Date().toISOString(),
      label: `${winner.name}-wins-${actions.length}actions`,
      winner: winner.id,
      initialState,
      actions,
    };
  };
  const onWatchReplay = () => {
    const data = buildReplay();
    if (data) loadReplay(data);
  };
  const onDownloadReplay = () => {
    const data = buildReplay();
    if (data) downloadReplay(data);
  };
  // Straight to setting up the next one: the New Game settings, or — online,
  // where a finished room can't start again — the online menu, out of the room.
  const onNewGame = () => {
    const online = role !== 'solo';
    if (online) leaveRoom();
    resetGame({ then: online ? 'online' : 'local' });
  };

  // When minimized, render a small floating "results" pill PLUS a
  // standalone "New game" button so the player can either keep inspecting
  // the final board, restore the full summary, or jump straight to a new
  // match without first re-opening the modal.
  if (minimized) {
    return (
      <div className="gameover-restore-bar">
        <button
          type="button"
          className="gameover-restore"
          onClick={() => setMinimized(false)}
          aria-label="Show game results"
        >
          🏆{' '}
          <strong
            className="gameover-winner"
            style={{ '--pc': playerColorVar(winner.color) } as CSSProperties}
          >
            {winner.name}
          </strong>{' '}
          wins · show results
        </button>
        {canReplay && (
          <Button onClick={onWatchReplay} title="Open the full-screen replay viewer">
            ▶ Watch replay
          </Button>
        )}
        <Button variant="primary" onClick={onNewGame}>
          New game
        </Button>
      </div>
    );
  }

  // Rank players by VP (including hidden, since game is over).
  const ranked = [...game.players]
    .map((p) => ({ p, vp: calculateVictoryPoints(game, p.id, true) }))
    .sort((a, b) => b.vp - a.vp);

  return (
    <DialogShell
      title="🏆 Game over"
      variant="modal"
      // No `blocking`: clicking the backdrop or the × in the header
      // minimizes to the floating restore pill so the player can inspect
      // the final board without dismissing the results entirely.
      onClose={() => setMinimized(true)}
      footer={
        <>
          {canReplay && (
            <>
              <Button onClick={onDownloadReplay} title="Download a .json file you can share or reload">
                💾 Save replay
              </Button>
              <Button onClick={onWatchReplay} title="Open the full-screen replay viewer">
                ▶ Watch replay
              </Button>
            </>
          )}
          <Button variant="primary" onClick={onNewGame}>
            New game
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, fontSize: '1.05em' }}>
        <strong
          className="gameover-winner"
          style={{ '--pc': playerColorVar(winner.color) } as CSSProperties}
        >
          {winner.name}
        </strong>{' '}
        wins!
        <span style={{ color: 'var(--text-soft)', marginLeft: 12, fontSize: '0.9em' }}>
          Total game time: {formatDurationMs(Math.max(0, lastActionT - startTime))}
        </span>
        <span style={{ color: 'var(--text-soft)', marginLeft: 12, fontSize: '0.9em' }}>
          · Total turns: {timeline[timeline.length - 1]?.turnNumber ?? 0}
        </span>
      </p>

      {tab === 'summary' && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left' }}>
                <th style={{ padding: '6px 0' }}>Player</th>
                <th style={{ padding: '6px 0' }}>Settlements</th>
                <th style={{ padding: '6px 0' }}>Cities</th>
                <th style={{ padding: '6px 0' }}>Bonus</th>
                <th style={{ padding: '6px 0', textAlign: 'right' }}>VP</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ p, vp }) => {
                const bonus =
                  (p.hasLongestRoad ? 'LR ' : '') +
                  (p.hasLargestArmy ? 'LA ' : '') +
                  (p.devCards.victoryPoints > 0 ? `${p.devCards.victoryPoints}🏆` : '');
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '6px 0' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: playerColorVar(p.color),
                          border: '1px solid rgba(40, 25, 5, 0.45)',
                          marginRight: 8,
                        }}
                      />
                      {p.name}
                    </td>
                    <td>{p.settlements.length}</td>
                    <td>{p.cities.length}</td>
                    <td style={{ color: 'var(--text-soft)' }}>{bonus || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{vp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TradeTable players={ranked.map((r) => r.p)} entries={entries} actions={actions} />
          <MatchGraph players={game.players} timeline={timeline} stats={stats} />
        </>
      )}
    </DialogShell>
  );
}

const swatch = (p: Player): CSSProperties => ({
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: 2,
  background: playerColorVar(p.color),
  border: '1px solid rgba(40, 25, 5, 0.45)',
  marginRight: 6,
  verticalAlign: 'baseline',
});

/** Who traded with whom: completed player trades per pair, and each player's bank / harbor trades. */
function TradeTable({
  players,
  entries,
  actions,
}: {
  players: Player[];
  entries: Parameters<typeof tradeBreakdown>[1];
  actions: Parameters<typeof tradeBreakdown>[2];
}) {
  const trades = tradeBreakdown(players.map((p) => p.id), entries, actions);
  const cell: CSSProperties = { padding: '5px 6px', textAlign: 'center' };
  return (
    <div style={{ overflowX: 'auto', marginTop: 14 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Trades by partner">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left' }}>
            <th style={{ padding: '6px 0' }}>Trades with</th>
            {players.map((p) => (
              <th key={p.id} style={{ ...cell, whiteSpace: 'nowrap' }}>
                <span style={swatch(p)} />
                {p.name}
              </th>
            ))}
            <th style={{ ...cell, whiteSpace: 'nowrap' }}>Bank / harbor</th>
            <th style={{ ...cell, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const t = trades[p.id]!;
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                <td style={{ padding: '6px 0', whiteSpace: 'nowrap' }}>
                  <span style={swatch(p)} />
                  {p.name}
                </td>
                {players.map((o) => (
                  <td key={o.id} style={{ ...cell, color: o.id === p.id ? 'var(--text-soft)' : undefined }}>
                    {o.id === p.id ? '—' : t.partners[o.id] ?? 0}
                  </td>
                ))}
                <td style={cell}>{t.bank}</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{t.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Format an elapsed-time value as "Xm Ys" or "Hh Mm" for long games.
function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
