export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

export interface GameState {
  players: Player[];
}

export type Action = { type: 'placeholder' };
