import React from 'react';

export type TabId = 'home' | 'projects' | 'exam' | 'feed';

export function Tabs({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="bottom-tabs">
      <button
        className={`tab-button${active === 'home' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('home')}
      >
        Главная
      </button>
      <button
        className={`tab-button${active === 'projects' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('projects')}
      >
        Проекты
      </button>
      <button
        className={`tab-button${active === 'feed' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('feed')}
      >
        Лента
      </button>
      <button
        className={`tab-button${active === 'exam' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('exam')}
      >
        Экзамен
      </button>
    </nav>
  );
}
