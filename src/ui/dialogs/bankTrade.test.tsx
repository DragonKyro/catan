// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import type { GameState, TradeGood } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { BankTradeDialog } from './BankTradeDialog';
import { PlayerTradeDialog } from './PlayerTradeDialog';
import { planBankTrade } from './bankTradePlan';

const at = (rates: Partial<Record<TradeGood, number>>) => (g: TradeGood) => rates[g] ?? 4;
const plenty = () => 19;

describe('planBankTrade', () => {
  it('splits one good given for a mix of cards', () => {
    expect(planBankTrade('p0', { wood: 8 }, { wheat: 1, sheep: 1 }, at({}), plenty)).toEqual([
      { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'wheat', count: 1 },
      { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'sheep', count: 1 },
    ]);
  });

  it('pays each card with one lot at its own rate', () => {
    expect(planBankTrade('p0', { wood: 4, sheep: 2 }, { ore: 2 }, at({ sheep: 2 }), plenty)).toEqual([
      { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'ore', count: 1 },
      { type: 'bankTrade', playerId: 'p0', give: 'sheep', receive: 'ore', count: 1 },
    ]);
    expect(planBankTrade('p0', { wheat: 6 }, { ore: 3 }, at({ wheat: 2 }), plenty)).toEqual([
      { type: 'bankTrade', playerId: 'p0', give: 'wheat', receive: 'ore', count: 3 },
    ]);
  });

  it('refuses lopsided trades and a short supply', () => {
    expect(planBankTrade('p0', { wood: 5 }, { ore: 1 }, at({}), plenty)).toBeNull();
    expect(planBankTrade('p0', { wood: 8 }, { ore: 1 }, at({}), plenty)).toBeNull();
    expect(planBankTrade('p0', { wood: 4 }, {}, at({}), plenty)).toBeNull();
    expect(planBankTrade('p0', { wood: 8 }, { ore: 2 }, at({}), () => 1)).toBeNull();
  });

  it('uses the Cities & Knights action when a commodity is involved', () => {
    expect(planBankTrade('p0', { paper: 4, wood: 4 }, { ore: 1, cloth: 1 }, at({}), plenty)).toEqual([
      { type: 'bankTradeCK', playerId: 'p0', give: 'paper', receive: 'ore', count: 1 },
      { type: 'bankTradeCK', playerId: 'p0', give: 'wood', receive: 'cloth', count: 1 },
    ]);
  });
});

/** Ann (human, to play, no harbors) holds 8 extra wood in her main phase. */
function annWithWood(): GameState {
  let s = runSetupPhase(
    createGame({ playerNames: ['Ann', 'Bo', 'Cy'], playerTypes: ['human', 'ai', 'ai'], seed: 42, randomizeTurnOrder: false }),
  );
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  s = giveResources(s, 'p0', { wood: 8 });
  return { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: [] } : p)) };
}

describe('a mixed bank trade', () => {
  let start: GameState;
  beforeEach(() => {
    start = annWithWood();
    useGameStore.setState({ game: start, dialog: null, tradeCounter: null, error: null, lastActionSnapshot: null });
  });

  const expectTraded = () => {
    const after = useGameStore.getState();
    expect(after.error).toBeNull();
    const [was, now] = [start.players[0]!.resources, after.game!.players[0]!.resources];
    expect(now.wood).toBe(was.wood - 8);
    expect(now.wheat).toBe(was.wheat + 1);
    expect(now.sheep).toBe(was.sheep + 1);
    expect(after.game!.bank.wood).toBe(start.bank.wood + 8);
    expect(after.game!.pendingTrade).toBeFalsy();
  };

  it('bank-only window: wood goes in whole lots, undone in one go', () => {
    const view = render(<BankTradeDialog />);
    expect(view.queryByText('Offer to players')).toBeNull();
    fireEvent.click(view.getByLabelText('Give 4 wood'));
    fireEvent.click(view.getByLabelText('Give 4 wood'));
    fireEvent.click(view.getByLabelText('Get one wheat'));
    fireEvent.click(view.getByLabelText('Get one sheep'));
    fireEvent.click(view.getByRole('button', { name: /Bank \(4:1\)/ }));
    view.unmount();
    expectTraded();

    useGameStore.getState().undo();
    expect(useGameStore.getState().game).toBe(start);
  });

  it('trade window: the Bank button lights up only when the bank can do it', () => {
    useGameStore.getState().openDialog('playerTrade');
    const view = render(<PlayerTradeDialog />);
    const bank = () => view.getByRole('button', { name: /Bank/ }) as HTMLButtonElement;
    for (let i = 0; i < 7; i++) fireEvent.click(view.getByLabelText('Give one wood'));
    fireEvent.click(view.getByLabelText('Get one wheat'));
    fireEvent.click(view.getByLabelText('Get one sheep'));
    expect(bank().disabled).toBe(true);
    expect((view.getByText('Offer to players') as HTMLButtonElement).disabled).toBe(false);
    // A card can't be on both sides.
    expect((view.getByLabelText('Get one wood') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(view.getByLabelText('Give one wood'));
    expect(bank().textContent).toMatch(/Bank \(4:1\)/);
    fireEvent.click(bank());
    view.unmount();
    expectTraded();
  });

  it('tapping a card in a lane takes it back', () => {
    useGameStore.getState().openDialog('playerTrade');
    const view = render(<PlayerTradeDialog />);
    fireEvent.click(view.getByLabelText('Give one wood'));
    fireEvent.click(view.getByLabelText('Give one wood'));
    fireEvent.click(view.getByLabelText('Give one less wood'));
    expect(view.container.querySelector('.tlane-give .rchip-wood')?.textContent).toMatch(/1/);
    fireEvent.click(view.getByLabelText('Give one less wood'));
    expect(view.container.querySelector('.tlane-give .rchip-wood')).toBeNull();
    view.unmount();
  });
});
