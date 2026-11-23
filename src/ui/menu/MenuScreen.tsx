// The frame every screen outside a game sits in (App.tsx wraps the home
// menu and the lobby in it): the animated sunlit sea behind, and the menus'
// roomier looks for the cards, buttons and fields on top. The parchment
// palette itself is the app's (theme.css), shared with the game view. One
// instance stays mounted while moving between home, new game, online, lobby,
// rulebook and map builder, so the sea doesn't restart on each screen.

import type { ReactNode } from 'react';
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
