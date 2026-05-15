import { useGameStore } from '@/store/gameStore';
import { useLogStore } from '@/store/logStore';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { MatchGraph } from './MatchGraph';

const PLAYER_COLOR_CSS: Record<string, string> = {
  red: 'var(--player-red)',
  blue: 'var(--player-blue)',
  orange: 'var(--player-orange)',
  white: 'var(--player-white)',
};

export function GameOverDialog() {
  const { game, resetGame } = useGameStore();
  const timeline = useLogStore((s) => s.timeline);
  if (!game || !game.winner) return null;
  const winner = game.players.find((p) => p.id === game.winner)!;

  // Rank players by VP (including hidden, since game is over).
  const ranked = [...game.players]
    .map((p) => ({ p, vp: calculateVictoryPoints(game, p.id, true) }))
    .sort((a, b) => b.vp - a.vp);

  return (
    <DialogShell
      title="🏆 Game over"
      blocking
      variant="modal"
      footer={<Button variant="primary" onClick={resetGame}>New game</Button>}
    >
      <p style={{ marginTop: 0, fontSize: '1.05em' }}>
        <strong style={{ color: PLAYER_COLOR_CSS[winner.color] }}>{winner.name}</strong> wins!
      </p>
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
                      background: PLAYER_COLOR_CSS[p.color],
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
      <MatchGraph players={game.players} timeline={timeline} />
    </DialogShell>
  );
}
