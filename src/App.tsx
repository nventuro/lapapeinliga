import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppProvider } from './context/AppContext';
import Footer from './components/Footer';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <p className="text-muted text-lg">Cargando...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-3xl font-bold mb-6">La Papeinliga</h1>
          <p className="text-muted mb-8">Iniciá sesión para armar los equipos.</p>
          <button
            onClick={handleSignIn}
            className="px-6 py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors"
          >
            Iniciar sesión con Google
          </button>
        </div>
        <Footer className="absolute bottom-6" />
      </div>
    );
  }

  return (
    <AppProvider session={session}>
      <div className="min-h-screen bg-surface text-on-surface">
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col min-h-screen">
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
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/' || location.pathname.startsWith('/matchdays')
                    ? 'text-primary'
                    : 'text-muted hover:text-muted-strong'
                }`}
              >
                Fechas
              </Link>
              <Link
                to="/sorter"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/sorter'
                    ? 'text-primary'
                    : 'text-muted hover:text-muted-strong'
                }`}
              >
                Armar equipos
              </Link>
              <Link
                to="/players"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/players'
                    ? 'text-primary'
                    : 'text-muted hover:text-muted-strong'
                }`}
              >
                Jugadores
              </Link>
            </nav>
          </header>

          <div className="flex-1">
            <Outlet />
          </div>

          <Footer className="mt-8 pb-4" />
        </div>
      </div>
    </AppProvider>
  );
}

export default App;
