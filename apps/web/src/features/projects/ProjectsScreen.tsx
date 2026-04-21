import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { Project } from '@sharaga/contracts';

import { claimBenefit, contributeToProject, listProjects } from '../../lib/api.js';

type ProjectsScreenProps = {
  accessToken: string;
  onProfileUpdate: () => void;
};

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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load projects');
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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to contribute');
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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to claim benefit');
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <section className="hero-panel hero-panel--checking">
          <span className="eyebrow">Campus</span>
          <h1>Loading projects...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Campus Projects</span>
        <h1>Contribute to shared goals.</h1>
        <p>Your contribution helps everyone — and when a project unlocks, others can thank you for it.</p>
      </section>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}

      <section className="card-grid">
        {projects.map((project) => {
          const progressPct = Math.min(100, Math.round((project.progress / project.threshold) * 100));
          const isPending = pendingId === project.id;
          const canContribute = !project.unlocked;
          const canClaim = project.unlocked && !project.userHasClaimed;

          return (
            <article key={project.id} className="card">
              <span className="card-tag">{project.affinity ?? 'Any'}</span>
              <h2>{project.title}</h2>
              <p>{project.description}</p>

              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="progress-label">
                {project.unlocked
                  ? 'Unlocked'
                  : `${project.progress} / ${project.threshold} contributions`}
              </p>

              {canContribute && (
                <button
                  className="primary-button"
                  disabled={isPending}
                  onClick={() => void handleContribute(project.id)}
                >
                  {isPending ? 'Contributing...' : 'Contribute'}
                </button>
              )}

              {canClaim && (
                <button
                  className="primary-button"
                  disabled={isPending}
                  onClick={() => void handleClaim(project.id)}
                >
                  {isPending ? 'Claiming...' : 'Claim benefit'}
                </button>
              )}

              {project.unlocked && project.userHasClaimed && (
                <p className="inline-success">Benefit claimed</p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
