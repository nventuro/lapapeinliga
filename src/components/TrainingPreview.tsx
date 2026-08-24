import { useState } from 'react';
import type { Player } from '../types';
import { isGuest } from '../types';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import SaveEventDialog from './SaveEventDialog';
import { useAppContext } from '../context/appContext';

interface TrainingPreviewProps {
  attendees: Player[];
  coaches: Player[];
  onReset: () => void;
}

export default function TrainingPreview({ attendees, coaches, onReset }: TrainingPreviewProps) {
  const { isAdmin } = useAppContext();
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const sortedAttendees = [...attendees].sort((a, b) => a.name.localeCompare(b.name));
  const sortedCoaches = [...coaches].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Entrenamiento armado</h2>

      <div className="participant-grid mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">
            Jugadores
            <span className="font-normal text-sm text-muted ml-2">
              ({attendees.length})
            </span>
          </h3>
          <ul className="space-y-1">
            {sortedAttendees.map((player) => (
              <li key={player.id} className="flex items-center gap-2 py-1 px-2">
                <GenderIcon gender={player.gender} />
                <span>{player.name}</span>
                {isGuest(player) && <InvBadge />}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">
            Entrenadores
            <span className="font-normal text-sm text-muted ml-2">
              ({coaches.length})
            </span>
          </h3>
          <ul className="space-y-1">
            {sortedCoaches.map((player) => (
              <li key={player.id} className="flex items-center gap-2 py-1 px-2">
                <GenderIcon gender={player.gender} />
                <span>{player.name}</span>
                {isGuest(player) && <InvBadge />}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-lg font-bold text-muted-strong bg-neutral hover:bg-neutral-hover transition-colors"
        >
          Volver al inicio
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex-1 py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors"
          >
            Guardar fecha
          </button>
        )}
      </div>

      {showSaveDialog && (
        <SaveEventDialog
          type="training"
          attendees={attendees}
          coaches={coaches}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
