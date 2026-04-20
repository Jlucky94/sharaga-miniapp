import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

type User = {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  photoUrl: string | null;
};

type AuthState =
  | { status: 'checking' }
  | { status: 'local'; message: string }
  | { status: 'authenticated'; accessToken: string; user: User }
  | { status: 'error'; message: string };

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

const DEV_INIT_DATA = import.meta.env.VITE_DEV_TELEGRAM_INIT_DATA as string | undefined;

async function authenticate(initData: string) {
  const response = await fetch('/api/v1/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });

  if (!response.ok) {
    throw new Error('Unable to authenticate with Telegram');
  }

  return (await response.json()) as { accessToken: string; user: User };
}

function useAuthState() {
  const [authState, setAuthState] = React.useState<AuthState>({ status: 'checking' });

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    let cancelled = false;

    async function runAuth() {
      const initData = window.Telegram?.WebApp?.initData || (import.meta.env.DEV ? DEV_INIT_DATA : undefined);

      if (!initData) {
        setAuthState({ status: 'local', message: 'Local development mode. Telegram initData was not provided.' });
        return;
      }

      try {
        const auth = await authenticate(initData);
        if (!cancelled) {
          setAuthState({ status: 'authenticated', ...auth });
        }
      } catch (error) {
        if (!cancelled) {
          setAuthState({
            status: 'error',
            message: error instanceof Error ? `${error.message}. Local mode is still available.` : 'Local mode is available.'
          });
        }
      }
    }

    void runAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return authState;
}

function getStatusCopy(authState: AuthState) {
  if (authState.status === 'authenticated') {
    return {
      label: 'Telegram session',
      title: `Hi, ${authState.user.firstName}`,
      detail: `Telegram ID ${authState.user.telegramId} is verified by the backend.`
    };
  }

  if (authState.status === 'checking') {
    return {
      label: 'Checking',
      title: 'Opening session',
      detail: 'The app is reading Telegram initData and asking the API to verify it.'
    };
  }

  return {
    label: 'Local mode',
    title: 'Ready for app code',
    detail: authState.message
  };
}

function App() {
  const authState = useAuthState();
  const copy = getStatusCopy(authState);

  return (
    <main className="app-shell">
      <section className="session-panel">
        <span className="session-chip">{copy.label}</span>
        <h1>{copy.title}</h1>
        <p>{copy.detail}</p>
      </section>

      <section className="notes-panel">
        <h2>Base is connected</h2>
        <p>Telegram auth, API proxy, Docker deployment, and local initData generation are already wired.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
