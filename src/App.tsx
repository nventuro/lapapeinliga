import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Player, PlayerPreference, Team } from './types';
import { MIN_PLAYERS, MIN_TEAMS } from './types';
import { supabase } from './lib/supabase';
import { sortTeams } from './utils/teamSorter';
import PlayerSelector from './components/PlayerSelector';
import TeamConfigurator from './components/TeamConfigurator';
import TeamDisplay from './components/TeamDisplay';
import Footer from './components/Footer';

type Step = 'select' | 'configure' | 'results';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [players, setPlayers] = useState<Player[]>([]);
  const [preferences, setPreferences] = useState<PlayerPreference[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [result, setResult] = useState<{ teams: Team[]; reserves: Player[] } | null>(null);
  const [lastTeamCount, setLastTeamCount] = useState(MIN_TEAMS);
  const [step, setStep] = useState<Step>('select');

  // Auth effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setDataLoading(true);
      }
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setDataLoading(true);
        setDataError(null);
      } else {
        setPlayers([]);
        setPreferences([]);
        setSelectedIds(new Set());
        setResult(null);
        setStep('select');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch players and preferences when authenticated
  useEffect(() => {
    if (!session) return;

    Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('player_preferences').select('*'),
    ]).then(([playersResult, prefsResult]) => {
      if (playersResult.error) {
        setDataError(playersResult.error.message);
      } else {
        setPlayers(playersResult.data as Player[]);
      }
      if (!prefsResult.error) {
        setPreferences(prefsResult.data as PlayerPreference[]);
      }
      setDataLoading(false);
    });
  }, [session]);

  const handleSignIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  const handleToggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(players.map((p) => p.id)));
  }, [players]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedPlayers = players.filter((p) => selectedIds.has(p.id));

  const generateTeams = useCallback(
    (teamCount: number) => {
      setResult(sortTeams(selectedPlayers, teamCount, preferences));
      setLastTeamCount(teamCount);
      setStep('results');
    },
    [selectedPlayers, preferences],
  );

  const handleResort = useCallback(() => {
    setResult(sortTeams(selectedPlayers, lastTeamCount, preferences));
  }, [selectedPlayers, lastTeamCount, preferences]);

  const handleTeamsChange = useCallback(
    (teams: Team[], reserves: Player[]) => {
      setResult({ teams, reserves });
    },
    [],
  );

  const handleReset = useCallback(() => {
    setResult(null);
    setStep('select');
  }, []);

  // Loading auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <p className="text-muted text-lg">Cargando...</p>
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-3xl font-bold mb-6">La Papeinliga ⚽</h1>
          <p className="text-muted mb-8">Iniciá sesión para armar los equipos.</p>
          <button
            onClick={handleSignIn}
            className="px-6 py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors"
          >
            Iniciar sesión con Google
          </button>
        </div>
        <Footer className="absolute bottom-6" />
      </div>
    );
  }

  // Loading players
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <p className="text-muted text-lg">Cargando jugadores...</p>
      </div>
    );
  }

  // Error fetching
  if (dataError) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-error mb-4">Error: {dataError}</p>
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

  // No access (RLS returned empty)
  if (players.length === 0) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-3xl font-bold mb-4">La Papeinliga ⚽</h1>
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
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">La Papeinliga ⚽</h1>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted hover:text-muted-strong px-3 py-1 rounded-full border border-border hover:border-neutral-hover transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="flex-1">
        {step === 'select' && (
          <>
            <PlayerSelector
              players={players}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
            />
            <div className="mt-6">
              <button
                onClick={() => setStep('configure')}
                disabled={selectedIds.size < MIN_PLAYERS}
                className="w-full py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
              {selectedIds.size < MIN_PLAYERS && (
                <p className="text-sm text-error mt-2">
                  Seleccioná al menos {MIN_PLAYERS} jugadores para continuar.
                </p>
              )}
            </div>
          </>
        )}

        {step === 'configure' && (
          <>
            <TeamConfigurator
              selectedCount={selectedIds.size}
              onGenerate={generateTeams}
            />
            <button
              onClick={() => setStep('select')}
              className="mt-3 w-full py-2 rounded-lg font-medium text-muted hover:text-muted-strong transition-colors"
            >
              ← Volver a selección
            </button>
          </>
        )}

        {step === 'results' && result && (
          <TeamDisplay
            teams={result.teams}
            reserves={result.reserves}
            preferences={preferences}
            onTeamsChange={handleTeamsChange}
            onResort={handleResort}
            onReset={handleReset}
          />
        )}
        </div>

        <Footer className="mt-8 pb-4" />
      </div>
    </div>
  );
}

export default App;
