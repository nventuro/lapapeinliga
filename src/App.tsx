import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Player, Team } from './types';
import { supabase } from './lib/supabase';
import { sortTeams } from './utils/teamSorter';
import PlayerSelector from './components/PlayerSelector';
import TeamConfigurator from './components/TeamConfigurator';
import TeamDisplay from './components/TeamDisplay';

type Step = 'select' | 'configure' | 'results';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [players, setPlayers] = useState<Player[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [step, setStep] = useState<Step>('select');

  // Auth effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch players when authenticated
  useEffect(() => {
    if (!session) {
      setPlayers([]);
      return;
    }

    setDataLoading(true);
    setDataError(null);

    supabase
      .from('players')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          setDataError(error.message);
        } else {
          setPlayers(data as Player[]);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPlayers([]);
    setSelectedIds(new Set());
    setTeams([]);
    setStep('select');
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

  const generateTeams = useCallback(() => {
    const selected = players.filter((p) => selectedIds.has(p.id));
    setTeams(sortTeams(selected, teamCount));
    setStep('results');
  }, [players, selectedIds, teamCount]);

  const handleReset = useCallback(() => {
    setTeams([]);
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
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-3xl font-bold mb-6">La Papeinliga ⚽</h1>
          <p className="text-muted mb-8">Iniciá sesión para armar los equipos.</p>
          <button
            onClick={handleSignIn}
            className="px-6 py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors"
          >
            Iniciar sesión con Google
          </button>
          <div className="mt-8 flex gap-4 justify-center text-sm text-muted">
            <a href="/privacy/" className="hover:text-muted-strong transition-colors underline">
              Política de Privacidad
            </a>
            <a href="/terms/" className="hover:text-muted-strong transition-colors underline">
              Términos de Servicio
            </a>
          </div>
        </div>
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
            className="text-sm text-muted hover:text-muted-strong transition-colors"
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
                disabled={selectedIds.size < 2}
                className="w-full py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
              {selectedIds.size < 2 && (
                <p className="text-sm text-error mt-2">
                  Seleccioná al menos 2 jugadores para continuar.
                </p>
              )}
            </div>
          </>
        )}

        {step === 'configure' && (
          <>
            <TeamConfigurator
              teamCount={teamCount}
              onTeamCountChange={setTeamCount}
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

        {step === 'results' && (
          <TeamDisplay
            teams={teams}
            onResort={generateTeams}
            onReset={handleReset}
          />
        )}
        </div>

        <footer className="mt-8 pb-4 flex justify-center">
          <a
            href="https://www.instagram.com/lapapeinliga"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-muted-strong transition-colors"
            aria-label="Instagram"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.43.403a4.088 4.088 0 0 1 1.518.988c.458.458.78.96.988 1.518.163.46.349 1.26.404 2.43.058 1.266.069 1.646.069 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.403 2.43a4.088 4.088 0 0 1-.988 1.518 4.088 4.088 0 0 1-1.518.988c-.46.163-1.26.349-2.43.404-1.266.058-1.646.069-4.85.069s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.43-.403a4.088 4.088 0 0 1-1.518-.988 4.088 4.088 0 0 1-.988-1.518c-.163-.46-.349-1.26-.404-2.43C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.054-1.17.24-1.97.403-2.43a4.088 4.088 0 0 1 .988-1.518 4.088 4.088 0 0 1 1.518-.988c.46-.163 1.26-.349 2.43-.404C8.416 2.175 8.796 2.163 12 2.163M12 0C8.741 0 8.333.014 7.053.072 5.775.13 4.902.333 4.14.63a5.876 5.876 0 0 0-2.126 1.384A5.876 5.876 0 0 0 .63 4.14C.333 4.902.13 5.775.072 7.053.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.058 1.278.261 2.15.558 2.913a5.876 5.876 0 0 0 1.384 2.126 5.876 5.876 0 0 0 2.126 1.384c.763.297 1.636.5 2.913.558C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.278-.058 2.15-.261 2.913-.558a5.876 5.876 0 0 0 2.126-1.384 5.876 5.876 0 0 0 1.384-2.126c.297-.763.5-1.636.558-2.913.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.058-1.278-.261-2.15-.558-2.913a5.876 5.876 0 0 0-1.384-2.126A5.876 5.876 0 0 0 19.86.63C19.098.333 18.225.13 16.947.072 15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
            </svg>
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;
