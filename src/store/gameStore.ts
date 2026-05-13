import { create } from 'zustand';
import type { GameState } from '@/game/types';

interface GameStore {
  state: GameState | null;
  setState: (state: GameState) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
}));
