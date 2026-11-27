import { Suspense, lazy, useEffect, useState } from 'react';
import { type DialogName, type UIMode, useGameStore } from '@/store/gameStore';
import { useNetworkStore } from '@/store/networkStore';
import { useReplayStore } from '@/store/replayStore';
import { HomeMenu } from '@/ui/newGame/HomeMenu';
import { MenuScreen } from '@/ui/menu/MenuScreen';
import { getSavedDisplayName, roomCodeFromUrl } from '@/net';
import { parsePreviewQuery } from '@/ui/mapBuilder/previewQuery';
import { LoadingScreen, prefetchGameScreens } from '@/ui/shared/lazyScreens';

// Screens past the home menu load on first use, so the first page is light:
// the game screen with its AI, the replay, the lobby, the preview.
const GameView = lazy(() => import('@/ui/game/GameView').then((m) => ({ default: m.GameView })));
const ReplayScreen = lazy(() => import('@/ui/replay/ReplayScreen').then((m) => ({ default: m.ReplayScreen })));
const LobbyScreen = lazy(() => import('@/ui/lobby/LobbyScreen').then((m) => ({ default: m.LobbyScreen })));
const ScenarioPreviewPage = lazy(() =>
  import('@/ui/mapBuilder/ScenarioPreview').then((m) => ({ default: m.ScenarioPreviewPage })),
);

/** A page opened (or reloaded) with ?room=ABCD rejoins that room, if this device has a name to join with. */
function useRejoinFromUrl(): void {
  useEffect(() => {
    const code = roomCodeFromUrl();
    const name = getSavedDisplayName();
    const net = useNetworkStore.getState();
    if (code && name && net.connection === 'disconnected' && !useGameStore.getState().game) {
      void net.joinRoom(code, name);
    }
  }, []);
}

// `?preview=<kind>:<id>` renders one scenario's board full-window (map
// checks against the rulebook; see ScenarioPreview.tsx). With `view=game`
// the fast-forwarded position is loaded into the normal game screen
// instead. Read once.
const PREVIEW_SPEC = typeof window === 'undefined' ? null : parsePreviewQuery(window.location.search);
const PREVIEW_GAME_READY: Promise<void> | null =
  PREVIEW_SPEC?.view === 'game'
    ? import('@/ui/mapBuilder/ScenarioPreview').then(({ buildPreviewGameForView }) => {
        const previewGame = buildPreviewGameForView(PREVIEW_SPEC);
        useGameStore.getState().setGameState(previewGame);
        // One human at this device: skip the hot-seat "pass the device" screen.
        useGameStore.setState({ handoffAcknowledgedForPlayer: previewGame.players[0]!.id });
        // `&dialog=<name>` opens a dialog for screenshots (e.g. progressCards).
        // `&mode=<kind>` puts the board in a click mode (e.g. recruitKnight).
        const params = new URLSearchParams(window.location.search);
        const dialog = params.get('dialog');
        if (dialog) useGameStore.setState({ dialog: dialog as DialogName });
        const mode = params.get('mode');
        if (mode) useGameStore.setState({ uiMode: { kind: mode } as UIMode });
      })
    : null;

export default function App() {
  const game = useGameStore((s) => s.game);
  const connection = useNetworkStore((s) => s.connection);
  const replayData = useReplayStore((s) => s.data);
  useRejoinFromUrl();
  const [previewGameReady, setPreviewGameReady] = useState(PREVIEW_GAME_READY === null);
  useEffect(() => {
    void PREVIEW_GAME_READY?.then(() => setPreviewGameReady(true));
  }, []);
  // Once the home screen is up and the browser is idle, fetch New Game so
  // opening it doesn't wait on the network.
  useEffect(() => prefetchGameScreens(), []);

  if (PREVIEW_SPEC && PREVIEW_SPEC.view !== 'game') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <ScenarioPreviewPage spec={PREVIEW_SPEC} />
      </Suspense>
    );
  }
  if (!previewGameReady) return <LoadingScreen />;

  // Replay overrides everything — it's a top-level view triggered either
  // from GameOver ("Watch replay") or HomeMenu ("Load replay"). Exiting
  // replay restores whichever underlying view is active.
  if (replayData) {
    return (
      <div className="app-root">
        <Suspense fallback={<LoadingScreen />}>
          <ReplayScreen />
        </Suspense>
      </div>
    );
  }
  // Game running takes priority over network screens.
  if (game) {
    return (
      <div className="app-root">
        <Suspense fallback={<LoadingScreen />}>
          <GameView />
        </Suspense>
      </div>
    );
  }
  // Everything outside a game shares one MenuScreen (the sea + parchment
  // theme); it stays mounted from home to lobby, so the sea doesn't restart.
  // In a network session before the game starts → lobby (or its
  // "connecting" / "error" card).
  const inLobby = connection === 'lobby' || connection === 'connecting' || connection === 'error';
  return (
    <div className="app-root">
      <MenuScreen>
        {inLobby ? (
          <Suspense fallback={<LoadingScreen inMenu />}>
            <LobbyScreen />
          </Suspense>
        ) : (
          <HomeMenu />
        )}
      </MenuScreen>
    </div>
  );
}
