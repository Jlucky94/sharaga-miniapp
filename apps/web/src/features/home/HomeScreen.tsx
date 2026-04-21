import React, { useEffect, useMemo } from 'react';

import { actionCatalog, actionIds, type ActionId, type ActionResult, type Archetype, type ProfileResponse } from '@sharaga/contracts';

type ArchetypeCardCopy = { title: string };
const archetypeCards: Record<Archetype, ArchetypeCardCopy> = {
  botan: { title: 'Botan' },
  sportsman: { title: 'Sportsman' },
  partygoer: { title: 'Partygoer' }
};

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

type ReadyState = {
  status: 'ready';
  accessToken: string;
  profileData: ProfileResponse;
  result: ActionResult | null;
  pending: 'refresh' | 'archetype' | ActionId | null;
  errorMessage: string | null;
};

export function HomeScreen({
  state,
  tick,
  onRefresh,
  onRunAction
}: {
  state: ReadyState;
  tick: number;
  onRefresh: (accessToken: string) => Promise<void>;
  onRunAction: (actionId: ActionId) => Promise<void>;
}) {
  const serverOffsetMs = new Date(state.profileData.serverTime).getTime() - Date.now();
  const correctedNow = tick + serverOffsetMs;
  const nextEnergyAtMs = state.profileData.nextEnergyAt ? new Date(state.profileData.nextEnergyAt).getTime() : null;
  const remainingMs = nextEnergyAtMs ? Math.max(0, nextEnergyAtMs - correctedNow) : 0;
  const profile = state.profileData.profile;
  const selectedArchetype = profile.archetype;

  const orderedActions = useMemo(() => {
    if (!selectedArchetype) return [...actionIds];
    return [...actionIds].sort((left, right) => {
      const leftScore = actionCatalog[left].archetypeAffinity === selectedArchetype ? 0 : 1;
      const rightScore = actionCatalog[right].archetypeAffinity === selectedArchetype ? 0 : 1;
      return leftScore - rightScore;
    });
  }, [selectedArchetype]);

  useEffect(() => {
    if (!state.profileData.nextEnergyAt || remainingMs > 0 || state.pending) return;
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
          <span>Currency</span>
          <strong>{profile.softCurrency}</strong>
        </article>
        <article className="stat-card">
          <span>Reputation</span>
          <strong>{profile.reputation}</strong>
        </article>
      </section>

      <section className="action-header">
        <div>
          <h2>Today's short loop</h2>
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
          <p>Your first action result will appear here with readable rewards.</p>
        )}
      </section>
    </main>
  );
}
