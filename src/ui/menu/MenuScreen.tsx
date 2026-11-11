// The frame every screen outside a game sits in (App.tsx wraps the home
// menu and the lobby in it): the sunlit sea behind, and a parchment palette
// for the cards, buttons and fields on top. The palette is the app's usual
// CSS variables (--panel, --text, --accent, …) redefined for this subtree,
// so the in-game view keeps its dark theme. One instance stays mounted while
// moving between home, new game, online, lobby, rulebook and map builder, so
// the sea doesn't restart on each screen.

import type { ReactNode } from 'react';
import '@fontsource/alegreya-sc/latin-700.css';
import '@fontsource/alegreya-sc/latin-900.css';
import '@fontsource/alegreya/latin-500-italic.css';
import { SeaBackdrop } from './SeaBackdrop';
import './MenuScreen.css';

export function MenuScreen({ children }: { children: ReactNode }) {
  return (
    <div className="menu-screen">
      <SeaBackdrop />
      {children}
    </div>
  );
}
