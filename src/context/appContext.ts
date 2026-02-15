import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Player, PlayerPreference } from '../types';

export interface AppContextValue {
  session: Session;
  players: Player[];
  preferences: PlayerPreference[];
  isAdmin: boolean;
  showRatings: boolean;
  setShowRatings: (show: boolean) => void;
  refetchData: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
