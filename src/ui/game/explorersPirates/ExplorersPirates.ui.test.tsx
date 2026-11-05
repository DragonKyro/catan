// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { applyAction } from '@/game/engine';
import type { GameState } from '@/game/types';
import { exploreHex } from '@/game/modules/explorersPirates/explore';
import { legalShipSteps, shipById, type EpGame } from '@/game/modules/explorersPirates/state';
import {
  edgeOf,
  epGame,
  epMainPhase,
  patchEpState,
  putShip,
  runEpSetup,
  setHidden,
  setPlayer,
} from '@/game/modules/explorersPirates/testSupport';
import { canPlaceInitialRoad, canPlaceInitialSettlement } from '@/game/placement';
import { epSetupShipEdges } from '@/game/modules/explorersPirates/setup';
import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from '../BoardSVG';
import { ExplorersPiratesOverlay } from './ExplorersPiratesOverlay';
import { EpMainButtons, EpPhaseBar } from './ExplorersPiratesActions';
import { EpHandStrip, EpOpponentStats } from './ExplorersPiratesHand';
import { ExplorersPiratesTracker } from '@/ui/panels/explorersPirates/ExplorersPiratesTracker';
import { evictionChoices } from './shipActions';
import { epDefaultPirateAction } from './defaults';

function toMovement(s: GameState): EpGame {
  return applyAction(s, { type: 'endTurn', playerId: s.playerOrder[s.currentPlayerIndex]! }) as EpGame;
}

