import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { CalendarIcon, ChartBarIcon, ClipboardIcon, UserGroupIcon } from './icons';
import Footer from './Footer';

export default function AuthenticatedLayout() {
  const { session, isAdmin } = useAppContext();
  const location = useLocation();

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col min-h-dvh">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-3xl font-bold hover:opacity-80 transition-opacity">
              La Papeinliga
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-muted hover:text-muted-strong pl-3 pr-1 py-1 rounded-full border border-border hover:border-neutral-hover transition-colors flex items-center gap-2"
            >
              Cerrar sesión
              {session.user.user_metadata.avatar_url && (
                <img
                  src={session.user.user_metadata.avatar_url}
                  alt=""
                  title={[session.user.user_metadata.full_name, session.user.email].filter(Boolean).join(' — ')}
                  className="w-6 h-6 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
            </button>
          </div>
          <nav className="flex gap-4 mt-3 border-b border-border pb-2">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                location.pathname === '/' || location.pathname.startsWith('/matchdays')
                  ? 'text-primary'
                  : 'text-muted hover:text-muted-strong'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Fechas
            </Link>
            <Link
              to="/stats"
              className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                location.pathname === '/stats'
                  ? 'text-primary'
                  : 'text-muted hover:text-muted-strong'
              }`}
            >
              <ChartBarIcon className="w-3.5 h-3.5" />
              Estadísticas
            </Link>
            {isAdmin && (
              <>
                <Link
                  to="/sorter"
                  className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    location.pathname === '/sorter'
                      ? 'text-primary'
                      : 'text-muted hover:text-muted-strong'
                  }`}
                >
                  <ClipboardIcon className="w-3.5 h-3.5" />
                  Armar equipos
                </Link>
                <Link
                  to="/players"
                  className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    location.pathname === '/players'
                      ? 'text-primary'
                      : 'text-muted hover:text-muted-strong'
                  }`}
                >
                  <UserGroupIcon className="w-3.5 h-3.5" />
                  Jugadores
                </Link>
              </>
            )}
          </nav>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>

        <Footer className="mt-8 pb-4" />
      </div>
    </div>
  );
}
