import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { CalendarIcon, ChartBarIcon, ClipboardIcon, CogIcon, UserGroupIcon } from './icons';
import ToggleSwitch from './ToggleSwitch';
import Footer from './Footer';

export default function AuthenticatedLayout() {
  const { session, isAdmin, showRatings, setShowRatings } = useAppContext();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = () => {
    localStorage.removeItem('showRatings');
    supabase.auth.signOut();
  };

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col min-h-dvh">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-3xl font-bold hover:opacity-80 transition-opacity">
              La Papeinliga
            </Link>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1.5 rounded-full border border-border hover:border-neutral-hover text-muted hover:text-muted-strong transition-colors flex items-center gap-1.5"
              >
                {session.user.user_metadata.avatar_url ? (
                  <img
                    src={session.user.user_metadata.avatar_url}
                    alt=""
                    className="w-6 h-6 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <CogIcon className="w-5 h-5" />
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-lg z-50 py-2">
                  {/* User info */}
                  <div className="px-4 py-2 border-b border-border-subtle">
                    <p className="text-sm font-medium truncate">
                      {session.user.user_metadata.full_name ?? session.user.email}
                    </p>
                    {session.user.user_metadata.full_name && session.user.email && (
                      <p className="text-xs text-muted truncate">{session.user.email}</p>
                    )}
                  </div>

                  {/* Admin: rating toggle */}
                  {isAdmin && (
                    <div className="px-4 py-2 border-b border-border-subtle">
                      <ToggleSwitch
                        checked={showRatings}
                        onChange={setShowRatings}
                        label="Mostrar puntajes"
                      />
                    </div>
                  )}

                  {/* Logout */}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-muted hover:text-error hover:bg-border-subtle transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
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
                  Armado
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