describe('Explorers & Pirates UI', () => {
  beforeEach(() => {
    useGameStore.setState({ game: null, uiMode: { kind: 'idle' }, dialog: null, pendingPirateHex: null });
  });

  it('draws the face-down backs by region only, the Council, harbor settlements and ships', () => {
    const game = runEpSetup(epGame(2, 3));
    const { container } = render(<BoardSVG game={game} />);
    const hidden = Object.keys(game.explorersPirates.hidden).length;
    expect(container.querySelectorAll('.ep-back').length).toBe(hidden);
    expect(container.querySelectorAll('.ep-back-parrot').length).toBe(16);
    expect(container.querySelectorAll('.ep-back-goose').length).toBe(16);
    expect(container.querySelector('.ep-council')).not.toBeNull();
    // Harbor settlements replace the plain settlement glyph.
    expect(container.querySelectorAll('.ep-harbor').length).toBe(3);
    expect(container.querySelectorAll('g.settlement').length).toBe(3);
    expect(container.querySelectorAll('.ep-ship').length).toBe(3);
    // Nothing face down is named: no spice farm, lair or shoal art yet.
    expect(container.querySelector('.ep-farm, .ep-lair, .ep-shoal')).toBeNull();
  });

  it('keeps an uncaptured lair’s number secret and shows the number once captured', () => {
    let s: GameState = epMainPhase(1);
    s = setHidden(s, '2,-1', { terrain: 'gold' });
    [s] = exploreHex(s as EpGame, 'p0', '2,-1');
    const lair = s.explorersPirates!.lairs[0]!;
    const before = render(<BoardSVG game={s} />);
    const lairArt = before.container.querySelector('.ep-lair')!;
    expect(lairArt).not.toBeNull();
    expect(lairArt.textContent).toContain('0/3');
    const texts = [...lairArt.querySelectorAll('text')].map((t) => t.textContent);
    expect(texts).not.toContain(String(lair.number));
    expect(before.container.querySelector('.hex-gold')!.querySelector('text')).toBeNull();
    before.unmount();
    const captured = patchEpState(s, (ep) => ({ lairs: ep.lairs.map((l) => ({ ...l, captured: true })) }));
    const withToken = {
      ...captured,
      board: {
        ...captured.board,
        hexes: { ...captured.board.hexes, '2,-1': { ...captured.board.hexes['2,-1']!, numberToken: lair.number } },
      },
    };
    const after = render(<BoardSVG game={withToken} />);
    expect(after.container.querySelector('.ep-lair.is-captured')).not.toBeNull();
    expect(after.container.querySelector('.hex-gold')!.textContent).toContain(String(lair.number));
  });

  it('setup round 3: the ship ghosts dispatch placeInitialShip', () => {
    let s: GameState = epGame(2, 3);
    // Play until the first ship step.
    for (let i = 0; i < 20 && s.setupState?.step !== 'ship'; i++) s = stepOnce(s);
    expect(s.setupState?.step).toBe('ship');
    const pid = s.playerOrder[s.currentPlayerIndex]!;
    useGameStore.setState({ game: s, uiMode: { kind: 'epSetupShip' } });
    const { container } = render(
      <svg>
        <ExplorersPiratesOverlay game={s} acting={pid} mode={{ kind: 'epSetupShip' }} color="red" />
      </svg>,
    );
    const ghosts = container.querySelectorAll('.ep-setup-ship g.ghost');
    expect(ghosts.length).toBeGreaterThan(0);
    fireEvent.click(ghosts[0]!);
    const after = useGameStore.getState().game!;
    expect(after.explorersPirates!.ships.filter((x) => x.owner === pid).length).toBe(1);
  });

  it('Movement phase: picks a ship, shows each legal step, and sails on click', () => {
    let s: GameState = epMainPhase(1);
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 2) });
    s = toMovement(s);
    useGameStore.setState({ game: s, uiMode: { kind: 'epMove', ship: 'a' } });
    const { container } = render(
      <svg>
        <ExplorersPiratesOverlay game={s} acting="p0" mode={{ kind: 'epMove', ship: 'a' }} color="red" />
      </svg>,
    );
    const steps = legalShipSteps(s, 'a');
    const targets = container.querySelectorAll('.ep-step');
    expect(targets.length).toBe(steps.length);
    // Badges show the MP left after the step.
    expect(targets[0]!.textContent).toMatch(/[0-9→]/);
    fireEvent.click(targets[0]!);
    const after = useGameStore.getState().game!;
    expect(shipById(after, 'a')!.edge).toBe(steps[0]);
    // The ship stays selected for the next step.
    expect(useGameStore.getState().uiMode).toEqual({ kind: 'epMove', ship: 'a' });
  });

  it('Movement bar: boost, fish roll, found settlement and Done for the selected ship', () => {
    let s: GameState = epMainPhase(1);
    s = setPlayer(s, 'p0', { resources: { wood: 0, brick: 0, sheep: 1, wheat: 0, ore: 0 } });
    s = toMovement(s);
    const mine = s.explorersPirates!.ships.find((x) => x.owner === 'p0')!;
    useGameStore.setState({ game: s, uiMode: { kind: 'epMove', ship: mine.id } });
    const { container } = render(<EpPhaseBar game={s} acting="p0" />);
    const text = container.textContent ?? '';
    expect(text).toContain('MP left');
    expect(text).toContain('+2 MP');
    expect(text).toContain('Fish');
    expect(text).toContain('Done');
    const boost = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('+2 MP'))!;
    expect(boost.hasAttribute('disabled')).toBe(false);
    fireEvent.click(boost);
    expect(useGameStore.getState().game!.explorersPirates!.movement!.boosted).toContain(mine.id);
  });

  it('Action phase buttons: harbor, ship, settler, crew, coins, and the Movement end button', () => {
    const s = epMainPhase(1);
    useGameStore.setState({ game: s });
    const { container } = render(<EpMainButtons game={s} acting="p0" />);
    const text = container.textContent ?? '';
    for (const label of ['Road', 'Settlement', 'Harbor', 'Ship', 'Settler', 'Crew', 'Coins', 'Trade', 'Movement']) {
      expect(text).toContain(label);
    }
    expect(text).not.toContain('City');
    expect(text).not.toContain('Dev Card');
  });

  it('offers the smallest evictions for a full spot', () => {
    let s: GameState = epMainPhase(1);
    s = putShip(s, { id: 'z', owner: 'p0', edge: edgeOf(s, 1, -1, 2), cargo: ['crew', 'crew'] });
    expect(evictionChoices(s, { ship: 'z' }, 'crew')).toEqual([['crew']]);
    expect(evictionChoices(s, { ship: 'z' }, 'settler')).toEqual([['crew', 'crew']]);
  });

  it('pirate placement: rings every legal hex; a single victim is robbed on click', () => {
    let s: GameState = epMainPhase(1);
    s = { ...s, phase: 'epPlacePirate' };
    s = patchEpState(s, () => ({ pendingPirate: { playerId: 'p0', reason: 'seven', returnTo: 'main' } }));
    useGameStore.setState({ game: s, uiMode: { kind: 'epPirate' } });
    const { container } = render(
      <svg>
        <ExplorersPiratesOverlay game={s} acting="p0" mode={{ kind: 'epPirate' }} color="red" />
      </svg>,
    );
    const rings = container.querySelectorAll('.ep-pirate-spots g.ghost');
    expect(rings.length).toBeGreaterThan(0);
    fireEvent.click(rings[0]!);
    const after = useGameStore.getState().game!;
    expect(after.phase).toBe('main');
    expect(after.explorersPirates!.pirate?.owner).toBe('p0');
    // The timer's default picks a legal spot too.
    expect(epDefaultPirateAction(s, 'p0')).toMatchObject({ type: 'epPlacePirate', playerId: 'p0' });
  });

  it('hand strip, opponent stats and the scenario tracker', () => {
    const s = epMainPhase(1);
    const p0 = s.players.find((p) => p.id === 'p0')!;
    const strip = render(<EpHandStrip game={s} player={p0} ownTurn />);
    expect(strip.container.querySelectorAll('.hand-traders-group').length).toBe(7);
    const opp = render(<EpOpponentStats game={s} player={p0} />);
    expect(opp.container.textContent).toContain('1');
    const tracker = render(<ExplorersPiratesTracker game={s} />);
    const t = tracker.container.textContent ?? '';
    expect(t).toContain('Pirate Lairs');
    expect(t).toContain('Fish for Catan');
    expect(t).toContain('Spices for Catan');
    expect(t).toContain('0/32 hexes discovered');
    expect(t).toContain('17 VP');
  });
});

// One setup placement with the first legal spot.
function stepOnce(s: GameState): GameState {
  const pid = s.playerOrder[s.currentPlayerIndex]!;
  const step = s.setupState!.step;
  if (step === 'settlement') {
    const v = s.board.vertexIds.find((x) => canPlaceInitialSettlement(s, x))!;
    return applyAction(s, { type: 'placeInitialSettlement', playerId: pid, vertex: v });
  }
  if (step === 'road') {
    const anchor = s.setupState!.lastPlacedSettlement!;
    const e = s.board.vertices[anchor]!.edges.find((x) => canPlaceInitialRoad(s, anchor, x))!;
    return applyAction(s, { type: 'placeInitialRoad', playerId: pid, edge: e });
  }
  return applyAction(s, { type: 'placeInitialShip', playerId: pid, edge: epSetupShipEdges(s, pid)[0]! });
}
