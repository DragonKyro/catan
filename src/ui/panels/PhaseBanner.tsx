import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import './PhaseBanner.css';

function instruction(game: GameState, uiModeKind: string): string {
  switch (game.phase) {
    case 'setupRound1':
      return game.setupState?.step === 'settlement'
        ? 'Place your first settlement'
        : 'Place a road touching your settlement';
    case 'setupRound2':
      return game.setupState?.step === 'settlement'
        ? 'Place your second settlement (you get resources for it)'
        : 'Place a road touching your settlement';
    case 'rollOrPlayKnight':
      return 'Roll the dice — or play a Knight first';
    case 'main':
      switch (uiModeKind) {
        case 'buildSettlement':
          return 'Click a highlighted spot to build a settlement';
        case 'buildCity':
          return 'Click a settlement to upgrade it to a city';
        case 'buildRoad':
          return 'Click a highlighted edge to build a road';
        case 'roadBuilding':
          return 'Place a free road';
        default:
          return 'Build, trade, or end your turn';
      }
    case 'discard':
      return 'Discard half your resources';
    case 'moveRobber':
      return 'Click a hex to move the robber';
    case 'gameOver':
      return 'Game over';
    default:
      return '';
  }
}

export function PhaseBanner() {
  const game = useGameStore((s) => s.game!);
  const uiMode = useGameStore((s) => s.uiMode);
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  return (
    <div className="banner">
      <div className="banner-player">
        <span
          className="banner-swatch"
          style={{ background: playerColorVar(player.color) }}
        />
        <span className="banner-name">
          {player.name}
          {player.isAI && <span className="banner-ai-tag">AI</span>}
        </span>
      </div>
      <div className="banner-instruction">{instruction(game, uiMode.kind)}</div>
    </div>
  );
}
