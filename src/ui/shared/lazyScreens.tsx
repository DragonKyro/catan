// Code-split screens: what shows while one loads, and the idle-time prefetch
// of New Game once the home screen is up, so the first page is light and the
// next screen opens at once.

import './lazyScreens.css';

/** Shown for the moment a screen's code is still on its way. */
export function LoadingScreen({ inMenu }: { inMenu?: boolean }) {
  return (
    <div className={`lazy-loading${inMenu ? ' lazy-loading-menu' : ''}`} role="status">
      Loading…
    </div>
  );
}

let prefetched = false;

/** Fetch New Game in the background once the browser is idle (once per page). */
export function prefetchGameScreens(): void {
  if (prefetched || typeof window === 'undefined') return;
  prefetched = true;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const idle = (cb: () => void, timeout: number) =>
    w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout }) : window.setTimeout(cb, 300);
  // New Game (small, and the screen most people open next) as soon as the
  // home screen settles. The game screen (its AI is the big part) loads when
  // a game starts: compiling it in the background made the menus stutter.
  idle(() => void import('@/ui/newGame/NewGame').catch(() => undefined), 1500);
}
