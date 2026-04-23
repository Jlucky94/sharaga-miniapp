import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { ExamParty, ExamRunResult, ExamState, PartyCapacity } from '@sharaga/contracts';

import { getExamState, leaveParty, queueForExam, setPartyReady } from '../../lib/api.js';
import { StatusPanel } from '../home/StatusPanel.js';

const capacityOptions: PartyCapacity[] = [3, 4, 5];
const archetypeLabels = {
  botan: 'Ботан',
  sportsman: 'Спортик',
  partygoer: 'Тусовщик'
} as const;

type ExamScreenProps = {
  accessToken: string;
  onProfileUpdate: () => void;
};

export function ExamScreen({ accessToken, onProfileUpdate }: ExamScreenProps) {
  const [state, setState] = useState<ExamState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCapacity, setSelectedCapacity] = useState<PartyCapacity>(3);
  const readyValueRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await getExamState(accessToken);
      setState(next);
      setErrorMessage(null);
      readyValueRef.current = Boolean(next.party?.members.find((member) => member.isCurrentUser)?.readyAt);
      return next;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить экзамен');
    });

    const interval = window.setInterval(() => {
      void load().catch(() => {});
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [load]);

  async function handleQueue() {
    setPending('queue');
    setErrorMessage(null);
    try {
      await queueForExam(accessToken, selectedCapacity);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось встать в очередь');
    } finally {
      setPending(null);
    }
  }

  async function handleReady(ready: boolean, party: ExamParty) {
    setPending('ready');
    setErrorMessage(null);
    try {
      const result = await setPartyReady(accessToken, party.id, ready);
      setState((current) => current ? { ...current, party: result.party, latestRun: result.run ?? current.latestRun } : current);
      readyValueRef.current = ready;
      if (result.run) {
        await onProfileUpdate();
      } else if (ready) {
        const refreshed = await load();
        if (refreshed.latestRun) {
          await onProfileUpdate();
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось обновить готовность');
    } finally {
      setPending(null);
    }
  }

  async function handleLeave(party: ExamParty) {
    setPending('leave');
    setErrorMessage(null);
    try {
      await leaveParty(accessToken, party.id);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось выйти из пати');
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return <StatusPanel title="Подгружаем экзамен" message="Проверяем текущую пати, очередь и последний прогон." tone="checking" />;
  }

  if (!state) {
    return (
      <StatusPanel
        title="Экзамен временно недоступен"
        message={errorMessage ?? 'Не удалось загрузить состояние экзамена.'}
        tone="error"
        actionLabel="Обновить"
        onAction={() => {
          setLoading(true);
          setErrorMessage(null);
          void load();
        }}
      />
    );
  }

  const party = state.party;
  const latestRun = state.latestRun;
  const currentMember = party?.members.find((member) => member.isCurrentUser) ?? null;

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Экзамен недели</span>
        <h1>{state.exam.title}</h1>
        <p>{state.exam.description}</p>
      </section>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}

      {!party && (
        <section className="card-grid">
          <article className="card">
            <h2>Собери пати под свой темп</h2>
            <p>Выбери размер группы, встань в очередь и дождись автонабора. Когда пати соберётся, все отмечают готовность и экзамен стартует сам.</p>
            <div className="reward-strip">
              {capacityOptions.map((capacity) => (
                <button
                  key={capacity}
                  className={selectedCapacity === capacity ? 'primary-button' : 'secondary-button'}
                  disabled={pending !== null}
                  onClick={() => setSelectedCapacity(capacity)}
                >
                  На {capacity}
                </button>
              ))}
            </div>
            <button className="primary-button" disabled={pending !== null} onClick={() => void handleQueue()}>
              {pending === 'queue' ? 'Ищем пати...' : 'Встать в очередь'}
            </button>
          </article>

          {latestRun && <ResultCard run={latestRun} />}
        </section>
      )}

      {party && (
        <section className="card-grid">
          <article className="card">
            <span className="card-tag">{party.status === 'queueing' ? 'Набор идет' : 'Чек готовности'}</span>
            <h2>Пати на {party.capacity} человека</h2>
            <p>
              {party.status === 'queueing'
                ? `Сейчас ${party.memberCount} из ${party.capacity}. Как только слоты заполнятся, перейдете к готовности.`
                : 'Пати собрана. Как только все отметятся, экзамен стартует сам без лишней кнопки.'}
            </p>

            <div className="feed-list">
              {party.members.map((member) => (
                <article key={member.userId} className="feed-item">
                  <p>
                    <strong>{member.firstName}</strong> · {archetypeLabels[member.archetype]}
                    {member.isOwner ? ' · лидер' : ''}
                  </p>
                  <span className="feed-time">{member.readyAt ? 'Готов' : 'Не готов'}</span>
                </article>
              ))}
            </div>

            {currentMember && party.status === 'ready_check' && (
              <button
                className="primary-button"
                disabled={pending !== null}
                onClick={() => void handleReady(!Boolean(currentMember.readyAt), party)}
              >
                {pending === 'ready'
                  ? 'Обновляем...'
                  : currentMember.readyAt
                    ? 'Снять готовность'
                    : 'Я готов'}
              </button>
            )}

            <button
              className="secondary-button"
              disabled={pending !== null}
              onClick={() => void handleLeave(party)}
            >
              {pending === 'leave' ? 'Выходим...' : 'Выйти из пати'}
            </button>
          </article>

          {latestRun && <ResultCard run={latestRun} />}
        </section>
      )}
    </main>
  );
}

function ResultCard({ run }: { run: ExamRunResult }) {
  return (
    <article className="card">
      <span className="card-tag">{run.outcome === 'success' ? 'Сдали' : 'Частичный вывоз'}</span>
      <h2>Последний результат</h2>
      <p>{run.summary}</p>
      <div className="reward-strip">
        <span>Шанс: {run.successChancePct}%</span>
        <span>Бросок: {run.rollPct}</span>
      </div>
      <div className="feed-list">
        {run.rewards.map((reward) => (
          <article key={reward.userId} className="feed-item">
            <p>Участник</p>
            <span className="feed-time">
              +{reward.profileXp} XP · +{reward.archetypeXp} XP роли · +{reward.softCurrency} монет
              {reward.reputation > 0 ? ` · +${reward.reputation} репы` : ''}
            </span>
          </article>
        ))}
      </div>
    </article>
  );
}
