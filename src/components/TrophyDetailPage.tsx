import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppContext, useCurrentPlayer } from '../context/appContext';
import { useEventsIndex } from '../hooks/useEventsIndex';
import { useTrophies } from '../hooks/useTrophies';
import { formatDate } from '../utils/dateUtils';
import Chip from './Chip';
import ConfirmAction from './ConfirmAction';
import GenderIcon from './GenderIcon';
import SectionLabel from './SectionLabel';
import Tooltip from './Tooltip';
import TrophyCover from './TrophyCover';
import TrophyFormDialog from './TrophyFormDialog';
import TrophyGallery from './TrophyGallery';
import { EditIcon } from './icons';

export default function TrophyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const { trophies, loading, error, refetch } = useTrophies();
  const { events, labels } = useEventsIndex();
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trophyId = Number(id);
  const trophy = Number.isInteger(trophyId) ? trophies.find((t) => t.id === trophyId) : undefined;

  async function handleDelete() {
    const { error: deleteFailure } = await supabase.from('trophies').delete().eq('id', trophyId);
    if (deleteFailure) {
      setDeleteError(deleteFailure.message);
      return;
    }
    navigate('/trofeos');
  }

  if (loading) {
    return <p className="text-muted text-center py-16">Cargando...</p>;
  }

  if (error) {
    return <p className="text-error text-center py-12">Error al cargar el trofeo: {error}</p>;
  }

  if (!trophy) {
    return (
      <div className="text-center py-12">
        <p className="text-muted mb-4">No encontramos ese trofeo.</p>
        <Link to="/trofeos" className="text-accent hover:text-accent-hover underline">
          Volver a trofeos
        </Link>
      </div>
    );
  }

  const linkedEvent = trophy.event_id !== null
    ? events.find((e) => e.id === trophy.event_id)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Link to="/trofeos" className="text-sm text-muted hover:text-accent transition-colors">
            ← Trofeos
          </Link>
          {isAdmin && (
            <Tooltip label="Editar trofeo">
              <button
                onClick={() => setEditing(true)}
                className="text-muted hover:text-accent transition-colors"
              >
                <EditIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>

        <div className="relative aspect-3/2 rounded-xl overflow-hidden mt-3">
          <TrophyCover cover={trophy.cover} title={trophy.title} full />
        </div>

        <h2 className="text-2xl font-bold mt-4 break-words">{trophy.title}</h2>
        <p className="text-sm text-muted mt-0.5">{formatDate(trophy.won_at)}</p>
        {linkedEvent && (
          <Link
            to={`/fechas/${linkedEvent.short_id}`}
            className="inline-block text-sm text-accent hover:text-accent-hover transition-colors mt-1"
          >
            Fecha {labels.get(linkedEvent.id) ?? linkedEvent.id}
            {linkedEvent.name ? ` — ${linkedEvent.name}` : ''} →
          </Link>
        )}
      </div>

      {trophy.participants.length > 0 && (
        <section>
          <SectionLabel dim>ESTUVIERON · {trophy.participants.length}</SectionLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            {trophy.participants.map((player) => (
              <Link
                key={player.id}
                to={`/plantel/${player.id}`}
                className="flex items-center gap-1.5 rounded-full bg-surface border border-border px-2.5 py-1 text-sm hover:border-accent-border hover:text-accent transition-colors"
              >
                <GenderIcon gender={player.gender} />
                {player.name}
                {currentPlayer?.id === player.id && <Chip tone="win">Vos</Chip>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <TrophyGallery
        trophyId={trophy.id}
        coverMediaId={trophy.cover_media_id}
        participants={trophy.participants}
        onCoverChanged={refetch}
      />

      {isAdmin && (
        <div className="pt-2">
          {deleteError && <p className="text-xs text-error mb-2">{deleteError}</p>}
          <ConfirmAction
            label="Eliminar trofeo"
            message="¿Seguro? Se borra el trofeo y quiénes estuvieron. Las fotos no se borran: pasan a la galería."
            onConfirm={handleDelete}
          />
        </div>
      )}

      {editing && (
        <TrophyFormDialog
          trophy={trophy}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); refetch(); }}
        />
      )}
    </div>
  );
}
