import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Player, PlayerPreference } from '../types';

export interface AppContextValue {
  session: Session | null;
  players: Player[];
  preferences: PlayerPreference[];
  teamNames: string[];
  isAdmin: boolean;
  showRatings: boolean;
  setShowRatings: (show: boolean) => void;
  showCosts: boolean;
  setShowCosts: (show: boolean) => void;
  refetchData: () => Promise<void>;
  signIn: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

/** The Player record claimed by the currently signed-in user, or null if none. */
export function useCurrentPlayer(): Player | null {
  const { session, players } = useAppContext();
  const email = session?.user.email;
  if (!email) return null;
  return players.find((p) => p.email === email) ?? null;
}
