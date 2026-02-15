import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Player, PlayerPreference } from '../types';
import { supabase } from '../lib/supabase';
import { AppContext } from './appContext';

export function AppProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [preferences, setPreferences] = useState<PlayerPreference[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showRatings, setShowRatingsState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const SHOW_RATINGS_KEY = 'showRatings';

  const setShowRatings = useCallback((show: boolean) => {
    setShowRatingsState(show);
    localStorage.setItem(SHOW_RATINGS_KEY, JSON.stringify(show));
  }, []);

  const fetchData = useCallback(async (admin: boolean) => {
    const table = admin ? 'players' : 'players_public';
    const playersResult = await supabase.from(table).select('*').order('name');

    if (playersResult.error) {
      setError(playersResult.error.message);
      return;
    }

    setPlayers(playersResult.data as Player[]);

    // Preferences are admin-only (RLS restricted)
    if (admin) {
      const prefsResult = await supabase.from('player_preferences').select('*');
      if (!prefsResult.error) {
        setPreferences(prefsResult.data as PlayerPreference[]);
      }
    }

    setError(null);
  }, []);

  // Initial data load + admin check
  useEffect(() => {
    async function init() {
      setLoading(true);

      const { data: adminResult } = await supabase.rpc('is_admin');
      const admin = adminResult === true;
      setIsAdmin(admin);

      if (admin) {
        const stored = localStorage.getItem(SHOW_RATINGS_KEY);
        if (stored === 'true') setShowRatingsState(true);
      }

      await fetchData(admin);
      setLoading(false);
    }
    init();
  }, [fetchData]);

  const refetchData = useCallback(async () => {
    await fetchData(isAdmin);
  }, [fetchData, isAdmin]);

  const handleSignOut = () => {
    localStorage.removeItem(SHOW_RATINGS_KEY);
    supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center">
        <p className="text-muted text-lg">Cargando jugadores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-error mb-4">Error: {error}</p>
          <button
            onClick={handleSignOut}
            className="text-muted hover:text-muted-strong underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (players.length === 0 && !isAdmin) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-3xl font-bold mb-4">La Papeinliga</h1>
          <p className="text-muted mb-6">No tenés acceso a los jugadores.</p>
          <button
            onClick={handleSignOut}
            className="text-muted hover:text-muted-strong underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ session, players, preferences, isAdmin, showRatings, setShowRatings, refetchData }}>
      {children}
    </AppContext.Provider>
  );
}
