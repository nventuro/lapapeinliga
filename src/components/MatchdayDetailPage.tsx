import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConfirmAction from './ConfirmAction';
import type { MatchdayWithDetails, Player, AwardType, Location, LocationSelection } from '../types';
import { isGuest, allParticipants, AWARD_LABELS, AWARD_TYPES, COST_MARKUP_MULTIPLIER, isNewLocationComplete } from '../types';
import { supabase, orderMatchdays, buildMatchdayLabels } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate, formatTime, isValidTime } from '../utils/dateUtils';
import { formatPesos, perPlayerCost } from '../utils/costUtils';
import { TrophyIcon, EditIcon, WhatsAppIcon } from './icons';
import { buildPreGameMessage, openWhatsAppShare } from '../utils/shareMessage';
import { AWARD_ICONS } from './awardIcons';
import GenderIcon from './GenderIcon';
import TimeInput from './TimeInput';
import InvBadge from './InvBadge';
import Tooltip from './Tooltip';
import BuiltTeamDisplay from './BuiltTeamDisplay';
import ConfettiBurst from './ConfettiBurst';
import LocationPicker from './LocationPicker';

type MatchdayPageData = {
  matchday: MatchdayWithDetails;
  matchdayNumber: string;
};

async function fetchMatchdayData(
  shortId: string,
  players: Player[],
): Promise<MatchdayPageData | null> {
  const { data: matchdayData, error: matchdayError } = await supabase
    .from('matchdays')
    .select('*')
    .eq('short_id', shortId)
    .single();

  if (matchdayError || !matchdayData) return null;

  const matchdayId = matchdayData.id;

  // Fetch location if present
  let location: Location | null = null;
  if (matchdayData.location_id) {
    const { data: locData } = await supabase
      .from('locations')
      .select('*')
      .eq('id', matchdayData.location_id)
      .single();
    if (locData) location = locData as Location;
  }

  const { data: teamsData } = await supabase
    .from('matchday_teams')
    .select('id, matchday_id, name, shirt_color')
    .eq('matchday_id', matchdayId)
    .order('id');

  const [teamPlayersResult, reservesResult, allMatchdaysResult] = await Promise.all([
    supabase
      .from('matchday_team_players')
      .select('matchday_team_id, player_id')
      .in('matchday_team_id', (teamsData ?? []).map((t) => t.id)),
    supabase
      .from('matchday_reserves')
      .select('player_id')
      .eq('matchday_id', matchdayId),
    orderMatchdays(supabase.from('matchdays').select('id, played_at'), true),
  ]);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const teams = (teamsData ?? []).map((team) => ({
    ...team,
    players: (teamPlayersResult.data ?? [])
      .filter((tp) => tp.matchday_team_id === team.id)
      .map((tp) => playerMap.get(tp.player_id))
      .filter((p): p is Player => p !== undefined),
  }));

  const reserves = (reservesResult.data ?? [])
    .map((r) => playerMap.get(r.player_id))
    .filter((p): p is Player => p !== undefined);

  const allRows = (allMatchdaysResult.data ?? []) as { id: number; played_at: string }[];
  const labels = buildMatchdayLabels(allRows);
  const matchdayNumber = labels.get(matchdayId) ?? '?';

  return {
    matchday: { ...matchdayData, teams, reserves, location } as MatchdayWithDetails,
    matchdayNumber,
  };
}

