import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/appContext';
import { supabase } from '../lib/supabase';
import { GoogleIcon } from './icons';

export default function ClaimPage() {
  const { session, players, currentPlayerId, refetchData } = useAppContext();
  const [searchParams] = useSearchParams();
  const playerIdParam = searchParams.get('p');
  const token = searchParams.get('t');
  const playerId = playerIdParam ? Number(playerIdParam) : null;

  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // The invite link is bound to one specific player; look up its name to show.
  const targetPlayer = useMemo(
    () => players.find((p) => p.id === playerId) ?? null,
    [players, playerId],
  );
  const linkedPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  async function handleClaim() {
    if (playerId === null || !token) return;

    setClaiming(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('claim_player', {
      p_player_id: playerId,
      p_token: token,
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

  // Malformed link
  if (playerId === null || Number.isNaN(playerId) || !token) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Link inválido — pedile al administrador un link de invitación.</p>
      </div>
    );
  }

  // Not logged in — redirect back to this exact link (with params) after OAuth
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
          <p className="text-on-surface font-medium mb-3">¡Listo! Tu cuenta fue vinculada{targetPlayer ? <> como <strong>{targetPlayer.name}</strong></> : null}.</p>
          <Link to="/fechas" className="text-primary hover:text-primary-hover underline text-sm">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Claim flow — the link already identifies the player.
  const targetName = targetPlayer?.name ?? 'este jugador';
  return (
    <div className="max-w-sm mx-auto py-12 text-center">
      <h2 className="text-lg font-semibold text-on-surface mb-1">Vincular cuenta</h2>
      <p className="text-sm text-muted mb-6">
        Vas a vincular <strong>{session.user?.email}</strong> con <strong>{targetName}</strong>.
      </p>

      {error && (
        <div className="rounded-lg border border-error bg-error/10 p-3 mb-4 text-left">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      )}

      <button
        onClick={handleClaim}
        disabled={claiming}
        className="w-full px-4 py-2 rounded-lg font-medium text-sm bg-primary text-on-primary hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {claiming ? 'Vinculando...' : `Vincular como ${targetName}`}
      </button>
    </div>
  );
}
