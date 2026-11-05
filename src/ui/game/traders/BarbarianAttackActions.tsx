import { useGameStore } from '@/store/gameStore';
import { Button } from '@/ui/shared/Button';
import type { GameState, PlayerId } from '@/game/types';
import {
  barbarianCardLabel,
  canBuyBarbarianCard,
} from '@/game/modules/traders/barbarianAttack/cards';
import {
  knightsInSupply,
  knightsThatMustMove,
  movableKnights,
} from '@/game/modules/traders/barbarianAttack/knights';
import { treasonStep } from './BarbarianAttackOverlay';

// Barbarian Attack controls in the ActionBar: the development-card button
// (main phase) and the bars for the card-choice and end-of-turn knight steps.
// The ActionBar only renders these for the acting seat's own device.

const CARD_HELP =
  'Buy a development card (1🐑 1🌾 1🪨). It is played at once: Capture (take a barbarian prisoner), Knighthood (a knight on a castle edge), Swift Knight (a knight on any edge) or Treason (2 gold, move 2 barbarians).';

export function BarbarianCardButton({ game, acting }: { game: GameState; acting: PlayerId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const ba = game.barbarianAttack;
  if (!ba) return null;
  const left = ba.deck.length + ba.discard.length;
  const knights = knightsInSupply(game, acting);
  return (
    <Button
      disabled={!canBuyBarbarianCard(game, acting)}
      onClick={() => dispatch({ type: 'buyDevCard', playerId: acting })}
      title={`${CARD_HELP} ${knights} of your 6 knights are off the board.${left === 0 ? ' No cards left.' : ''}`}
    >
      🃏 Dev Card
    </Button>
  );
}

export function BarbarianAttackPhaseBar({ game, acting }: { game: GameState; acting: PlayerId }) {
  const { dispatch, uiMode, setMode } = useGameStore();
  const ba = game.barbarianAttack;
  if (!ba) return null;

  if (game.phase === 'barbarianCard') {
    const card = ba.pendingCard?.card;
    if (!card || ba.pendingCard?.playerId !== acting) return null;
    let hint: string;
    let back: (() => void) | null = null;
    if (card === 'capture') {
      hint = 'Capture: pick a coastal hex with a barbarian — it becomes your prisoner (2 prisoners = 1 VP).';
    } else if (card === 'knighthood') {
      hint = 'Knighthood: place a knight on a free castle edge. It must move off the castle at the end of your turn.';
    } else if (card === 'swiftKnight') {
      hint = 'Swift Knight: place a knight on any edge without a knight.';
    } else if (uiMode.kind === 'baTreason') {
      const step = treasonStep(game, uiMode);
      const n = uiMode.moves.length + 1;
      hint =
        step.from === undefined
          ? `Treason (+2 gold): barbarian ${n} of 2 — pick the coastal hex it leaves.`
          : `Treason: barbarian ${n} of 2${step.from === null ? ' comes from the supply' : ''} — pick an unconquered coastal hex for it (not one it came from).`;
      if (uiMode.from !== undefined || uiMode.moves.length > 0) {
        back = () => setMode({ kind: 'baTreason', moves: [] });
      }
    } else {
      hint = 'Treason: move 2 barbarians.';
    }
    return (
      <div className="actionbar">
        <div className="actionbar-hint actionbar-slot-wide">
          <strong>🃏 {barbarianCardLabel(card)}</strong> — {hint}
        </div>
        {back && (
          <div className="actionbar-slot">
            <Button fullWidth onClick={back}>
              Start over
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (game.phase === 'barbarianKnightMoves') {
    const mustMove = knightsThatMustMove(game, acting);
    const movable = movableKnights(game, acting);
    const picked = uiMode.kind === 'baKnightMove' ? uiMode.from : undefined;
    const hint = picked
      ? 'Pick where it goes: up to 3 edges, 🌾 edges are 4-5 away and cost 1 wheat. Not onto another knight or the castle.'
      : mustMove.length > 0
        ? 'Your knight on the castle (red ring) must move. Pick it, then an edge up to 3 away (5 for 1 wheat).'
        : movable.length > 0
          ? 'Move your knights (optional): pick a knight, then an edge up to 3 away (5 for 1 wheat). Then Done to expel the barbarians.'
          : 'All your knights have moved. Done expels the barbarians and ends your turn.';
    return (
      <div className="actionbar">
        <div className="actionbar-hint actionbar-slot-wide">⚔ {hint}</div>
        {picked && (
          <div className="actionbar-slot">
            <Button fullWidth onClick={() => setMode({ kind: 'baKnightMove' })}>
              Pick another
            </Button>
          </div>
        )}
        <div className="actionbar-slot actionbar-slot-end">
          <Button
            variant="primary"
            fullWidth
            disabled={mustMove.length > 0}
            title={
              mustMove.length > 0
                ? 'A knight on a castle edge must move first'
                : 'Expel the barbarians: every coastal hex where knights outnumber its barbarians is won'
            }
            onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
          >
            Done — expel ▸
          </Button>
        </div>
      </div>
    );
  }
  return null;
}
