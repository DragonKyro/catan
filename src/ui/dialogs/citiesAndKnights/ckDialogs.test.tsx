// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GameState, PlayerId, ProgressCardKind } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { updatePlayer } from '@/game/helpers';
import { progressCardDeck } from '@/game/modules/citiesAndKnights/progress/catalogue';
import {
  activeMain,
  ckAfterSetup,
  putKnight,
  roll,
  setCommodities,
} from '@/game/modules/citiesAndKnights/testSupport';
import { BARBARIAN_TRACK_LENGTH } from '@/game/modules/citiesAndKnights/constants';
import { CitiesKnightsDialogs } from './CKDialogs';
import { ActionBar } from '@/ui/panels/ActionBar';
import { BarbariansPanel } from '@/ui/panels/BarbariansPanel';
import { HandPanel } from '@/ui/panels/HandPanel';

function withCard(s: GameState, pid: PlayerId, card: ProgressCardKind): GameState {
  const track = progressCardDeck(card);
  return updatePlayer(s, pid, (p) => {
    const h = p.progressCards ?? { science: [], trade: [], politics: [] };
    return { ...p, progressCards: { ...h, [track]: [...h[track], card] } };
  });
}

function load(game: GameState, dialog: ReturnType<typeof useGameStore.getState>['dialog'] = null) {
  useGameStore.setState({
    game,
    dialog,
    uiMode: { kind: 'idle' },
    handoffPending: false,
    handoffAcknowledgedForPlayer: game.playerOrder[game.currentPlayerIndex]!,
    error: null,
  });
}

function main(): GameState {
  return activeMain(ckAfterSetup(), 'p0');
}

beforeEach(() => useGameStore.setState({ game: null, dialog: null }));
afterEach(cleanup);

describe('C&K progress card dialog', () => {
  it('lists the hand and plays a Resource Monopoly after naming a resource', () => {
    let s = withCard(main(), 'p0', 'resourceMonopoly');
    s = updatePlayer(s, 'p1', (p) => ({ ...p, resources: { ...p.resources, ore: 3 } }));
    load(s, 'progressCards');
    render(<CitiesKnightsDialogs />);
    fireEvent.click(screen.getByRole('button', { name: /Resource Monopoly/i }));
    const play = screen.getByRole('button', { name: /Name a resource/i });
    expect((play as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTitle('Ore'));
    fireEvent.click(screen.getByRole('button', { name: /Take up to 2 Ore/i }));
    const g = useGameStore.getState().game!;
    expect(g.players[1]!.resources.ore).toBe(1);
    expect(g.players[0]!.progressCards!.trade).toEqual([]);
  });

  it("explains why a card can't be played (Taxation before the first attack)", () => {
    load(withCard(main(), 'p0', 'taxation'), 'progressCards');
    render(<CitiesKnightsDialogs />);
    fireEvent.click(screen.getByRole('button', { name: /Taxation/i }));
    expect(screen.getByText(/Taxation only works once the robber is on the board/i)).toBeTruthy();
  });
});

describe('C&K city improvements dialog', () => {
  it('shows the three tracks and builds the next level', () => {
    load(setCommodities(main(), 'p0', { paper: 1 }), 'cityImprovements');
    render(<CitiesKnightsDialogs />);
    expect(screen.getByText('Science')).toBeTruthy();
    expect(screen.getByText('Trade')).toBeTruthy();
    expect(screen.getByText('Politics')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Build School/i }));
    expect(useGameStore.getState().game!.players[0]!.improvements!.science).toBe(1);
  });
});

