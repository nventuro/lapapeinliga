import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Player, PlayerPreference, UserRole } from '../types';

export interface AppContextValue {
  session: Session | null;
  players: Player[];
  preferences: PlayerPreference[];
  teamNames: string[];
  role: UserRole;
  // Effective privileges: false while an admin turns off admin mode to preview
  // the app as a non-admin would see it. Use these to gate all admin/mod UI.
  isAdmin: boolean;
  isModOrAdmin: boolean;
  // The user's real admin status, ignoring admin mode. Use only to decide
  // whether to offer the admin-mode toggle itself.
  isActualAdmin: boolean;
  // Whether an actual admin currently has admin features on. Off means they're
  // previewing the app as a non-admin. No effect for non-admins.
  adminMode: boolean;
  setAdminMode: (on: boolean) => void;
  currentPlayerId: number | null;
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
  const { currentPlayerId, players } = useAppContext();
  if (currentPlayerId == null) return null;
  return players.find((p) => p.id === currentPlayerId) ?? null;
}
