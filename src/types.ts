export interface Player {
  id: number;
  name: string;
  gender: 'male' | 'female';
  rating: number; // 1-10
}

export interface Team {
  name: string;
  players: Player[];
}
