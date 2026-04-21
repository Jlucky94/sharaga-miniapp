import React from 'react';

export type TabId = 'home' | 'projects' | 'feed';

export function Tabs({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="bottom-tabs">
      <button
        className={`tab-button${active === 'home' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('home')}
      >
        Home
      </button>
      <button
        className={`tab-button${active === 'projects' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('projects')}
      >
        Projects
      </button>
      <button
        className={`tab-button${active === 'feed' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('feed')}
      >
        Feed
      </button>
    </nav>
  );
}
