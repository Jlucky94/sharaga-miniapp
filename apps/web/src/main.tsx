import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  actionCatalog,
  actionIds,
  type ActionId,
  type ActionResult,
  type Archetype,
  type ProfileResponse,
  type PublicUser
} from '@sharaga/contracts';

import './styles.css';

type AuthResponse = {
  accessToken: string;
  user: PublicUser;
};

type ReadyState = {
  status: 'ready';
  accessToken: string;
  profileData: ProfileResponse;
  result: ActionResult | null;
  pending: 'refresh' | 'archetype' | ActionId | null;
  errorMessage: string | null;
};

type AppState =
  | { status: 'checking' }
  | { status: 'local'; message: string }
  | { status: 'error'; message: string }
  | ReadyState;

type ApiError = {
  code?: string;
  message?: string;
};

type ArchetypeCardCopy = {
  title: string;
  summary: string;
  role: string;
};

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
const archetypeCards: Record<Archetype, ArchetypeCardCopy> = {
  botan: {
    title: 'Botan',
    summary: 'Clever, prepared, and the one who quietly keeps everybody from falling behind.',
    role: 'Best when you want your progress to feel like steady academic support.'
  },
  sportsman: {
    title: 'Sportsman',
    summary: 'Reliable momentum, physical discipline, and the teammate who stabilizes the group.',
    role: 'Best when you want your progress to feel grounded, active, and dependable.'
  },
  partygoer: {
    title: 'Partygoer',
    summary: 'Social spark, campus connector, and the player who makes other people show up.',
    role: 'Best when you want your progress to feel visible, energetic, and magnetic.'
  }
};

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function authenticate(initData: string): Promise<AuthResponse> {
  const response = await fetch('/api/v1/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Unable to authenticate with Telegram');
  }

  return (await response.json()) as AuthResponse;
}

async function getProfile(accessToken: string): Promise<ProfileResponse> {
  const response = await fetch('/api/v1/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Unable to load profile');
  }

  return (await response.json()) as ProfileResponse;
}

async function selectArchetype(accessToken: string, archetype: Archetype): Promise<ProfileResponse> {
  const response = await fetch('/api/v1/class/select', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ archetype })
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Unable to select archetype');
  }

  return (await response.json()) as ProfileResponse;
}

async function performAction(accessToken: string, actionId: ActionId): Promise<ProfileResponse & { result: ActionResult }> {
  const response = await fetch('/api/v1/actions/perform', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ actionId })
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Unable to perform action');
  }

  return (await response.json()) as ProfileResponse & { result: ActionResult };
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function useTicker(intervalMs: number) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now());
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return tick;
}

