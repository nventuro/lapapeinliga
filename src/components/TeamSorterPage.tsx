import { useState, useCallback } from 'react';
import type { Player, PlayerLocks, Team } from '../types';
import { MIN_PLAYERS, MIN_TEAMS } from '../types';
import { sortTeams } from '../utils/teamSorter';
import { useAppContext } from '../context/appContext';
import PlayerSelector from './PlayerSelector';
import TeamConfigurator from './TeamConfigurator';
import TeamDisplay from './TeamDisplay';
import NoAccess from './NoAccess';

type Step = 'select' | 'configure' | 'results';

export default function TeamSorterPage() {
  const { players, preferences, isAdmin } = useAppContext();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [result, setResult] = useState<{ teams: Team[]; reserves: Player[] } | null>(null);
  const [lastTeamCount, setLastTeamCount] = useState(MIN_TEAMS);
  const [step, setStep] = useState<Step>('select');
  const [lockedIds, setLockedIds] = useState<Set<number>>(() => new Set());

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

  const handleSelectMany = useCallback((ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const handleDeselectMany = useCallback((ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const handleToggleLock = useCallback((id: number) => {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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

  function buildLocksMap(teams: Team[], reserves: Player[], locked: Set<number>): PlayerLocks {
    const locks: PlayerLocks = new Map();
    for (let i = 0; i < teams.length; i++) {
      for (const p of teams[i].players) {
        if (locked.has(p.id)) locks.set(p.id, i);
      }
    }
    for (const p of reserves) {
      if (locked.has(p.id)) locks.set(p.id, 'reserves');
    }
    return locks;
  }

  const handleResort = useCallback(() => {
    const locks = result ? buildLocksMap(result.teams, result.reserves, lockedIds) : new Map();
    setResult(sortTeams(selectedPlayers, lastTeamCount, preferences, locks));
  }, [selectedPlayers, lastTeamCount, preferences, result, lockedIds]);

  const handleTeamsChange = useCallback(
    (teams: Team[], reserves: Player[]) => {
      setResult({ teams, reserves });
    },
    [],
  );

  const handleReset = useCallback(() => {
    setResult(null);
    setLockedIds(new Set());
    setStep('select');
  }, []);

  if (!isAdmin) {
    return <NoAccess />;
  }

  return (
    <>
      {step === 'select' && (
        <>
          <PlayerSelector
            players={players}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onSelectMany={handleSelectMany}
            onDeselectMany={handleDeselectMany}
          />
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3 text-sm text-muted">
              <span>
                {selectedIds.size} / {players.length} jugadores
              </span>
              <span>
                {selectedPlayers.filter((p) => p.gender === 'male').length}<span className="text-lg">♂</span>
                {' '}
                {selectedPlayers.filter((p) => p.gender === 'female').length}<span className="text-lg">♀</span>
              </span>
            </div>
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
          lockedIds={lockedIds}
          onToggleLock={handleToggleLock}
          onTeamsChange={handleTeamsChange}
          onResort={handleResort}
          onReset={handleReset}
        />
      )}
    </>
  );
}
