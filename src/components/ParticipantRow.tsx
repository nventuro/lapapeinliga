import { useState, useEffect, useRef } from 'react';
import type { Player, AwardType } from '../types';
import { isGuest, AWARD_LABELS } from '../types';
import { AWARD_ICONS } from './awardIcons';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import Tooltip from './Tooltip';
import { DotsVerticalIcon } from './icons';

export interface MoveDestination {
  label: string;
  onSelect: () => void;
}

interface ParticipantRowProps {
  player: Player;
  awards?: AwardType[];
  canEdit: boolean;
  disabled?: boolean;
  moveDestinations?: MoveDestination[];
  onRemove?: () => void;
  /** Optional content rendered right-aligned, before the actions menu. */
  trailing?: React.ReactNode;
}

export default function ParticipantRow({
  player,
  awards,
  canEdit,
  disabled = false,
  moveDestinations = [],
  onRemove,
  trailing,
}: ParticipantRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const hasActions = canEdit && (moveDestinations.length > 0 || onRemove);

  if (confirming) {
    return (
      <li className="flex items-center gap-2 py-1 px-2 rounded bg-error/10 border border-error">
        <span className="flex-1 text-sm">¿Quitar a <span className="font-medium">{player.name}</span>?</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={disabled}
          className="text-xs px-2 py-1 rounded text-muted hover:text-muted-strong transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { onRemove?.(); setConfirming(false); }}
          disabled={disabled}
          className="text-xs px-2 py-1 rounded font-bold bg-error text-on-primary hover:bg-error/80 disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
        >
          Quitar
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-1 px-2">
      <GenderIcon gender={player.gender} />
      <span>{player.name}</span>
      {isGuest(player) && <InvBadge />}
      {awards?.map((award) => {
        const Icon = AWARD_ICONS[award];
        return (
          <Tooltip key={award} label={AWARD_LABELS[award]} className="text-gold">
            <Icon className="w-4 h-4" />
          </Tooltip>
        );
      })}
      {(trailing || hasActions) && (
        <div className="ml-auto flex items-center gap-1">
          {trailing}
          {hasActions && (
        <div className="relative" ref={menuRef}>
          <Tooltip label="Acciones">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={disabled}
              className="text-muted hover:text-on-surface transition-colors p-1 disabled:cursor-not-allowed"
            >
              <DotsVerticalIcon />
            </button>
          </Tooltip>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[10rem]">
              {moveDestinations.map((dest, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { dest.onSelect(); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-border-subtle transition-colors"
                >
                  {dest.label}
                </button>
              ))}
              {onRemove && (
                <>
                  {moveDestinations.length > 0 && (
                    <div className="my-1 border-t border-border-subtle" />
                  )}
                  <button
                    type="button"
                    onClick={() => { setConfirming(true); setMenuOpen(false); }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-error hover:bg-error/10 transition-colors"
                  >
                    Quitar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
          )}
        </div>
      )}
    </li>
  );
}
