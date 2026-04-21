import React from 'react';

import type { Archetype } from '@sharaga/contracts';

type ArchetypeCardCopy = {
  title: string;
  summary: string;
  role: string;
};

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

export function ArchetypePicker({
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
        <p>One tap locks your role. Pick the fantasy that already feels natural to you.</p>
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
