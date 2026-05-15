import { useGameStore } from '@/store/gameStore';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { RESOURCES } from '@/game/types';
import './BankPanel.css';

export function BankPanel() {
  const game = useGameStore((s) => s.game!);
  return (
    <section className="bank">
      <header className="bank-header">
        <span>Bank</span>
        <span className="bank-deck">🃏 {game.devCardDeck.length}</span>
      </header>
      <div className="bank-resources">
        {RESOURCES.map((r) => (
          <ResourceChip key={r} resource={r} count={game.bank[r]} size="sm" />
        ))}
      </div>
    </section>
  );
}
