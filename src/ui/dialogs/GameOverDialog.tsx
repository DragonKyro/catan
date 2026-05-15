import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
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
import './GameOverDialog.css';

type Tab = 'summary';

export function GameOverDialog() {
  const { game, resetGame } = useGameStore();
  const timeline = useLogStore((s) => s.timeline);
  const stats = useLogStore((s) => s.stats);
  const initialState = useLogStore((s) => s.initialState);
  const actions = useLogStore((s) => s.actions);
  const [minimized, setMinimized] = useState(false);
  const [tab] = useState<Tab>('summary');
  const loadReplay = useReplayStore((s) => s.load);
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
          <strong style={{ color: playerColorVar(winner.color) }}>
            {winner.name}
          </strong>{' '}
          wins · show results
        </button>
        <Button variant="primary" onClick={resetGame}>
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
          <Button variant="primary" onClick={resetGame}>
            New game
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, fontSize: '1.05em' }}>
        <strong style={{ color: playerColorVar(winner.color) }}>{winner.name}</strong> wins!
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
          <MatchGraph players={game.players} timeline={timeline} stats={stats} />
        </>
      )}
    </DialogShell>
  );
}
