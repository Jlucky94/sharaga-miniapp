import React from 'react';

import type { Archetype } from '@sharaga/contracts';

type ArchetypeCardCopy = {
  title: string;
  summary: string;
  role: string;
};

const archetypeCards: Record<Archetype, ArchetypeCardCopy> = {
  botan: {
    title: 'Ботан',
    summary: 'Собирает инфу, держит все по полочкам и вытаскивает своих, когда у остальных уже тильт.',
    role: 'Твоя тема, если хочешь тащить через ум, пользу и крепкие конспекты.'
  },
  sportsman: {
    title: 'Спортик',
    summary: 'Держит темп, не сыпется под нагрузкой и подхватывает общий ритм, когда всем тяжело.',
    role: 'Подходит, если тебе ближе движение, надежность и ощущение, что на тебе все не развалится.'
  },
  partygoer: {
    title: 'Тусовщик',
    summary: 'Поднимает вайб, собирает людей и превращает мертвый чат в нормальный движ.',
    role: 'Бери, если хочешь играть от харизмы, заметности и социального веса.'
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
        <span className="eyebrow">Первая роль</span>
        <h1>Выбери, как ты будешь тащить общий движ.</h1>
        <p>Одно нажатие закрепляет роль. Бери то, что тебе реально ближе по вайбу.</p>
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
                {pending ? 'Сохраняем роль...' : `Выбрать ${copy.title}`}
              </button>
            </article>
          );
        })}
      </section>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
    </main>
  );
}
