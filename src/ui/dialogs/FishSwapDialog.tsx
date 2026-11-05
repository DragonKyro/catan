import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { useCanAct } from '@/ui/shared/useCanAct';
import { FISH_TOKEN_CAP } from '@/game/modules/traders/constants';
import { FishTokenIcon, fishValue } from '@/ui/game/traders/TradersIcons';

// Fishing on Catan 'fishSwap' phase: "Once per turn, if you have 7 fish
// tokens and would receive more, you may discard 1 fish token and replace it
// from the supply." The capped player picks a token to swap, or keeps
// their hand.
export function FishSwapDialog() {
  const { game, dispatch } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || game.phase !== 'fishSwap' || !acting || !canAct) return null;
  const player = game.players.find((p) => p.id === acting)!;
  const hand = player.fishTokens ?? [];
  const kinds = (['one', 'two', 'three'] as const).filter((t) => hand.includes(t));
  return (
    <DialogShell title={`${player.name}: your fish hand is full`} blocking>
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        You hold {hand.length} of {FISH_TOKEN_CAP} fish tokens, so you catch no more this roll. You
        may swap one token for a random one from the supply (a draw averages about 2 fish, and
        could be the old boot).
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {kinds.map((t) => (
          <Button
            key={t}
            onClick={() => dispatch({ type: 'swapFish', playerId: acting, token: t })}
            title={`Discard a ${fishValue(t)}-fish token and draw a new one`}
          >
            Swap a {fishValue(t)} <FishTokenIcon size={18} fish={fishValue(t)} />
          </Button>
        ))}
        <Button
          variant="primary"
          onClick={() => dispatch({ type: 'swapFish', playerId: acting, token: null })}
        >
          Keep my fish
        </Button>
      </div>
    </DialogShell>
  );
}
