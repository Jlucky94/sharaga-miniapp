import React, { useEffect, useState } from 'react';

import { ArchetypePicker } from '../features/home/ArchetypePicker.js';
import { HomeScreen } from '../features/home/HomeScreen.js';
import { StatusPanel } from '../features/home/StatusPanel.js';
import { FeedScreen } from '../features/feed/FeedScreen.js';
import { ProjectsScreen } from '../features/projects/ProjectsScreen.js';
import { Tabs, type TabId } from './Tabs.js';
import { useAppState } from './useAppState.js';

function useTicker(intervalMs: number) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => { setTick(Date.now()); }, intervalMs);
    return () => { window.clearInterval(timer); };
  }, [intervalMs]);

  return tick;
}

export function App() {
  const { state, bootstrap, chooseArchetype, refreshProfileState, runAction } = useAppState();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const tick = useTicker(1000);

  useEffect(() => {
    return bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'checking') {
    return <StatusPanel title="Открываем сессию" message="Telegram подключает твой сохраненный профиль." tone="checking" />;
  }

  if (state.status === 'local') {
    return <StatusPanel title="Локальный режим включен" message={state.message} tone="warning" />;
  }

  if (state.status === 'error') {
    return <StatusPanel title="Сессия не открылась" message={state.message} tone="error" />;
  }

  if (!state.profileData.profile.archetype) {
    return (
      <ArchetypePicker
        onSelect={chooseArchetype}
        pending={state.pending === 'archetype'}
        errorMessage={state.errorMessage}
      />
    );
  }

  return (
    <div className="app-root">
      {activeTab === 'home' && (
        <HomeScreen
          state={state}
          tick={tick}
          onRefresh={refreshProfileState}
          onRunAction={runAction}
        />
      )}
      {activeTab === 'projects' && (
        <ProjectsScreen
          accessToken={state.accessToken}
          onProfileUpdate={() => void refreshProfileState(state.accessToken)}
        />
      )}
      {activeTab === 'feed' && (
        <FeedScreen
          accessToken={state.accessToken}
          currentUserId={state.profileData.user.id}
        />
      )}
      <Tabs active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
