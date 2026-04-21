import React from 'react';

export function StatusPanel({
  title,
  message,
  tone
}: {
  title: string;
  message: string;
  tone: 'checking' | 'warning' | 'error';
}) {
  return (
    <main className="app-shell">
      <section className={`hero-panel hero-panel--${tone}`}>
        <span className="eyebrow">Sharaga</span>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
