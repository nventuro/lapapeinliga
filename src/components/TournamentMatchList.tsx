import { useState } from 'react';
import type { TournamentTeam, TournamentMatch } from '../types';
import { TrashIcon } from './icons';
import Tooltip from './Tooltip';
import ConfirmAction from './ConfirmAction';

interface TournamentMatchListProps {
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  isAdmin: boolean;
  saving: boolean;
  onAddMatch: (teamAId: number, teamBId: number) => void;
  onUpdateScore: (matchId: number, scoreA: number | null, scoreB: number | null) => void;
  onDeleteMatch: (matchId: number) => void;
}

function teamName(teams: TournamentTeam[], teamId: number): string {
  return teams.find((t) => t.id === teamId)?.name ?? '?';
}

export default function TournamentMatchList({
  teams,
  matches,
  isAdmin,
  saving,
  onAddMatch,
  onUpdateScore,
  onDeleteMatch,
}: TournamentMatchListProps) {
  const [addingMatch, setAddingMatch] = useState(false);
  const [newTeamAId, setNewTeamAId] = useState<number | ''>('');
  const [newTeamBId, setNewTeamBId] = useState<number | ''>('');
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [editScoreA, setEditScoreA] = useState('');
  const [editScoreB, setEditScoreB] = useState('');

  function handleSubmitNewMatch() {
    if (newTeamAId === '' || newTeamBId === '') return;
    onAddMatch(newTeamAId, newTeamBId);
    setAddingMatch(false);
    setNewTeamAId('');
    setNewTeamBId('');
  }

  function handleStartEditScore(match: TournamentMatch) {
    setEditingMatchId(match.id);
    setEditScoreA(match.score_a !== null ? String(match.score_a) : '');
    setEditScoreB(match.score_b !== null ? String(match.score_b) : '');
  }

  function handleSaveScore() {
    if (editingMatchId === null) return;
    const a = editScoreA.trim();
    const b = editScoreB.trim();
    // Both empty = clear score; both filled = set score
    if (a === '' && b === '') {
      onUpdateScore(editingMatchId, null, null);
    } else if (a !== '' && b !== '') {
      onUpdateScore(editingMatchId, parseInt(a, 10), parseInt(b, 10));
    }
    setEditingMatchId(null);
  }

  const canSaveScore = (() => {
    const a = editScoreA.trim();
    const b = editScoreB.trim();
    return (a === '' && b === '') || (a !== '' && b !== '' && !isNaN(Number(a)) && !isNaN(Number(b)));
  })();

  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <h3 className="font-bold text-lg mb-3">Partidos</h3>

      {matches.length === 0 && (
        <p className="text-sm text-muted">No hay partidos todavía.</p>
      )}

      <div className="space-y-2">
        {matches.map((match) => {
          const isEditing = editingMatchId === match.id;
          return (
            <div key={match.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-neutral/30">
              <span className="font-medium flex-1 text-right">{teamName(teams, match.team_a_id)}</span>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editScoreA}
                    onChange={(e) => setEditScoreA(e.target.value)}
                    className="w-10 px-1 py-0.5 text-center rounded border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-muted">-</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editScoreB}
                    onChange={(e) => setEditScoreB(e.target.value)}
                    className="w-10 px-1 py-0.5 text-center rounded border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ) : (
                <span className="text-center min-w-16 font-bold">
                  {match.score_a !== null ? `${match.score_a} - ${match.score_b}` : 'vs'}
                </span>
              )}

              <span className="font-medium flex-1">{teamName(teams, match.team_b_id)}</span>

              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setEditingMatchId(null)}
                        className="text-xs px-2 py-1 rounded text-muted hover:text-muted-strong transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveScore}
                        disabled={saving || !canSaveScore}
                        className="text-xs px-2 py-1 rounded font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
                      >
                        Guardar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEditScore(match)}
                        className="text-xs px-2 py-1 rounded text-muted hover:text-muted-strong transition-colors"
                      >
                        {match.score_a !== null ? 'Editar' : 'Resultado'}
                      </button>
                      <ConfirmAction
                        label=""
                        message="¿Eliminar este partido?"
                        onConfirm={() => onDeleteMatch(match.id)}
                        renderTrigger={(onClick) => (
                          <Tooltip label="Eliminar partido">
                            <button
                              onClick={onClick}
                              className="p-1 rounded text-muted hover:text-error transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        )}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <>
          {addingMatch ? (
            <div className="mt-3 border border-border rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Equipo A</label>
                  <select
                    value={newTeamAId}
                    onChange={(e) => setNewTeamAId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Elegir...</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Equipo B</label>
                  <select
                    value={newTeamBId}
                    onChange={(e) => setNewTeamBId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Elegir...</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddingMatch(false); setNewTeamAId(''); setNewTeamBId(''); }}
                  className="flex-1 py-1.5 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitNewMatch}
                  disabled={saving || newTeamAId === '' || newTeamBId === '' || newTeamAId === newTeamBId}
                  className="flex-1 py-1.5 rounded-lg text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingMatch(true)}
              disabled={saving}
              className="mt-3 w-full py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
            >
              + Agregar partido
            </button>
          )}
        </>
      )}
    </div>
  );
}
