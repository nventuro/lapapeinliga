import { useState, useCallback, useEffect } from 'react';
import type { Player, PlayerLocks, Team, EventType } from '../types';
import { MIN_TRAINING_PLAYERS, MIN_TEAMS } from '../types';
import { sortTeams } from '../utils/teamSorter';
import { useAppContext } from '../context/appContext';
import PlayerSelector from './PlayerSelector';
import EventConfigurator from './EventConfigurator';
import CoachAssignment from './CoachAssignment';
import TeamBuildingDisplay from './TeamBuildingDisplay';
import TrainingPreview from './TrainingPreview';
import NoAccess from './NoAccess';
import { GenderMaleIcon, GenderFemaleIcon } from './icons';

type Step = 'select' | 'configure' | 'assign-coaches' | 'results';

interface StateCache {
  selectedIds: Set<number>;
  result: { teams: Team[]; reserves: Player[] } | null;
  lastTeamCount: number;
  step: Step;
  lockedIds: Set<number>;
  eventType: EventType | null;
  coachIds: Set<number>;
}

// Preserve state across navigations so switching tabs doesn't lose progress
let stateCache: StateCache | null = null;

export default function TeamSorterPage() {
  const { players, preferences, isAdmin } = useAppContext();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => stateCache?.selectedIds ?? new Set());
  const [result, setResult] = useState<{ teams: Team[]; reserves: Player[] } | null>(() => stateCache?.result ?? null);
  const [lastTeamCount, setLastTeamCount] = useState(() => stateCache?.lastTeamCount ?? MIN_TEAMS);
  const [step, setStep] = useState<Step>(() => stateCache?.step ?? 'select');
  const [lockedIds, setLockedIds] = useState<Set<number>>(() => stateCache?.lockedIds ?? new Set());
  const [eventType, setEventType] = useState<EventType | null>(() => stateCache?.eventType ?? null);
  const [coachIds, setCoachIds] = useState<Set<number>>(() => stateCache?.coachIds ?? new Set());

  // Sync state to module-level cache so it's preserved across navigations
  useEffect(() => {
    stateCache = { selectedIds, result, lastTeamCount, step, lockedIds, eventType, coachIds };
  }, [selectedIds, result, lastTeamCount, step, lockedIds, eventType, coachIds]);

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
      setEventType('match');
      setStep('results');
    },
    [selectedPlayers, preferences],
  );

  const generateTournament = useCallback(
    (teamCount: number) => {
      setResult(sortTeams(selectedPlayers, teamCount, preferences));
      setLastTeamCount(teamCount);
      setEventType('tournament');
      setStep('results');
    },
    [selectedPlayers, preferences],
  );

  const handleTraining = useCallback(() => {
    setEventType('training');
    setCoachIds(new Set());
    setStep('assign-coaches');
  }, []);

  const handleCoachConfirm = useCallback(() => {
    setStep('results');
  }, []);

  const handleToggleCoach = useCallback((id: number) => {
    setCoachIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
    setEventType(null);
    setCoachIds(new Set());
    setStep('select');
    stateCache = null;
  }, []);

  if (!isAdmin) {
    return <NoAccess />;
  }

  const trainingAttendees = selectedPlayers.filter((p) => !coachIds.has(p.id));
  const trainingCoaches = selectedPlayers.filter((p) => coachIds.has(p.id));

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
                {selectedPlayers.filter((p) => p.gender === 'male').length}<GenderMaleIcon className="w-4 h-4 inline" />
                {' '}
                {selectedPlayers.filter((p) => p.gender === 'female').length}<GenderFemaleIcon className="w-4 h-4 inline" />
              </span>
            </div>
            <button
              onClick={() => setStep('configure')}
              disabled={selectedIds.size < MIN_TRAINING_PLAYERS}
              className="w-full py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
            {selectedIds.size < MIN_TRAINING_PLAYERS && (
              <p className="text-sm text-error mt-2">
                Seleccioná al menos {MIN_TRAINING_PLAYERS} jugadores para continuar.
              </p>
            )}
          </div>
        </>
      )}

      {step === 'configure' && (
        <>
          <EventConfigurator
            selectedCount={selectedIds.size}
            onGenerate={generateTeams}
            onTournament={generateTournament}
            onTraining={handleTraining}
          />
          <button
            onClick={() => setStep('select')}
            className="mt-3 w-full py-2 rounded-lg font-medium text-muted hover:text-muted-strong transition-colors"
          >
            ← Volver a selección
          </button>
        </>
      )}

      {step === 'assign-coaches' && (
        <CoachAssignment
          players={selectedPlayers}
          coachIds={coachIds}
          onToggleCoach={handleToggleCoach}
          onConfirm={handleCoachConfirm}
          onBack={() => setStep('configure')}
        />
      )}

      {step === 'results' && (eventType === 'match' || eventType === 'tournament') && result && (
        <TeamBuildingDisplay
          eventType={eventType}
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

      {step === 'results' && eventType === 'training' && (
        <TrainingPreview
          attendees={trainingAttendees}
          coaches={trainingCoaches}
          onReset={handleReset}
        />
      )}
    </>
  );
}
