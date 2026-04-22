import React, { useEffect, useMemo } from 'react';

import { actionCatalog, actionIds, type ActionId, type ActionResult, type Archetype, type ProfileResponse } from '@sharaga/contracts';

type ArchetypeCardCopy = { title: string };
const archetypeCards: Record<Archetype, ArchetypeCardCopy> = {
  botan: { title: 'Ботан' },
  sportsman: { title: 'Спортик' },
  partygoer: { title: 'Тусовщик' }
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
        <span className="eyebrow">Твой прогресс</span>
        <h1>{state.profileData.user.firstName}, твоя роль уже в деле.</h1>
        <p>
          {selectedArchetype
            ? `Сейчас ты играешь за ${archetypeCards[selectedArchetype].title}. Одного внятного действия хватит, чтобы не выпадать из движа сегодня.`
            : 'Сначала выбери роль, чтобы открыть свой первый полезный ход.'}
        </p>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Роль</span>
          <strong>{selectedArchetype ? archetypeCards[selectedArchetype].title : 'Еще не выбрана'}</strong>
        </article>
        <article className="stat-card">
          <span>Уровень</span>
          <strong>{profile.level}</strong>
        </article>
        <article className="stat-card">
          <span>Общий XP</span>
          <strong>{profile.profileXp}</strong>
        </article>
        <article className="stat-card">
          <span>XP роли</span>
          <strong>{profile.archetypeXp}</strong>
        </article>
        <article className="stat-card">
          <span>Энергия</span>
          <strong>{profile.energy}/3</strong>
        </article>
        <article className="stat-card">
          <span>Монеты</span>
          <strong>{profile.softCurrency}</strong>
        </article>
        <article className="stat-card">
          <span>Репутация</span>
          <strong>{profile.reputation}</strong>
        </article>
      </section>

      <section className="action-header">
        <div>
          <h2>Короткий цикл на сегодня</h2>
          <p>
            {profile.energy > 0
              ? 'Одно действие - и у тебя останется сохраненный прогресс, XP и немного ресурса.'
              : `Энергия на нуле. Следующая единица вернется через ${formatCountdown(remainingMs)}.`}
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
                  {recommended ? 'Тебе в тему' : action.archetypeAffinity ? archetypeCards[action.archetypeAffinity].title : 'Для всех'}
                </span>
                <h3>{action.label}</h3>
                <p>{action.description}</p>
              </div>
              <button
                className={recommended ? 'primary-button' : 'secondary-button'}
                disabled={disabled}
                onClick={() => void onRunAction(actionId)}
              >
                {state.pending === actionId ? 'Делаем...' : 'Сделать'}
              </button>
            </article>
          );
        })}
      </section>

      {state.errorMessage ? <p className="inline-error">{state.errorMessage}</p> : null}

      <section className="result-panel">
        <h2>Последний заметный результат</h2>
        {state.result ? (
          <>
            <p>{state.result.text}</p>
            <div className="reward-strip">
              <span>+{state.result.rewards.profileXp} общего XP</span>
              <span>+{state.result.rewards.archetypeXp} XP роли</span>
              <span>+{state.result.rewards.softCurrency} монет</span>
            </div>
          </>
        ) : (
          <p>Здесь появится результат твоего последнего действия - без сухих цифр и с понятной пользой.</p>
        )}
      </section>
    </main>
  );
}
