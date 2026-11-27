// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import type { GameState } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { PendingTradeBanner } from './PendingTradeBanner';

/** p0 (human, to play) has offered 1 wood for 1 brick; the three AIs can pay. */
function offer(): GameState {
  let s = runSetupPhase(
    createGame({ playerNames: ['Ann', 'Bo', 'Cy', 'Di'], playerTypes: ['human', 'ai', 'ai', 'ai'], seed: 42, randomizeTurnOrder: false }),
  );
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  s = giveResources(s, 'p0', { wood: 2 });
  for (const id of ['p1', 'p2', 'p3']) s = giveResources(s, id, { brick: 2 });
  return applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
}

describe('PendingTradeBanner: the proposer picks who to trade with', () => {
  it('waits for answers, then offers a Trade with button per acceptor', () => {
    let s = offer();
    useGameStore.setState({ game: s });
    const view = render(<PendingTradeBanner />);
    expect(view.getByText(/Waiting for answers/)).toBeTruthy();
    // My own offer, from my seat: the brick comes in, the wood goes out.
    expect(view.getByText('Your offer')).toBeTruthy();
    expect(view.container.querySelector('.tlane-get .rchip-brick')).toBeTruthy();
    expect(view.container.querySelector('.tlane-give .rchip-wood')).toBeTruthy();
    expect(view.queryByText(/Trade with/)).toBeNull();

    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    s = applyAction(s, { type: 'rejectTrade', playerId: 'p2' });
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p3' });
    useGameStore.setState({ game: s });
    view.rerender(<PendingTradeBanner />);
    expect(view.getByText('Trade with Bo')).toBeTruthy();
    expect(view.getByText('Trade with Di')).toBeTruthy();
    expect(view.queryByText('Trade with Cy')).toBeNull(); // rejected

    const diBrick = s.players[3]!.resources.brick;
    fireEvent.click(view.getByText('Trade with Di'));
    const after = useGameStore.getState().game!;
    expect(after.pendingTrade).toBeUndefined();
    expect(after.players[3]!.resources.brick).toBe(diBrick - 1);
    expect(after.players[1]!.resources.brick).toBe(s.players[1]!.resources.brick);
    view.unmount();
  });
});
