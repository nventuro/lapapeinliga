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
import TrophyCoverAdjust from './TrophyCoverAdjust';
import TrophyFormDialog from './TrophyFormDialog';
import TrophyGallery from './TrophyGallery';
import { EditIcon, MoveIcon } from './icons';

export default function TrophyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const { trophies, loading, error, refetch } = useTrophies();
  const { events, labels } = useEventsIndex();
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [savingFocus, setSavingFocus] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const trophyId = Number(id);
  const trophy = Number.isInteger(trophyId) ? trophies.find((t) => t.id === trophyId) : undefined;

  async function handleSaveFocus(x: number, y: number) {
    setSavingFocus(true);
    setAdjustError(null);
    const { error: saveFailure } = await supabase
      .from('trophies')
      .update({ cover_focus_x: x, cover_focus_y: y })
      .eq('id', trophyId);
    setSavingFocus(false);
    if (saveFailure) {
      setAdjustError(saveFailure.message);
      return;
    }
    setAdjusting(false);
    refetch();
  }

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

        {/* `isolate` confines the cover's glimmer to the card -- see the foil
            notes in TrophyCover. */}
        <div className="relative aspect-3/2 rounded-xl overflow-hidden isolate mt-3">
          {adjusting && trophy.cover ? (
            <TrophyCoverAdjust
              cover={trophy.cover}
              initialX={trophy.cover_focus_x}
              initialY={trophy.cover_focus_y}
              saving={savingFocus}
              onSave={handleSaveFocus}
              onCancel={() => { setAdjusting(false); setAdjustError(null); }}
            />
          ) : (
            <>
              <TrophyCover
                cover={trophy.cover}
                title={trophy.title}
                focusX={trophy.cover_focus_x}
                focusY={trophy.cover_focus_y}
              />
              {/* The wrapper div carries the positioning because Tooltip's own
                  span is `relative` -- an absolute button inside it would
                  anchor to the span, not the hero. z-20 lifts it over the foil
                  ring (z-10), which would otherwise swallow the tap. */}
              {isAdmin && trophy.cover && (
                <div className="absolute bottom-3 right-3 z-20">
                  <Tooltip label="Encuadrar portada">
                    <button
                      onClick={() => setAdjusting(true)}
                      className="p-2 rounded-full bg-primary/70 text-on-primary hover:bg-primary transition-colors"
                    >
                      <MoveIcon className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </>
          )}
        </div>
        {adjustError && <p className="text-xs text-error mt-2">{adjustError}</p>}

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

      {trophy.description && (
        /* whitespace-pre-line so the paragraph breaks an admin typed survive;
           the field is a textarea, so they will type some. */
        <p className="text-sm leading-relaxed whitespace-pre-line text-muted-strong">
          {trophy.description}
        </p>
      )}

      {trophy.participants.length > 0 && (
        <section>
          <SectionLabel dim>VENCEDORES · {trophy.participants.length}</SectionLabel>
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
            message="¿Seguro? Se borra el trofeo y su lista de vencedores. Las fotos no se borran: pasan a la galería."
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