function useAppState() {
  const [state, setState] = useState<AppState>({ status: 'checking' });

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    let cancelled = false;

    async function bootstrap() {
      const initData = window.Telegram?.WebApp?.initData || (import.meta.env.DEV ? DEV_INIT_DATA : undefined);

      if (!initData) {
        if (!cancelled) {
          setState({
            status: 'local',
            message:
              'Local development mode is available, but product auth needs Telegram initData. Set VITE_DEV_TELEGRAM_INIT_DATA to preview the full BUILD-P1 loop.'
          });
        }

        return;
      }

      try {
        const auth = await authenticate(initData);
        const profileData = await getProfile(auth.accessToken);

        if (!cancelled) {
          setState({
            status: 'ready',
            accessToken: auth.accessToken,
            profileData,
            result: null,
            pending: null,
            errorMessage: null
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to open the Mini App session.'
          });
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshProfileState(accessToken: string) {
    setState((current) => {
      if (current.status !== 'ready' || current.accessToken !== accessToken) {
        return current;
      }

      return {
        ...current,
        pending: 'refresh',
        errorMessage: null
      };
    });

    try {
      const profileData = await getProfile(accessToken);
      setState((current) => {
        if (current.status !== 'ready' || current.accessToken !== accessToken) {
          return current;
        }

        return {
          ...current,
          profileData,
          pending: null,
          errorMessage: null
        };
      });
    } catch (error) {
      setState((current) => {
        if (current.status !== 'ready' || current.accessToken !== accessToken) {
          return current;
        }

        return {
          ...current,
          pending: null,
          errorMessage: error instanceof Error ? error.message : 'Unable to refresh profile'
        };
      });
    }
  }

  async function chooseArchetype(archetype: Archetype) {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }

      return {
        ...current,
        pending: 'archetype',
        errorMessage: null
      };
    });

    const accessToken = state.status === 'ready' ? state.accessToken : null;
    if (!accessToken) {
      return;
    }

    try {
      const profileData = await selectArchetype(accessToken, archetype);
      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }

        return {
          ...current,
          profileData,
          result: null,
          pending: null,
          errorMessage: null
        };
      });
    } catch (error) {
      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }

        return {
          ...current,
          pending: null,
          errorMessage: error instanceof Error ? error.message : 'Unable to select archetype'
        };
      });
    }
  }

  async function runAction(actionId: ActionId) {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }

      return {
        ...current,
        pending: actionId,
        errorMessage: null
      };
    });

    const accessToken = state.status === 'ready' ? state.accessToken : null;
    if (!accessToken) {
      return;
    }

    try {
      const response = await performAction(accessToken, actionId);
      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }

        return {
          ...current,
          profileData: {
            user: response.user,
            profile: response.profile,
            serverTime: response.serverTime,
            nextEnergyAt: response.nextEnergyAt
          },
          result: response.result,
          pending: null,
          errorMessage: null
        };
      });
    } catch (error) {
      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }

        return {
          ...current,
          pending: null,
          errorMessage: error instanceof Error ? error.message : 'Unable to perform action'
        };
      });
    }
  }

  return {
    state,
    chooseArchetype,
    refreshProfileState,
    runAction
  };
}

