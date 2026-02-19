import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppProvider } from './context/AppContext';
import MainLayout from './components/MainLayout';

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only update session on meaningful auth changes, not token refreshes.
      // Supabase auto-refreshes tokens on tab visibility change, which would
      // otherwise trigger a full data reload via the session dependency in AppContext.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center">
        <p className="text-muted text-lg">Cargando...</p>
      </div>
    );
  }

  return (
    <AppProvider session={session}>
      <MainLayout />
    </AppProvider>
  );
}

export default App;
