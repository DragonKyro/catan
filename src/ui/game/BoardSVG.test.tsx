// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import { BoardSVG } from './BoardSVG';

describe('BoardSVG', () => {
  it('renders a 3p base game board', () => {
    const game = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 42,
      randomizeTurnOrder: false,
    });
    const { container } = render(<BoardSVG game={game} />);
    expect(container.querySelector('svg.board-svg')).not.toBeNull();
    expect(container.querySelectorAll('.hex').length).toBe(19);
  });

  it('renders a 5p (5-6 expansion) board', () => {
    const game = createGame({
      playerNames: ['A', 'B', 'C', 'D', 'E'],
      seed: 1,
      randomizeTurnOrder: false,
    });
    const { container } = render(<BoardSVG game={game} />);
    expect(container.querySelector('svg.board-svg')).not.toBeNull();
    expect(container.querySelectorAll('.hex').length).toBe(30);
  });

  it('renders a Seafarers game', () => {
    const game = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 7,
      randomizeTurnOrder: false,
      settings: { expansions: ['seafarers'] },
    });
    const { container } = render(<BoardSVG game={game} />);
    expect(container.querySelector('svg.board-svg')).not.toBeNull();
    expect(container.querySelectorAll('.hex').length).toBeGreaterThan(19);
  });
});
