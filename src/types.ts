export interface Player {
  id: number;
  name: string;
  rating: number; // 1-5
}

export interface Team {
  name: string;
  players: Player[];
}
