// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import type { GameState } from '@/game/types';
import { edgeKey } from '@/game/board/coords';
import { BoardSVG } from '../BoardSVG';
import { BarbarianAttackPanel } from './BarbarianAttackPanel';
import { BarbarianAttackBadges } from './BarbarianAttackBadges';

function midGame(): GameState {
  const g = createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 3,
    randomizeTurnOrder: false,
    settings: { expansions: ['traders'], tradersScenarioId: 'barbarianAttack' },
  });
  const hex = g.board.hexes['1,-2']!;
  // A lone settlement on the 8's top corner (touches only the 8 and the frame).
  const lonely = hex.corners.find(
    (v) => g.board.vertices[v]!.hexes.filter((h) => g.board.hexes[h]!.terrain !== 'sea').length === 1,
  )!;
  const knightEdge = edgeKey(hex.corners[0]!, hex.corners[1]!);
  return {
    ...g,
    players: g.players.map((p) => (p.id === 'p1' ? { ...p, settlements: [lonely] } : p)),
    barbarianAttack: {
      ...g.barbarianAttack!,
      barbarians: { '1,-2': 3, '0,2': 1 },
      knights: { [knightEdge]: 'p0' },
      prisoners: { p0: 3, p1: 0, p2: 0 },
    },
  };
}

describe('Barbarian Attack UI', () => {
  it('draws the castle, barbarians, conquered discs, knights and a tipped building', () => {
    const { container } = render(<BoardSVG game={midGame()} />);
    expect(container.querySelector('.ba-castle')).not.toBeNull();
    expect(container.querySelectorAll('.ba-barbarians > g').length).toBe(4);
    expect(container.querySelectorAll('.ba-conquered').length).toBe(1);
    expect(container.querySelectorAll('.ba-knights > g').length).toBe(1);
    expect(container.querySelectorAll('.settlement-tipped').length).toBe(1);
  });

  it('shows prisoners, knights and conquered buildings in the panels', () => {
    const game = midGame();
    const panel = render(<BarbarianAttackPanel game={game} />);
    expect(panel.container.textContent).toContain('⛓ 3');
    expect(panel.container.textContent).toContain('conquered');
    const badges = render(<BarbarianAttackBadges game={game} playerId="p1" />);
    expect(badges.container.textContent).toContain('🏚 1');
  });
});
