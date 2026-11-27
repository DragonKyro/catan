// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, fireEvent, within } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import type { GameState } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { PendingTradeBanner } from '@/ui/panels/PendingTradeBanner';
import { PlayerTradeDialog } from './PlayerTradeDialog';

/** p0 (an AI, to play) offers 1 wood for 1 brick; p1 is the human, p2 / p3 AIs. */
function aiOffer(): GameState {
  let s = runSetupPhase(
    createGame({ playerNames: ['Ann', 'Bo', 'Cy', 'Di'], playerTypes: ['ai', 'human', 'ai', 'ai'], seed: 42, randomizeTurnOrder: false }),
  );
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  s = giveResources(s, 'p0', { wood: 2 });
  for (const id of ['p1', 'p2', 'p3']) s = giveResources(s, id, { brick: 2 });
  return applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
}

/** The banner plus the trade dialog, as GameView shows them. */
function Table() {
  const dialog = useGameStore((s) => s.dialog);
  return (
    <>
      <PendingTradeBanner />
      {dialog === 'playerTrade' && <PlayerTradeDialog />}
    </>
  );
}

describe('countering an offer from the banner', () => {
  beforeEach(() => {
    useGameStore.setState({ game: aiOffer(), dialog: null, tradeCounter: null, error: null });
  });

  it('shows the offer from my seat: what I would get and what I would give', () => {
    const view = render(<Table />);
    expect(view.getByText('Ann offers you')).toBeTruthy();
    expect(view.container.querySelector('.ptbanner .tlane-get .rchip-wood')).toBeTruthy();
    expect(view.container.querySelector('.ptbanner .tlane-give .rchip-brick')).toBeTruthy();
    view.unmount();
  });

  it('opens as my counter, seeded with the offer turned round, and sends it', () => {
    const view = render(<Table />);
    fireEvent.click(view.getByText('Counter'));
    const dialog = within(view.getByRole('dialog'));
    expect(dialog.getByText('Counter the offer')).toBeTruthy();
    // My hand (Bo's), not the proposer's: the brick left after the one given.
    const bo = useGameStore.getState().game!.players[1]!;
    expect(dialog.getByLabelText('Give one brick').textContent).toContain(String(bo.resources.brick - 1));
    // Asks for the wood they offered, gives the brick they asked for.
    const lanes = view.getByRole('dialog');
    expect(lanes.querySelector('.tlane-get .rchip-wood')?.textContent).toMatch(/1/);
    expect(lanes.querySelector('.tlane-give .rchip-brick')?.textContent).toMatch(/1/);

    // Ask for one more wood, then send.
    fireEvent.click(dialog.getByLabelText('Get one wood'));
    fireEvent.click(dialog.getByText('Send counter'));
    const after = useGameStore.getState();
    expect(after.error).toBeNull();
    expect(after.dialog).toBeNull();
    // The counter sits beside the offer, which stays open to the others.
    expect(after.game!.pendingTrade).toMatchObject({ proposerId: 'p0' });
    expect(after.game!.pendingTrade!.counters).toEqual([{ by: 'p1', give: { brick: 1 }, receive: { wood: 2 } }]);
    view.unmount();
  });

  it('stays open while others answer, and closes with a note if the offer is withdrawn', () => {
    const view = render(<Table />);
    fireEvent.click(view.getByText('Counter'));
    fireEvent.click(view.getByLabelText('Get one wood'));

    // Another AI says no: the offer still stands, the counter stays open, edits kept.
    act(() => useGameStore.getState().dispatch({ type: 'rejectTrade', playerId: 'p2' }));
    expect(useGameStore.getState().dialog).toBe('playerTrade');
    expect(view.getByRole('dialog').querySelector('.tlane-get .rchip-wood')?.textContent).toMatch(/2/);

    // The proposer walks away: nothing left to counter.
    act(() => useGameStore.getState().dispatch({ type: 'cancelTrade', playerId: 'p0' }));
    const after = useGameStore.getState();
    expect(after.dialog).toBeNull();
    expect(after.tradeCounter).toBeNull();
    expect(after.error).toMatch(/changed before your counter/);
    view.unmount();
  });

  it('the proposing button still opens a plain offer', () => {
    useGameStore.getState().openDialog('playerTrade');
    expect(useGameStore.getState().tradeCounter).toBeNull();
  });
});
