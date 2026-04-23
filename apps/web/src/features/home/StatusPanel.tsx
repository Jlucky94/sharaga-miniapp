import React from 'react';

export function StatusPanel({
  title,
  message,
  tone,
  actionLabel,
  onAction
}: {
  title: string;
  message: string;
  tone: 'checking' | 'warning' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="app-shell">
      <section className={`hero-panel hero-panel--${tone}`}>
        <span className="eyebrow">Шарага</span>
        <h1>{title}</h1>
        <p>{message}</p>
        {actionLabel && onAction ? (
          <div className="status-actions">
            <button className="primary-button" onClick={onAction}>
              {actionLabel}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
