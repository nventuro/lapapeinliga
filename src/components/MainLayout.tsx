import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppContext, useCurrentPlayer } from '../context/appContext';
import { CalendarIcon, ChartBarIcon, CogIcon, EditIcon, GoogleIcon, PhotosIcon, UserGroupIcon } from './icons';
import ToggleSwitch from './ToggleSwitch';
import Tooltip from './Tooltip';
import EditNameDialog from './EditNameDialog';
import Footer from './Footer';
import crest from '../assets/crest-on-dark.png';

const NAV_ITEMS = [
  { to: '/fechas', label: 'Fechas', Icon: CalendarIcon, isActive: (p: string) => p.startsWith('/fechas') },
  { to: '/estadisticas', label: 'Estadísticas', Icon: ChartBarIcon, isActive: (p: string) => p === '/estadisticas' },
  { to: '/plantel', label: 'Plantel', Icon: UserGroupIcon, isActive: (p: string) => p.startsWith('/plantel') || p === '/armado' },
  { to: '/galeria', label: 'Galería', Icon: PhotosIcon, isActive: (p: string) => p.startsWith('/galeria') },
];

export default function MainLayout() {
  const { session, isActualAdmin, adminMode, setAdminMode, showRatings, setShowRatings, showCosts, setShowCosts, signIn } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = () => {
    localStorage.removeItem('showRatings');
    localStorage.removeItem('showCosts');
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
    <div className="min-h-dvh bg-canvas text-on-surface flex flex-col">
      <header className="bg-primary pinstripes text-on-primary">
        {/* The band grows about a third from `sm` up, where there is room for the
            crest to be legible. Mobile keeps its sizes: the nav clears its track
            by only a few pixels at 390px wide. */}
        <div className="max-w-2xl mx-auto px-4 pt-5 sm:pt-7">
          <div className="flex items-center justify-between gap-3">
            <Link to="/fechas" className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 hover:opacity-90 transition-opacity">
              {/* The crest's own outlines are this same navy, so the asset carries
                  a white keyline -- without it the ball and ribbon dissolve into
                  the band. */}
              <img src={crest} alt="" className="w-11 h-11 sm:w-14 sm:h-14 shrink-0" />
              <span className="font-display text-xl sm:text-3xl uppercase tracking-wide truncate">
                La Papeinliga
              </span>
            </Link>
            {session ? (
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1.5 rounded-full border border-on-primary/30 hover:border-on-primary/70 text-on-primary/80 hover:text-on-primary transition-colors flex items-center gap-1.5"
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
                  <div className="absolute right-0 mt-2 w-56 bg-surface text-on-surface border border-border rounded-lg shadow-lg z-50 py-2">
                    {/* User info */}
                    <div className="px-4 py-2 border-b border-border-subtle">
                      <p className="text-sm font-medium truncate">
                        {session.user.user_metadata.full_name ?? session.user.email}
                      </p>
                      {session.user.user_metadata.full_name && session.user.email && (
                        <p className="text-xs text-muted truncate">{session.user.email}</p>
                      )}
                      {currentPlayer && (
                        <p className="text-xs text-accent mt-1 flex items-center gap-1">
                          <span className="truncate">
                            Jugás como <span className="font-medium">{currentPlayer.name}</span>
                          </span>
                          <Tooltip label="Cambiar nombre">
                            <button
                              onClick={() => { setMenuOpen(false); setEditNameOpen(true); }}
                              className="shrink-0 text-muted hover:text-accent transition-colors"
                            >
                              <EditIcon className="w-3 h-3" />
                            </button>
                          </Tooltip>
                        </p>
                      )}
                    </div>

                    {/* Admin toggles */}
                    {isActualAdmin && (
                      <div className="px-4 py-2 border-b border-border-subtle space-y-2">
                        <ToggleSwitch
                          checked={adminMode}
                          onChange={setAdminMode}
                          label="Modo admin"
                        />
                        {/* Score/cost displays don't exist for non-admins, so hide
                            their toggles while previewing as one. */}
                        {adminMode && (
                          <>
                            <ToggleSwitch
                              checked={showRatings}
                              onChange={setShowRatings}
                              label="Mostrar puntajes"
                            />
                            <ToggleSwitch
                              checked={showCosts}
                              onChange={setShowCosts}
                              label="Mostrar costos"
                            />
                          </>
                        )}
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
            ) : (
              <button
                onClick={signIn}
                className="shrink-0 p-1.5 rounded-full border border-on-primary/30 hover:border-on-primary/70 text-on-primary/80 hover:text-on-primary transition-colors"
              >
                <GoogleIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <nav className="flex gap-4 sm:gap-6 mt-4 sm:mt-5 overflow-x-auto scrollbar-hide">
            {NAV_ITEMS.map(({ to, label, Icon, isActive }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm sm:text-base font-semibold whitespace-nowrap flex items-center gap-1.5 pb-2.5 sm:pb-3 border-b-[3px] transition-colors ${
                  isActive(location.pathname)
                    ? 'border-lime text-on-primary'
                    : 'border-transparent text-on-primary/60 hover:text-on-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 pt-6 flex-1">
        <Outlet />
      </div>

      <Footer />

      {editNameOpen && currentPlayer && (
        <EditNameDialog
          currentName={currentPlayer.name}
          onClose={() => setEditNameOpen(false)}
        />
      )}
    </div>
  );
}
