// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase } from '@/game/__testHelpers';
import type { GameState } from '@/game/types';
import { legalWagonSteps } from '@/game/modules/traders/tradersBarbarians/state';
import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from '../BoardSVG';
import { TradersBarbariansOverlay } from './TradersBarbariansOverlay';
import { TradersBarbariansMainButtons, TradersBarbariansPhaseBar } from './TradersBarbariansActions';
import { TbWagonStrip, TradersBarbariansBadges, SwiftJourneyChips } from './TradersBarbariansHand';
import { TradersBarbariansTracker } from '@/ui/panels/traders/TradersBarbariansTracker';

function afterSetup(): GameState {
  const g = createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 4,
    randomizeTurnOrder: false,
    settings: { expansions: ['traders'], tradersScenarioId: 'tradersAndBarbarians' },
  });
  return applyAction(runSetupPhase(g), { type: 'rollDice', playerId: 'p0', dice: [1, 2] });
}

function wagonPhase(): GameState {
  const s = afterSetup();
  const withCargo: GameState = {
    ...s,
    tradersBarbarians: {
      ...s.tradersBarbarians!,
      wagons: {
        ...s.tradersBarbarians!.wagons,
        p0: { ...s.tradersBarbarians!.wagons.p0!, level: 2, cargo: { good: 'tools', from: 'castle' }, delivered: 2 },
      },
      swiftJourney: { ...s.tradersBarbarians!.swiftJourney, p0: { unplayed: 1, boughtThisTurn: 0 } },
    },
  };
  return applyAction(withCargo, { type: 'endTurn', playerId: 'p0' });
}

describe('Traders & Barbarians scenario UI', () => {
  beforeEach(() => {
    useGameStore.setState({ game: null, uiMode: { kind: 'idle' } });
  });

  it('draws the commodity hexes, X markers, stacks, barbarians and every wagon', () => {
    const { container } = render(<BoardSVG game={afterSetup()} />);
    expect(container.querySelectorAll('.tb-commodity').length).toBe(3);
    expect(container.querySelector('.tb-quarry')).not.toBeNull();
    expect(container.querySelector('.tb-castle')).not.toBeNull();
    expect(container.querySelector('.tb-glassworks')).not.toBeNull();
    expect(container.querySelectorAll('.tb-barbarian').length).toBe(3);
    expect(container.querySelectorAll('.tb-wagon').length).toBe(3);
  });

  it('highlights each legal wagon step and dispatches moveWagon on click', () => {
    const game = wagonPhase();
    useGameStore.setState({ game, uiMode: { kind: 'tbWagon' } });
    const { container } = render(
      <svg>
        <TradersBarbariansOverlay game={game} acting="p0" mode={{ kind: 'tbWagon' }} color="red" />
      </svg>,
    );
    const steps = legalWagonSteps(game, 'p0');
    expect(steps.length).toBeGreaterThan(0);
    const targets = container.querySelectorAll('.tb-wagon-overlay > g.ghost');
    expect(targets.length).toBe(steps.length);
    fireEvent.click(targets[0]!);
    const after = useGameStore.getState().game!;
    expect(after.tradersBarbarians!.wagons.p0!.vertex).toBe(steps[0]!.to);
  });

  it('wagon bar offers the wheat boost, Swift Journey and Done', () => {
    const game = wagonPhase();
    useGameStore.setState({ game, uiMode: { kind: 'tbWagon' } });
    const { container } = render(<TradersBarbariansPhaseBar game={game} acting="p0" />);
    const text = container.textContent ?? '';
    expect(text).toContain('MP left');
    expect(text).toContain('+2 MP');
    expect(text).toContain('Swift Journey');
    expect(text).toContain('Done');
  });

  it('main-phase buttons: wagon upgrade with its cost, the scenario deck', () => {
    const game = afterSetup();
    useGameStore.setState({ game });
    const { container } = render(<TradersBarbariansMainButtons game={game} acting="p0" />);
    const buttons = container.querySelectorAll('button');
    expect(buttons[0]!.textContent).toContain('L1→2');
    expect(buttons[0]!.getAttribute('title')).toContain('🌲');
    expect(buttons[1]!.getAttribute('title')).toContain('25 left');
  });

  it('shows the wagon board, cargo, deliveries, Swift Journey and the tracker', () => {
    const game = wagonPhase();
    const p0 = game.players.find((p) => p.id === 'p0')!;
    const strip = render(<TbWagonStrip game={game} player={p0} />);
    expect(strip.container.textContent).toContain('L2');
    expect(strip.container.textContent).toContain('5 MP');
    expect(strip.container.textContent).toContain('Quarry');
    expect(strip.container.textContent).toContain('📦 2');
    const badges = render(<TradersBarbariansBadges game={game} playerId="p0" />);
    expect(badges.container.textContent).toContain('L2');
    const chips = render(<SwiftJourneyChips game={game} player={p0} isMyTurn />);
    expect(chips.container.querySelector('button:not([disabled])')).not.toBeNull();
    const tracker = render(<TradersBarbariansTracker game={game} />);
    expect(tracker.container.textContent).toContain('Quarry');
    expect(tracker.container.textContent).toContain('stack 12');
    expect(tracker.container.textContent).toContain('13 VP');
  });
});