function StatusPanel({ title, message, tone }: { title: string; message: string; tone: 'checking' | 'warning' | 'error' }) {
  return (
    <main className="app-shell">
      <section className={`hero-panel hero-panel--${tone}`}>
        <span className="eyebrow">Sharaga P1</span>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function ArchetypePicker({
  onSelect,
  pending,
  errorMessage
}: {
  onSelect: (archetype: Archetype) => Promise<void>;
  pending: boolean;
  errorMessage: string | null;
}) {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">First Value</span>
        <h1>Choose how your character helps the campus.</h1>
        <p>One tap locks your role for BUILD-P1. Pick the fantasy that already feels natural to you.</p>
      </section>

      <section className="card-grid">
        {(['botan', 'sportsman', 'partygoer'] as const).map((archetype) => {
          const copy = archetypeCards[archetype];

          return (
            <article key={archetype} className="card">
              <span className="card-tag">{copy.title}</span>
              <h2>{copy.summary}</h2>
              <p>{copy.role}</p>
              <button className="primary-button" disabled={pending} onClick={() => void onSelect(archetype)}>
                {pending ? 'Saving role...' : `Become ${copy.title}`}
              </button>
            </article>
          );
        })}
      </section>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
    </main>
  );
}

function HomeScreen({
  state,
  onRefresh,
  onRunAction
}: {
  state: ReadyState;
  onRefresh: (accessToken: string) => Promise<void>;
  onRunAction: (actionId: ActionId) => Promise<void>;
}) {
  const tick = useTicker(1000);
  const serverOffsetMs = new Date(state.profileData.serverTime).getTime() - Date.now();
  const correctedNow = tick + serverOffsetMs;
  const nextEnergyAtMs = state.profileData.nextEnergyAt ? new Date(state.profileData.nextEnergyAt).getTime() : null;
  const remainingMs = nextEnergyAtMs ? Math.max(0, nextEnergyAtMs - correctedNow) : 0;
  const profile = state.profileData.profile;
  const selectedArchetype = profile.archetype;

  const orderedActions = useMemo(() => {
    if (!selectedArchetype) {
      return [...actionIds];
    }

    return [...actionIds].sort((left, right) => {
      const leftScore = actionCatalog[left].archetypeAffinity === selectedArchetype ? 0 : 1;
      const rightScore = actionCatalog[right].archetypeAffinity === selectedArchetype ? 0 : 1;
      return leftScore - rightScore;
    });
  }, [selectedArchetype]);

  useEffect(() => {
    if (!state.profileData.nextEnergyAt || remainingMs > 0 || state.pending) {
      return;
    }

    void onRefresh(state.accessToken);
  }, [onRefresh, remainingMs, state.accessToken, state.pending, state.profileData.nextEnergyAt]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Saved Progress</span>
        <h1>{state.profileData.user.firstName}, your role is live.</h1>
        <p>
          {selectedArchetype
            ? `You are playing as ${archetypeCards[selectedArchetype].title}. One clear action is enough to keep momentum today.`
            : 'Choose an archetype to unlock your first meaningful action.'}
        </p>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Archetype</span>
          <strong>{selectedArchetype ? archetypeCards[selectedArchetype].title : 'Not chosen yet'}</strong>
        </article>
        <article className="stat-card">
          <span>Level</span>
          <strong>{profile.level}</strong>
        </article>
        <article className="stat-card">
          <span>Profile XP</span>
          <strong>{profile.profileXp}</strong>
        </article>
        <article className="stat-card">
          <span>Role XP</span>
          <strong>{profile.archetypeXp}</strong>
        </article>
        <article className="stat-card">
          <span>Energy</span>
          <strong>{profile.energy}/3</strong>
        </article>
        <article className="stat-card">
          <span>Soft Currency</span>
          <strong>{profile.softCurrency}</strong>
        </article>
      </section>

      <section className="action-header">
        <div>
          <h2>Today’s short loop</h2>
          <p>
            {profile.energy > 0
              ? 'Run one action, get readable progress, and leave with something saved.'
              : `Energy is empty. Next point returns in ${formatCountdown(remainingMs)}.`}
          </p>
        </div>
      </section>

      <section className="action-grid">
        {orderedActions.map((actionId, index) => {
          const action = actionCatalog[actionId];
          const recommended = selectedArchetype !== null && action.archetypeAffinity === selectedArchetype && index === 0;
          const disabled = profile.energy === 0 || state.pending !== null;

          return (
            <article key={actionId} className={`action-card${recommended ? ' action-card--recommended' : ''}`}>
              <div className="action-copy">
                <span className="card-tag">
                  {recommended ? 'Recommended' : action.archetypeAffinity ? archetypeCards[action.archetypeAffinity].title : 'Universal'}
                </span>
                <h3>{action.label}</h3>
                <p>{action.description}</p>
              </div>
              <button
                className={recommended ? 'primary-button' : 'secondary-button'}
                disabled={disabled}
                onClick={() => void onRunAction(actionId)}
              >
                {state.pending === actionId ? 'Working...' : 'Do this action'}
              </button>
            </article>
          );
        })}
      </section>

      {state.errorMessage ? <p className="inline-error">{state.errorMessage}</p> : null}

      <section className="result-panel">
        <h2>Last visible result</h2>
        {state.result ? (
          <>
            <p>{state.result.text}</p>
            <div className="reward-strip">
              <span>+{state.result.rewards.profileXp} profile XP</span>
              <span>+{state.result.rewards.archetypeXp} role XP</span>
              <span>+{state.result.rewards.softCurrency} currency</span>
            </div>
          </>
        ) : (
          <p>Your first action result will appear here with readable rewards instead of raw hidden state.</p>
        )}
      </section>
    </main>
  );
}

function App() {
  const { state, chooseArchetype, refreshProfileState, runAction } = useAppState();

  if (state.status === 'checking') {
    return <StatusPanel title="Opening your campus session" message="Telegram auth is connecting your saved profile." tone="checking" />;
  }

  if (state.status === 'local') {
    return <StatusPanel title="Local mode is safe" message={state.message} tone="warning" />;
  }

  if (state.status === 'error') {
    return <StatusPanel title="The session did not open" message={state.message} tone="error" />;
  }

  if (!state.profileData.profile.archetype) {
    return (
      <ArchetypePicker
        onSelect={chooseArchetype}
        pending={state.pending === 'archetype'}
        errorMessage={state.errorMessage}
      />
    );
  }

  return <HomeScreen state={state} onRefresh={refreshProfileState} onRunAction={runAction} />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
