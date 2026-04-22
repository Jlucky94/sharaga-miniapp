import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { Project } from '@sharaga/contracts';

import { claimBenefit, contributeToProject, listProjects } from '../../lib/api.js';

type ProjectsScreenProps = {
  accessToken: string;
  onProfileUpdate: () => void;
};

const archetypeLabels = {
  botan: 'Ботан',
  sportsman: 'Спортик',
  partygoer: 'Тусовщик'
} as const;

export function ProjectsScreen({ accessToken, onProfileUpdate }: ProjectsScreenProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Cache requestId per project for retry safety
  const requestIds = useRef<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const data = await listProjects(accessToken);
      setProjects(data.projects);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось загрузить проекты');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleContribute(projectId: string) {
    if (!requestIds.current.has(projectId)) {
      requestIds.current.set(projectId, crypto.randomUUID());
    }
    const requestId = requestIds.current.get(projectId)!;

    setPendingId(projectId);
    setErrorMessage(null);
    try {
      await contributeToProject(accessToken, projectId, requestId);
      // Fresh requestId for next contribution
      requestIds.current.set(projectId, crypto.randomUUID());
      await load();
      onProfileUpdate();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось вложиться в проект');
    } finally {
      setPendingId(null);
    }
  }

  async function handleClaim(projectId: string) {
    setPendingId(projectId);
    setErrorMessage(null);
    try {
      await claimBenefit(accessToken, projectId);
      await load();
      onProfileUpdate();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось забрать бонус');
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <section className="hero-panel hero-panel--checking">
          <span className="eyebrow">Проекты</span>
          <h1>Подгружаем проекты...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Проекты кампуса</span>
        <h1>Вкладывайся в общий движ.</h1>
        <p>Твой вклад двигает проект вперед, а когда проект открывается, другие могут забрать бонус и сказать тебе спасибо.</p>
      </section>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}

      <section className="card-grid">
        {projects.map((project) => {
          const progressPct = Math.min(100, Math.round((project.progress / project.threshold) * 100));
          const isPending = pendingId === project.id;
          const isContributor = project.userContribution > 0;
          const canContribute = !project.unlocked;
          const canClaim = project.unlocked && !project.userHasClaimed && !isContributor;

          return (
            <article key={project.id} className="card">
              <span className="card-tag">{project.affinity ? archetypeLabels[project.affinity] : 'Для всех'}</span>
              <h2>{project.title}</h2>
              <p>{project.description}</p>

              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="progress-label">
                {project.unlocked
                  ? 'Открыто'
                  : `${project.progress} / ${project.threshold} вкладов`}
              </p>

              {canContribute && (
                <button
                  className="primary-button"
                  disabled={isPending}
                  onClick={() => void handleContribute(project.id)}
                >
                  {isPending ? 'Вкладываемся...' : 'Вложиться'}
                </button>
              )}

              {canClaim && (
                <button
                  className="primary-button"
                  disabled={isPending}
                  onClick={() => void handleClaim(project.id)}
                >
                  {isPending ? 'Забираем...' : 'Забрать бонус'}
                </button>
              )}

              {project.unlocked && isContributor && (
                <p className="inline-success">Ты уже вложился в этот проект. Бонус забирают те, кому твой вклад помог.</p>
              )}

              {project.unlocked && project.userHasClaimed && (
                <p className="inline-success">Бонус уже у тебя</p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