export default function MatchdayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { players, isAdmin, showCosts } = useAppContext();

  const [matchday, setMatchday] = useState<MatchdayWithDetails | null>(null);
  const [matchdayNumber, setMatchdayNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [glowingAwards, setGlowingAwards] = useState<Set<AwardType>>(new Set());
  const [glowingWinner, setGlowingWinner] = useState(false);

  // Details editing state (time, location, cost, payee)
  const [editingDetails, setEditingDetails] = useState(false);
  const [closingDetails, setClosingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editPayee, setEditPayee] = useState('');
  const [editLocationSelection, setEditLocationSelection] = useState<LocationSelection>({ type: 'none' });
  const [allLocations, setAllLocations] = useState<Location[]>([]);

  const participants = matchday ? allParticipants(matchday) : [];

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const data = await fetchMatchdayData(id!, players);
      if (!cancelled) {
        setMatchday(data?.matchday ?? null);
        setMatchdayNumber(data?.matchdayNumber ?? '');
        // Initialize edit state from loaded data
        if (data?.matchday) {
          setEditTime(data.matchday.played_at_time ? formatTime(data.matchday.played_at_time) : '');
          setEditLocationSelection(
            data.matchday.location_id
              ? { type: 'existing', locationId: data.matchday.location_id }
              : { type: 'none' },
          );
        }
        setLoading(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [id, players]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('locations').select('*').order('name').then(({ data }) => {
      if (data) setAllLocations(data as Location[]);
    });
  }, [isAdmin]);

  function closeDetailsEditor() {
    setClosingDetails(true);
  }

  function handleEditorAnimationEnd() {
    if (closingDetails) {
      setEditingDetails(false);
      setClosingDetails(false);
    }
  }

  function openDetailsEditor() {
    if (!matchday) return;
    setEditName(matchday.name ?? '');
    setEditTime(matchday.played_at_time ? matchday.played_at_time.slice(0, 5) : '');
    setEditCost(matchday.cost != null ? String(matchday.cost) : '');
    setEditPayee(matchday.payee_alias_cbu ?? '');
    setEditLocationSelection(
      matchday.location_id
        ? { type: 'existing', locationId: matchday.location_id }
        : { type: 'none' },
    );
    setEditingDetails(true);
  }

  async function handleSaveDetails() {
    if (!matchday) return;
    setSaving(true);

    const timeValue = editTime || null;

    // Resolve location
    let locationId: number | null = null;
    let location: Location | null = null;

    if (editLocationSelection.type === 'existing') {
      locationId = editLocationSelection.locationId;
      location = allLocations.find((l) => l.id === locationId) ?? null;
    } else if (editLocationSelection.type === 'new') {
      if (!editLocationSelection.name.trim() || !editLocationSelection.mapsUrl.trim()) {
        setSaving(false);
        return;
      }

      const { data: newLoc, error: locError } = await supabase
        .from('locations')
        .insert({
          name: editLocationSelection.name.trim(),
          maps_url: editLocationSelection.mapsUrl.trim(),
        })
        .select('*')
        .single();

      if (locError || !newLoc) {
        setSaving(false);
        return;
      }

      location = newLoc as Location;
      locationId = location.id;
      setAllLocations((prev) => [...prev, location!].sort((a, b) => a.name.localeCompare(b.name)));
    }

    const nameValue = editName.trim() || null;
    const costValue = editCost.trim() ? parseInt(editCost.trim(), 10) : null;
    const payeeValue = editPayee.trim() || null;

    const { error } = await supabase
      .from('matchdays')
      .update({ name: nameValue, played_at_time: timeValue, location_id: locationId, cost: costValue, payee_alias_cbu: payeeValue })
      .eq('id', matchday.id);

    if (!error) {
      setMatchday({ ...matchday, name: nameValue, played_at_time: timeValue, location_id: locationId, location, cost: costValue, payee_alias_cbu: payeeValue });
      closeDetailsEditor();
    }
    setSaving(false);
  }

  async function handleWinnerChange(teamId: number | null) {
    if (!matchday) return;
    setSaving(true);

    const { error } = await supabase
      .from('matchdays')
      .update({ winning_team_id: teamId })
      .eq('id', matchday.id);

    if (!error) {
      setMatchday({ ...matchday, winning_team_id: teamId });
      if (teamId !== null) {
        setGlowingWinner(true);
        setTimeout(() => setGlowingWinner(false), 4000);
      }
    }
    setSaving(false);
  }

  async function handleAwardChange(award: AwardType, playerId: number | null) {
    if (!matchday) return;
    setSaving(true);

    const field = `${award}_id`;
    const { error } = await supabase
      .from('matchdays')
      .update({ [field]: playerId })
      .eq('id', matchday.id);

    if (!error) {
      setMatchday({ ...matchday, [`${award}_id`]: playerId });
      if (playerId !== null) {
        setGlowingAwards((prev) => new Set(prev).add(award));
        setTimeout(() => {
          setGlowingAwards((prev) => {
            const next = new Set(prev);
            next.delete(award);
            return next;
          });
        }, 4000);
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!matchday) return;

    const { error } = await supabase
      .from('matchdays')
      .delete()
      .eq('id', matchday.id);

    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }

    navigate('/fechas');
  }

  if (loading) {
    return <p className="text-muted text-center py-8">Cargando fecha...</p>;
  }

  if (!matchday) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">No se encontró la fecha.</p>
      </div>
    );
  }

  const winnerTeam = matchday.winning_team_id
    ? matchday.teams.find((t) => t.id === matchday.winning_team_id)
    : null;

  // Build a map of player ID → list of awards they hold
  const playerAwards = new Map<number, AwardType[]>();
  for (const award of AWARD_TYPES) {
    const pid = matchday[`${award}_id`];
    if (pid) {
      const existing = playerAwards.get(pid) ?? [];
      existing.push(award);
      playerAwards.set(pid, existing);
    }
  }

  function getPlayerName(playerId: number | null): string {
    if (!playerId) return '';
    return players.find((p) => p.id === playerId)?.name ?? '';
  }

  return (
    <div>
      {glowingWinner && <ConfettiBurst />}
      <h2 className="text-xl font-bold">
        #{matchdayNumber}{matchday.name ? ` ${matchday.name}` : ''} — {formatDate(matchday.played_at)}
      </h2>
      {/* Matchday details box (display or edit mode) */}
      {editingDetails ? (
        <div
          className={`border border-border rounded-lg p-4 mt-3 space-y-3 ${closingDetails ? 'animate-slide-up-out' : 'animate-slide-down-in'}`}
          onAnimationEnd={handleEditorAnimationEnd}
        >
          <div>
            <label className="block text-sm font-medium mb-1">Nombre (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Copa de Verano"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Horario</label>
            <TimeInput value={editTime} onChange={setEditTime} disabled={saving} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cancha</label>
            <LocationPicker
              value={editLocationSelection}
              onChange={setEditLocationSelection}
              locations={allLocations}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Costo</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 15000"
              value={editCost}
              onChange={(e) => setEditCost(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Alias/CBU de quien pagó</label>
            <input
              type="text"
              placeholder="Alias o CBU"
              value={editPayee}
              onChange={(e) => setEditPayee(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeDetailsEditor}
              className="flex-1 py-2 rounded-lg font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveDetails}
              disabled={saving || !isValidTime(editTime) || !isNewLocationComplete(editLocationSelection)}
              className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors text-sm"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (isAdmin || matchday.location || matchday.played_at_time) && (() => {
        const hasTimeOrLocation = matchday.location || matchday.played_at_time;
        const hasCost = isAdmin && showCosts && matchday.cost != null;
        const hasAnyDetails = hasTimeOrLocation || hasCost;
        return (
          <div className="border border-border rounded-lg px-4 py-3 mt-3 text-sm text-muted space-y-1">
            <div className="flex items-center justify-between">
              {hasAnyDetails ? (
                <div className="space-y-1">
                  {hasTimeOrLocation && (
                    <p>
                      {matchday.location && (
                        <a
                          href={matchday.location.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary-hover underline underline-offset-2"
                        >
                          {matchday.location.name}
                        </a>
                      )}
                      {matchday.location && matchday.played_at_time && ' · '}
                      {matchday.played_at_time && formatTime(matchday.played_at_time)}
                    </p>
                  )}
                  {hasCost && (
                    <p className="flex flex-wrap gap-x-4">
                      <span>Total: {formatPesos(matchday.cost!)}</span>
                      <span>Inflado: {formatPesos(matchday.cost! * COST_MARKUP_MULTIPLIER)}</span>
                      {participants.length > 0 && (
                        <span>Por jugador: {formatPesos(perPlayerCost(matchday.cost!, participants.length))}</span>
                      )}
                      {matchday.payee_alias_cbu && <span>Pagó: {matchday.payee_alias_cbu}</span>}
                    </p>
                  )}
                </div>
              ) : (
                <p className="italic">Sin detalles</p>
              )}
              {isAdmin && (() => {
                const missing: string[] = [];
                if (!matchday.played_at_time) missing.push('horario');
                if (!matchday.location) missing.push('cancha');
                if (!matchday.payee_alias_cbu) missing.push('alias/CBU');
                const canShare = missing.length === 0;
                return (
                  <div className="flex items-center gap-1 shrink-0 self-start">
                    <Tooltip label="Editar detalles">
                      <button
                        type="button"
                        onClick={openDetailsEditor}
                        className="p-1 rounded text-muted hover:text-on-surface transition-colors"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <Tooltip label={canShare ? 'Compartir por WhatsApp' : `Completá ${missing.join(', ')} para compartir`}>
                      <button
                        type="button"
                        onClick={() => openWhatsAppShare(buildPreGameMessage(matchday, matchdayNumber))}
                        disabled={!canShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
                      >
                        Compartir
                        <WhatsAppIcon className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {matchday.teams.map((team) => (
          <BuiltTeamDisplay
            key={team.id}
            team={team}
            isWinner={team.id === matchday.winning_team_id}
            playerAwards={playerAwards}
          />
        ))}
      </div>

      {/* Reserves */}
      {matchday.reserves.length > 0 && (
        <div className="border border-border rounded-lg p-4 mt-4">
          <h3 className="font-bold text-lg mb-3">
            Suplentes
            <span className="font-normal text-sm text-muted ml-2">
              ({matchday.reserves.length})
            </span>
          </h3>
          <ul className="space-y-1">
            {matchday.reserves.map((player) => (
              <li key={player.id} className="flex items-center gap-2 py-1 px-2">
                <GenderIcon gender={player.gender} />
                <span>{player.name}</span>
                {isGuest(player) && <InvBadge />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Results section */}
      <div className="border border-border rounded-lg p-4 mt-4">
        <h3 className="font-bold text-lg mb-4">Resultados</h3>

        {isAdmin ? (
          <div className="space-y-4">
            {/* Winner picker */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                Ganador
                <TrophyIcon className={`w-4 h-4 ${matchday.winning_team_id ? 'text-gold' : 'text-muted'}`} />
              </label>
              <select
                value={matchday.winning_team_id ?? ''}
                onChange={(e) =>
                  handleWinnerChange(e.target.value ? Number(e.target.value) : null)
                }
                disabled={saving}
                className={`w-full px-3 py-2 rounded-lg border bg-surface text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${matchday.winning_team_id ? 'border-gold' : 'border-border'} ${glowingWinner ? 'animate-gold-glow-pulse' : ''}`}
              >
                <option value="">Sin definir</option>
                {[...matchday.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Award pickers */}
            {AWARD_TYPES.map((award) => {
              const Icon = AWARD_ICONS[award];
              const isGranted = matchday[`${award}_id`] != null;
              const isGlowing = glowingAwards.has(award);
              return (
              <div key={award}>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                  {AWARD_LABELS[award]}
                  <Icon className={`w-4 h-4 ${isGranted ? 'text-gold' : 'text-muted'}`} />
                </label>
                <select
                  value={matchday[`${award}_id`] ?? ''}
                  onChange={(e) =>
                    handleAwardChange(award, e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={saving}
                  className={`w-full px-3 py-2 rounded-lg border bg-surface text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${isGranted ? 'border-gold' : 'border-border'} ${isGlowing ? 'animate-gold-glow-pulse' : ''}`}
                >
                  <option value="">Sin definir</option>
                  {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                Ganador
                <TrophyIcon className={`w-4 h-4 ${matchday.winning_team_id ? 'text-gold' : 'text-muted'}`} />
              </span>
              <span className="font-medium">
                {winnerTeam ? winnerTeam.name : 'Sin definir'}
              </span>
            </div>
            {AWARD_TYPES.map((award) => {
              const Icon = AWARD_ICONS[award];
              const isGranted = matchday[`${award}_id`] != null;
              return (
                <div key={award} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted">
                    {AWARD_LABELS[award]}
                    <Icon className={`w-4 h-4 ${isGranted ? 'text-gold' : 'text-muted'}`} />
                  </span>
                  <span className="font-medium">
                    {getPlayerName(matchday[`${award}_id`]) || 'Sin definir'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && (
        <ConfirmAction
          label="Eliminar fecha"
          message="¿Eliminar esta fecha? Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          className="mt-6"
        />
      )}
    </div>
  );
}
