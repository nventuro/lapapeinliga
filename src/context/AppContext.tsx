import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Player, PlayerPreference, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { AppContext } from './appContext';

export function AppProvider({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [preferences, setPreferences] = useState<PlayerPreference[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [role, setRole] = useState<UserRole>('basic');
  const [currentPlayerId, setCurrentPlayerId] = useState<number | null>(null);
  const [showRatings, setShowRatingsState] = useState(false);
  const [showCosts, setShowCostsState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const SHOW_RATINGS_KEY = 'showRatings';
  const SHOW_COSTS_KEY = 'showCosts';

  const setShowRatings = useCallback((show: boolean) => {
    setShowRatingsState(show);
    localStorage.setItem(SHOW_RATINGS_KEY, JSON.stringify(show));
  }, []);

  const setShowCosts = useCallback((show: boolean) => {
    setShowCostsState(show);
    localStorage.setItem(SHOW_COSTS_KEY, JSON.stringify(show));
  }, []);

  const fetchData = useCallback(async (admin: boolean) => {
    const table = admin ? 'players' : 'players_public';
    const playersResult = await supabase.from(table).select('*').order('name');

    if (playersResult.error) {
      setError(playersResult.error.message);
      return;
    }

    setPlayers(playersResult.data as Player[]);

    // Team names are public — fetch unconditionally
    const teamNamesResult = await supabase.from('team_names').select('name').order('name');
    if (!teamNamesResult.error) {
      setTeamNames(teamNamesResult.data.map((r) => r.name));
    }

    // Preferences are admin-only (RLS restricted)
    if (admin) {
      const prefsResult = await supabase.from('player_preferences').select('*');
      if (!prefsResult.error) {
        setPreferences(prefsResult.data as PlayerPreference[]);
      }
    }

    setError(null);
  }, []);

  const isAdmin = role === 'admin';
  const isModOrAdmin = role === 'admin' || role === 'moderator';

  // Initial data load + role check
  useEffect(() => {
    async function init() {
      setLoading(true);

      let resolvedRole: UserRole = 'basic';
      if (session) {
        const [roleRes, myPlayerRes] = await Promise.all([
          supabase.rpc('current_user_role'),
          supabase.rpc('get_my_player_id'),
        ]);
        resolvedRole = (roleRes.data as UserRole | null) ?? 'basic';
        setRole(resolvedRole);
        setCurrentPlayerId((myPlayerRes.data as number | null) ?? null);

        if (resolvedRole === 'admin') {
          const stored = localStorage.getItem(SHOW_RATINGS_KEY);
          if (stored === 'true') setShowRatingsState(true);
          const storedCosts = localStorage.getItem(SHOW_COSTS_KEY);
          if (storedCosts === 'true') setShowCostsState(true);
        }
      } else {
        setRole('basic');
        setCurrentPlayerId(null);
      }

      await fetchData(resolvedRole === 'admin');
      setLoading(false);
    }
    init();
  }, [session, fetchData]);

  const refetchData = useCallback(async () => {
    await fetchData(isAdmin);
  }, [fetchData, isAdmin]);

  const signIn = useCallback(() => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem(SHOW_RATINGS_KEY);
    localStorage.removeItem(SHOW_COSTS_KEY);
    supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center">
        <p className="text-muted text-lg">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-error mb-4">Error: {error}</p>
          {session && (
            <button
              onClick={handleSignOut}
              className="text-muted hover:text-muted-strong underline"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ session, players, preferences, teamNames, role, isAdmin, isModOrAdmin, currentPlayerId, showRatings, setShowRatings, showCosts, setShowCosts, refetchData, signIn }}>
      {children}
    </AppContext.Provider>
  );
}
