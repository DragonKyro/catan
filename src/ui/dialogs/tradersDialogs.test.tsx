// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import type { GameState } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { CoinsDialog } from './CoinsDialog';
import { SpendFishDialog } from './SpendFishDialog';
import { FishSwapDialog } from './FishSwapDialog';

// The Rivers of Catan / Fishing on Catan dialogs dispatch legal actions.

function mainPhase(scenario: string, patch: (s: GameState) => GameState): GameState {
  const s = createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: { expansions: ['traders'], tradersScenarioId: scenario },
    randomizeTurnOrder: false,
  });
  return patch({ ...s, phase: 'main', hasRolledThisTurn: true, setupState: undefined });
}

function load(game: GameState) {
  useGameStore.getState().setGameState(game);
  useGameStore.setState({ handoffAcknowledgedForPlayer: 'p0', handoffPending: false });
}

beforeEach(() => cleanup());

describe('CoinsDialog', () => {
  it('spends 2 gold for a card and buys gold at the bank rate', () => {
    load(
      mainPhase('riversOfCatan', (s) => ({
        ...s,
        players: s.players.map((p) =>
          p.id === 'p0' ? { ...p, gold: 4, resources: { ...p.resources, wood: 4 } } : p,
        ),
      })),
    );
    render(<CoinsDialog />);
    fireEvent.click(screen.getAllByTitle(/Pay 2 gold for 1 ore/)[0]!);
    let g = useGameStore.getState().game!;
    expect(g.players[0]!.gold).toBe(2);
    expect(g.players[0]!.resources.ore).toBe(1);
    cleanup();
    render(<CoinsDialog />);
    fireEvent.click(screen.getByTitle(/Give 4 wood for 1 gold/));
    g = useGameStore.getState().game!;
    expect(g.players[0]!.gold).toBe(3);
    expect(g.players[0]!.resources.wood).toBe(0);
  });
});

describe('SpendFishDialog', () => {
  it('offers all five spends, disabling the unaffordable and impossible ones', () => {
    load(
      mainPhase('fishingOnCatan', (s) => ({
        ...s,
        players: s.players.map((p) => (p.id === 'p0' ? { ...p, fishTokens: ['two', 'two'] } : p)),
      })),
    );
    render(<SpendFishDialog />);
    const btn = (label: RegExp) => screen.getByText(label).closest('button')!;
    // The robber starts beside the board in Fishing on Catan.
    expect(btn(/Remove the robber/).disabled).toBe(true);
    // Nobody holds cards yet.
    expect(btn(/Steal a random card/).disabled).toBe(true);
    expect(btn(/Take a card of your choice/).disabled).toBe(false);
    expect(btn(/Build a road for free/).disabled).toBe(true); // needs 5
    expect(btn(/Take a development card/).disabled).toBe(true); // needs 7
  });

  it('takes a chosen card for 4 fish', () => {
    load(
      mainPhase('fishingOnCatan', (s) => ({
        ...s,
        players: s.players.map((p) => (p.id === 'p0' ? { ...p, fishTokens: ['two', 'two', 'one'] } : p)),
      })),
    );
    render(<SpendFishDialog />);
    fireEvent.click(screen.getByText(/Take a card of your choice/));
    fireEvent.click(screen.getAllByText('🌾')[0]!.closest('button')!);
    fireEvent.click(screen.getByText('Spend'));
    const g = useGameStore.getState().game!;
    expect(g.players[0]!.resources.wheat).toBe(1);
    expect(g.players[0]!.fishTokens).toEqual(['one']);
  });

  it('a free road switches the board to road placement', () => {
    load(
      mainPhase('fishingOnCatan', (s) => ({
        ...s,
        players: s.players.map((p) =>
          p.id === 'p0'
            ? { ...p, fishTokens: ['three', 'two'], settlements: [s.board.hexes['0,0']!.corners[0]!] }
            : p,
        ),
      })),
    );
    render(<SpendFishDialog />);
    fireEvent.click(screen.getByText(/Build a road for free/));
    fireEvent.click(screen.getByText(/Choose where/));
    expect(useGameStore.getState().uiMode).toEqual({ kind: 'fishRoad', tokens: ['three', 'two'] });
  });
});

describe('FishSwapDialog', () => {
  it('lets the capped player swap or keep', () => {
    load(
      mainPhase('fishingOnCatan', (s) => ({
        ...s,
        phase: 'fishSwap',
        fishSwap: { queue: ['p0'], returnTo: 'main' },
        players: s.players.map((p) =>
          p.id === 'p0' ? { ...p, fishTokens: ['one', 'one', 'two', 'two', 'two', 'three', 'three'] } : p,
        ),
      })),
    );
    render(<FishSwapDialog />);
    fireEvent.click(screen.getByText('Keep my fish'));
    const g = useGameStore.getState().game!;
    expect(g.phase).toBe('main');
    expect(g.players[0]!.fishTokens).toHaveLength(7);
  });
});
