import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/appContext';
import { supabase } from '../lib/supabase';
import type { Player } from '../types';
import GenderIcon from './GenderIcon';
import { GoogleIcon } from './icons';

export default function ClaimPage() {
  const { session, players, refetchData } = useAppContext();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const userEmail = session?.user?.email;

  // Check if this user is already linked to a player
  const linkedPlayer = useMemo(
    () => players.find((p) => p.email === userEmail) ?? null,
    [players, userEmail]
  );

  // Unclaimed players sorted alphabetically
  const unclaimedPlayers = useMemo(
    () =>
      players
        .filter((p) => !p.email)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  async function handleClaim() {
    if (!selectedPlayer || !code) return;

    setClaiming(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('claim_player', {
      secret: code,
      target_player_id: selectedPlayer.id,
    });

    if (rpcError) {
      setError(rpcError.message);
      setClaiming(false);
      return;
    }

    await refetchData();
    setSuccess(true);
    setClaiming(false);
  }

  // No code in URL
  if (!code) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Link inválido — falta el código de invitación.</p>
      </div>
    );
  }

  // Not logged in — redirect back to this page (with code) after OAuth
  if (!session) {
    const signInWithRedirect = () => {
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
    };

    return (
      <div className="text-center py-12">
        <p className="text-muted mb-4">Iniciá sesión con Google para vincular tu cuenta. Este proceso toma 30 segundos.</p>
        <button
          onClick={signInWithRedirect}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm border border-border-subtle text-on-surface bg-surface hover:bg-border-subtle transition-colors"
        >
          <GoogleIcon className="w-5 h-5" />
          Iniciar sesión
        </button>
      </div>
    );
  }

  // Already linked
  if (linkedPlayer) {
    return (
      <div className="max-w-sm mx-auto py-12">
        <div className="rounded-lg border border-primary bg-primary/10 p-4 text-center">
          <p className="text-on-surface font-medium mb-3">Tu cuenta ya está vinculada como <strong>{linkedPlayer.name}</strong>.</p>
          <Link to="/fechas" className="text-primary hover:text-primary-hover underline text-sm">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="max-w-sm mx-auto py-12">
        <div className="rounded-lg border border-success bg-success/10 p-4 text-center">
          <p className="text-on-surface font-medium mb-3">¡Listo! Tu cuenta fue vinculada como <strong>{selectedPlayer!.name}</strong>.</p>
          <Link to="/fechas" className="text-primary hover:text-primary-hover underline text-sm">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Claim flow
  return (
    <div className="max-w-sm mx-auto">
      <h2 className="text-lg font-semibold text-on-surface mb-1">Vincular cuenta</h2>
      <p className="text-sm text-muted mb-4">Seleccioná tu nombre para vincularlo con <strong>{userEmail}</strong>.</p>

      {error && (
        <div className="rounded-lg border border-error bg-error/10 p-3 mb-4">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      )}

      <ul className="space-y-1 mb-6">
        {unclaimedPlayers.map((player) => (
          <li key={player.id}>
            <button
              onClick={() => setSelectedPlayer(player)}
              className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-left transition-colors ${
                selectedPlayer?.id === player.id
                  ? 'bg-primary/10 border border-primary'
                  : 'hover:bg-border-subtle border border-transparent'
              }`}
            >
              <GenderIcon gender={player.gender} />
              <span className="font-medium">{player.name}</span>
            </button>
          </li>
        ))}

        {unclaimedPlayers.length === 0 && (
          <li className="text-center text-muted py-4">No hay jugadores disponibles para vincular.</li>
        )}
      </ul>

      <button
        onClick={handleClaim}
        disabled={!selectedPlayer || claiming}
        className="w-full px-4 py-2 rounded-lg font-medium text-sm bg-primary text-on-primary hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {claiming ? 'Vinculando...' : selectedPlayer ? `Vincular como ${selectedPlayer.name}` : 'Vincular'}
      </button>
    </div>
  );
}
