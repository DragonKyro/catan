import { useGameStore } from '@/store/gameStore';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import { RESOURCES, COMMODITIES } from '@/game/types';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import './BankPanel.css';

export function BankPanel() {
  const game = useGameStore((s) => s.game!);
  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  return (
    <section className="bank">
      <header className="bank-header">
        <span>Bank</span>
        {!hasCK && <span className="bank-deck">🃏 {game.devCardDeck.length}</span>}
      </header>
      <div className="bank-resources">
        {RESOURCES.map((r) => (
          <ResourceChip key={r} resource={r} count={game.bank[r]} size="sm" />
        ))}
      </div>
      {hasCK && (
        <div className="bank-resources">
          {COMMODITIES.map((c) => (
            <CommodityChip
              key={c}
              commodity={c}
              count={game.commodityBank?.[c] ?? 0}
              size="sm"
            />
          ))}
        </div>
      )}
    </section>
  );
}
