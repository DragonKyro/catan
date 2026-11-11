// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HomeMenu } from './HomeMenu';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('home screen', () => {
  it('offers the five ways in', () => {
    render(<HomeMenu />);
    expect(screen.getByRole('img', { name: 'Catan' })).toBeTruthy();
    for (const name of [/Play on this device/, /Play online/, /Rulebook/, /Map builder/, /Load replay/]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('opens the local game setup', () => {
    render(<HomeMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Play on this device/ }));
    expect(screen.getByRole('heading', { name: 'Play on this device' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start game' })).toBeTruthy();
  });

  it('rolls the dice and says what the island produces', () => {
    vi.useFakeTimers();
    // 3 + 5 = 8: the ore 8 and the wood 8.
    const faces = [2 / 6, 4 / 6];
    vi.spyOn(Math, 'random').mockImplementation(() => faces.shift() ?? 0);
    render(<HomeMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Roll the dice/ }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText('8: ore & wood!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Roll the dice (showing 3 and 5)' })).toBeTruthy();
  });
});
