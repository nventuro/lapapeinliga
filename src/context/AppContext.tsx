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
  // Default to the non-admin (preview) experience; admins opt in via the avatar menu.
  const [adminMode, setAdminMode] = useState(false);
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

  // `signal.cancelled` guards every setState: without it, a fetch issued for a
  // previous session (e.g. an admin's, still in flight at sign-out) could
  // resolve late and clobber state with data the new session must not hold.
  const fetchData = useCallback(async (admin: boolean, signal?: { cancelled: boolean }) => {
    const table = admin ? 'players' : 'players_public';
    const playersResult = await supabase.from(table).select('*').order('name');
    if (signal?.cancelled) return;

    if (playersResult.error) {
      setError(playersResult.error.message);
      return;
    }

    setPlayers(playersResult.data as Player[]);
    // Admin-only data must not survive into a non-admin session.
    if (!admin) setPreferences([]);

    // Team names are public — fetch unconditionally
    const teamNamesResult = await supabase.from('team_names').select('name').order('name');
    if (signal?.cancelled) return;
    if (!teamNamesResult.error) {
      setTeamNames(teamNamesResult.data.map((r) => r.name));
    }

    // Preferences are admin-only (RLS restricted)
    if (admin) {
      const prefsResult = await supabase.from('player_preferences').select('*');
      if (signal?.cancelled) return;
      if (!prefsResult.error) {
        setPreferences(prefsResult.data as PlayerPreference[]);
      }
    }

    setError(null);
  }, []);

  // Real privileges from the user's role.
  const isActualAdmin = role === 'admin';
  const isActualModOrAdmin = role === 'admin' || role === 'moderator';

  // An actual admin can turn off admin mode to preview the app as a non-admin.
  // While previewing, all elevated privileges drop and score/cost displays are
  // forced off, so the UI matches exactly what a non-admin sees.
  const previewingAsNonAdmin = isActualAdmin && !adminMode;
  const isAdmin = isActualAdmin && !previewingAsNonAdmin;
  const isModOrAdmin = isActualModOrAdmin && !previewingAsNonAdmin;
  const effectiveShowRatings = showRatings && !previewingAsNonAdmin;
  const effectiveShowCosts = showCosts && !previewingAsNonAdmin;

  // Initial data load + role check
  useEffect(() => {
    const signal = { cancelled: false };

    async function init() {
      setLoading(true);

      let resolvedRole: UserRole = 'basic';
      if (session) {
        const [roleRes, myPlayerRes] = await Promise.all([
          supabase.rpc('current_user_role'),
          supabase.rpc('get_my_player_id'),
        ]);
        if (signal.cancelled) return;

        // A failed role check must surface, not silently demote an admin to a
        // basic session that then behaves confusingly.
        if (roleRes.error) {
          setError(roleRes.error.message);
          setLoading(false);
          return;
        }

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

      await fetchData(resolvedRole === 'admin', signal);
      if (!signal.cancelled) setLoading(false);
    }
    init();

    return () => { signal.cancelled = true; };
  }, [session, fetchData]);

  const refetchData = useCallback(async () => {
    // Data privileges follow the real role, not the non-admin preview.
    await fetchData(isActualAdmin);
  }, [fetchData, isActualAdmin]);

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
    <AppContext.Provider value={{ session, players, preferences, teamNames, role, isAdmin, isModOrAdmin, isActualAdmin, adminMode, setAdminMode, currentPlayerId, showRatings: effectiveShowRatings, setShowRatings, showCosts: effectiveShowCosts, setShowCosts, refetchData, signIn }}>
      {children}
    </AppContext.Provider>
  );
}
