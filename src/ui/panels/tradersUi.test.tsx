// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { GameState } from '@/game/types';
import { simulate } from '@/ai/traders/simSupport';
import { getActingPlayerId } from '@/game/helpers';
import { legalWagonPlacements } from '@/game/modules/traders/merchantTrains/trains';
import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from '@/ui/game/BoardSVG';
import { WagonVoteDialog } from '@/ui/dialogs/WagonVoteDialog';
import { EventChoiceDialog } from '@/ui/dialogs/EventChoiceDialog';
import { MerchantTrainsBlock } from './MerchantTrainsBlock';
import { TradersVariantsBlock } from './TradersVariantsBlock';
import { EventCardDisplay } from './EventCardDisplay';

// Smoke tests for the Merchant Trains / Event Cards UI on real mid-game
// positions from all-AI games.

// The acting seat made human, so this device gets the controls.
function humanActs(s: GameState): GameState {
  const id = getActingPlayerId(s);
  return { ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: false } : p)) };
}

let voting: GameState;
let laterTrains: GameState;
let event: GameState;
beforeAll(() => {
  simulate(4, 4, { expansions: ['traders'], tradersScenarioId: 'merchantTrains' }, 8000, (_b, _a, after) => {
    if (after.phase === 'wagonVoting' && after.wagonVote?.stage === 'bid' && (after.wagons?.length ?? 0) >= 3) {
      voting ??= after;
    }
    if ((after.wagons?.length ?? 0) >= 8) laterTrains ??= after;
  });
  simulate(4, 4, { tradersVariants: { eventCards: true, strongestPorts: true } }, 8000, (_b, _a, after) => {
    if (after.phase === 'eventResolution' && after.eventCards?.pending?.choices[0]?.kind === 'takeResource') {
      event ??= after;
    }
  });
});

describe('Merchant Trains UI', () => {
  it('draws the watering hole, wagons with a front, and lettered spots while voting', () => {
    const { container } = render(<BoardSVG game={voting} />);
    expect(container.querySelector('.watering-hole')).not.toBeNull();
    expect(container.querySelectorAll('.wagon:not(.wagon-ghost)').length).toBe(voting.wagons!.length);
    expect(container.querySelectorAll('.wagon-ghost').length).toBe(legalWagonPlacements(voting).length);
  });

  it('the vote dialog shows the bids and lets the bidder bid', () => {
    const s = humanActs(voting);
    useGameStore.setState({ game: s });
    const { getByText } = render(<WagonVoteDialog />);
    expect(getByText(/Wagon vote/)).toBeTruthy();
    fireEvent.click(getByText('Pass'));
    const after = useGameStore.getState().game!;
    expect(after.wagonVote?.bids[getActingPlayerId(s)] ?? after.lastWagonVote).toBeDefined();
  });

  it('the Scenario block lists the trains', () => {
    const { getByText, container } = render(<MerchantTrainsBlock game={laterTrains} />);
    expect(getByText('Merchant Trains')).toBeTruthy();
    expect(container.textContent).toContain('🚂 1');
  });
});

describe('Catan Event Cards UI', () => {
  it('the card replaces the dice and the choice dialog answers the event', () => {
    const { container } = render(
      <EventCardDisplay card={event.eventCards!.current} left={event.eventCards!.deck.length} />,
    );
    expect(container.querySelector('.evcard-disc')?.textContent).toBe(String(event.eventCards!.current!.number));
    const s = humanActs(event);
    useGameStore.setState({ game: s });
    const before = s.eventCards!.pending!.choices.length;
    const dlg = render(<EventChoiceDialog />);
    const buttons = dlg.container.querySelectorAll('button:not([disabled])');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]!);
    const after = useGameStore.getState().game!;
    expect(after.eventCards!.pending?.choices.length ?? 0).toBeLessThan(before);
  });

  it('the variants block shows the Strongest Ports race and the deck', () => {
    const { container } = render(<TradersVariantsBlock game={event} />);
    expect(container.textContent).toContain('Strongest Ports');
    expect(container.textContent).toContain('Event cards');
  });
});
