import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Player, TrophyWithDetails } from '../types';
import { TROPHY_COVER_FACE_COUNT } from '../types';
import { useAppContext } from '../context/appContext';
import { useTrophies } from '../hooks/useTrophies';
import { formatDateShort } from '../utils/dateUtils';
import { PlusIcon, TrophyIcon } from './icons';
import Tooltip from './Tooltip';
import TrophyCover from './TrophyCover';
import TrophyFormDialog from './TrophyFormDialog';
import TrophyListSkeleton from './TrophyListSkeleton';

/** The circles on the lead card. Initials only -- the names are one tap away. */
function Faces({ participants }: { participants: Player[] }) {
  if (participants.length === 0) return null;
  const shown = participants.slice(0, TROPHY_COVER_FACE_COUNT);
  const rest = participants.length - shown.length;

  return (
    <div className="flex items-center mt-3">
      {shown.map((player) => (
        <span
          key={player.id}
          className="w-6 h-6 -mr-1.5 rounded-full bg-on-primary/20 border border-on-primary/70 text-on-primary text-[10px] font-bold flex items-center justify-center"
        >
          {player.name.charAt(0).toUpperCase()}
        </span>
      ))}
      <span className="ml-3.5 text-xs text-on-primary/85">
        {rest > 0 ? `y ${rest} más` : `${participants.length} en total`}
      </span>
    </div>
  );
}

/**
 * Seconds between one card's foil pass and the next one down. Deliberately not
 * a divisor of the 6s sweep cycle (index.css), so a long column lands every
 * card at a different phase instead of regrouping into a single flash every
 * few beats.
 */
const FOIL_STAGGER_SECONDS = 1.9;

/**
 * `isolate` is what keeps each card's glimmer blending against its own
 * cover and nothing else -- see the foil notes in TrophyCover.
 */
function TrophyCard({ trophy, lead, foilDelaySeconds }: {
  trophy: TrophyWithDetails;
  lead: boolean;
  foilDelaySeconds: number;
}) {
  return (
    <Link
      to={`/trofeos/${trophy.id}`}
      className={`relative block rounded-xl overflow-hidden isolate ${lead ? 'aspect-4/5' : 'aspect-16/10'}`}
    >
      <TrophyCover
        cover={trophy.cover}
        title={trophy.title}
        focusX={trophy.cover_focus_x}
        focusY={trophy.cover_focus_y}
        foilDelaySeconds={foilDelaySeconds}
      />
      {/* The scrim is what makes the title legible over an unknown photo. */}
      <div className="absolute inset-x-0 bottom-0 pt-16 bg-gradient-to-t from-primary/95 via-primary/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-lime">
          {lead ? `Última conquista · ${formatDateShort(trophy.won_at)}` : formatDateShort(trophy.won_at)}
        </p>
        <h3
          className={`font-display uppercase text-on-primary leading-tight mt-1 ${
            lead ? 'text-2xl' : 'text-lg'
          }`}
        >
          {trophy.title}
        </h3>
        {lead && <Faces participants={trophy.participants} />}
      </div>
    </Link>
  );
}

export default function TrophyListPage() {
  const { isAdmin } = useAppContext();
  const { trophies, loading, error, refetch } = useTrophies();
  const [creating, setCreating] = useState(false);

  if (loading) {
    return <TrophyListSkeleton />;
  }

  if (error) {
    return <p className="text-error text-center py-12">Error al cargar los trofeos: {error}</p>;
  }

  return (
    <div>
      {/* The tab strip already names the page, so the action stands on its own
          row rather than beside a heading. */}
      {isAdmin && trophies.length > 0 && (
        <div className="flex justify-end mb-4">
          <Tooltip label="Agregar trofeo">
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-2 border border-border rounded-lg bg-surface text-muted hover:text-accent hover:border-accent transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      )}

      {trophies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <TrophyIcon className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">Todavía no ganamos nada</p>
          <p className="text-sm mt-1">O no lo anotamos.</p>
          {isAdmin && (
            <button
              onClick={() => setCreating(true)}
              className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Agregar trofeo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {trophies.map((trophy, index) => (
            <TrophyCard
              key={trophy.id}
              trophy={trophy}
              lead={index === 0}
              foilDelaySeconds={index * FOIL_STAGGER_SECONDS}
            />
          ))}
        </div>
      )}

      {creating && (
        <TrophyFormDialog
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); refetch(); }}
        />
      )}
    </div>
  );
}
