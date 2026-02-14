import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppProvider } from './context/AppContext';
import AuthenticatedLayout from './components/AuthenticatedLayout';
import Footer from './components/Footer';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center">
        <p className="text-muted text-lg">Cargando...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex flex-col items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-3xl font-bold mb-6">La Papeinliga</h1>
          <p className="text-muted mb-8">Iniciá sesión para unirte a la sensación.</p>
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
      <AuthenticatedLayout />
    </AppProvider>
  );
}

export default App;