describe('C&K sub-phase prompts', () => {
  it('asks a non-active player over 4 cards to discard', () => {
    let s = ckAfterSetup();
    for (const c of ['crane', 'mining', 'smithing', 'medicine'] as const) s = withCard(s, 'p1', c);
    s = updatePlayer(s, 'p1', (p) => ({ ...p, improvements: { science: 1, trade: 0, politics: 0 } }));
    s = { ...s, progressDecks: { ...s.progressDecks!, science: ['alchemy', 'invention'] } };
    s = roll(s, [1, 6], 'science');
    expect(s.phase).toBe('progressCardDiscard');
    load(s);
    render(<CitiesKnightsDialogs />);
    expect(screen.getByText(/Discard 1 progress card/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crane' }));
    expect(useGameStore.getState().game!.phase).toBe('main');
  });

  it('lets tied defenders pick a deck to draw from', () => {
    let s = ckAfterSetup();
    s = { ...s, barbarian: { position: BARBARIAN_TRACK_LENGTH - 1, attacksResolved: 0 } };
    const free = s.board.vertexIds.filter(
      (v) => !s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)),
    );
    s = putKnight(s, 'p0', free[0]!, 2, true);
    s = putKnight(s, 'p1', free[6]!, 2, true);
    s = roll(s, [5, 6], 'barbarian');
    load(s);
    render(<CitiesKnightsDialogs />);
    expect(screen.getByText(/driven off/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Politics/ }));
    expect(useGameStore.getState().game!.pendingDefenderTieDraw).toEqual(['p1']);
  });

  it('Commercial Harbor: the target picks the commodity to hand over', () => {
    let s = updatePlayer(main(), 'p0', (p) => ({ ...p, resources: { ...p.resources, wood: 1 } }));
    s = setCommodities(s, 'p1', { coin: 1 });
    s = { ...s, commercialHarbor: { offererId: 'p0', offeredTo: [] } };
    load(s, 'commercialHarbor');
    render(<CitiesKnightsDialogs />);
    fireEvent.click(screen.getByRole('button', { name: /P1/ }));
    fireEvent.click(screen.getByTitle('Wood'));
    fireEvent.click(screen.getByRole('button', { name: 'Offer' }));
    cleanup();
    expect(useGameStore.getState().game!.phase).toBe('commercialHarborOffer');
    // Hot-seat: the device is passed to P1, who answers.
    expect(useGameStore.getState().handoffPending).toBe(true);
    useGameStore.getState().acknowledgeHandoff();
    render(<CitiesKnightsDialogs />);
    fireEvent.click(screen.getByTitle('Coin'));
    const g = useGameStore.getState().game!;
    expect(g.players[0]!.commodities!.coin).toBe(1);
    expect(g.phase).toBe('main');
  });
});

describe('C&K panels', () => {
  it('ActionBar offers walls, knights, improvements and cards; no dev cards', () => {
    load(main());
    render(<ActionBar />);
    expect(screen.getByRole('button', { name: /Wall/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Knights/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Improve/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cards/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Dev Card/ })).toBeNull();
  });

  it('the barbarian tab draws the track and the robber waiting by it', () => {
    const { container } = (load(main()), render(<BarbariansPanel />));
    expect(container.querySelector('.bp-track-svg')).not.toBeNull();
    expect(screen.getByText(/robber waits by the track/i)).toBeTruthy();
  });

  it('the hand shows commodities and the progress cards as card faces', () => {
    load(setCommodities(withCard(main(), 'p0', 'mining'), 'p0', { cloth: 2 }));
    render(<HandPanel />);
    expect(screen.getByRole('button', { name: 'Mining' })).toBeTruthy();
    expect(screen.getAllByTitle('Cloth').length).toBeGreaterThan(0);
  });
});

describe('C&K board click modes', () => {
  it('moves a knight: pick the knight, then a highlighted destination', async () => {
    const { PlacementOverlay } = await import('@/ui/game/PlacementOverlay');
    let s = main();
    // An acting knight at the free end of p0's first road.
    const road = s.players[0]!.roads[0]!;
    const end = s.board.edges[road]!.vertices.find(
      (v) => !s.players.some((p) => p.settlements.includes(v) || p.cities.includes(v)),
    )!;
    // Give p0 a second road out of the far end so the knight can move.
    const next = s.board.vertices[end]!.edges.find(
      (e) => e !== road && !s.players.some((p) => p.roads.includes(e)),
    )!;
    s = updatePlayer(s, 'p0', (p) => ({ ...p, roads: [...p.roads, next] }));
    const dest = s.board.edges[next]!.vertices.find((v) => v !== end)!;
    s = putKnight(s, 'p0', end, 1, true);
    load(s);
    useGameStore.setState({ uiMode: { kind: 'moveKnight' } });
    const { container, rerender } = render(
      <svg>
        <PlacementOverlay />
      </svg>,
    );
    const ghosts = () => Array.from(container.querySelectorAll('g.ghost'));
    expect(ghosts()).toHaveLength(1);
    fireEvent.click(ghosts()[0]!);
    expect(useGameStore.getState().uiMode).toMatchObject({ kind: 'moveKnight', sourceVertex: end });
    rerender(
      <svg>
        <PlacementOverlay />
      </svg>,
    );
    expect(ghosts().length).toBeGreaterThan(0);
    const destGhost = ghosts().find((g) => {
      const t = g.getAttribute('transform') ?? '';
      const p = s.board.vertices[dest]!.position;
      return t.includes(`${p.x}, ${p.y}`);
    })!;
    fireEvent.click(destGhost);
    const g = useGameStore.getState().game!;
    expect(g.knights![dest]).toMatchObject({ playerId: 'p0', active: false });
    expect(g.knights![end]).toBeUndefined();
  });
});
