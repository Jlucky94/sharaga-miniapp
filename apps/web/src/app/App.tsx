import React, { useEffect, useRef, useState } from 'react';

import { ArchetypePicker } from '../features/home/ArchetypePicker.js';
import { HomeScreen } from '../features/home/HomeScreen.js';
import { StatusPanel } from '../features/home/StatusPanel.js';
import { FeedScreen } from '../features/feed/FeedScreen.js';
import { ExamScreen } from '../features/exam/ExamScreen.js';
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
  const { state, bootstrap, chooseArchetype, refreshProfileState, runAction, enableWriteAccess } = useAppState();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const bootstrapCleanupRef = useRef<ReturnType<typeof bootstrap> | null>(null);
  const tick = useTicker(1000);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      bootstrapCleanupRef.current = bootstrap();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (typeof bootstrapCleanupRef.current === 'function') {
        bootstrapCleanupRef.current();
      }
      bootstrapCleanupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'checking') {
    return <StatusPanel title="Открываем сессию" message="Telegram подключает твой сохраненный профиль." tone="checking" />;
  }

  if (state.status === 'local') {
    return <StatusPanel title="Локальный режим включен" message={state.message} tone="warning" />;
  }

  if (state.status === 'error') {
    return (
      <StatusPanel
        title="Сессия не открылась"
        message={state.message}
        tone="error"
        actionLabel="Попробовать снова"
        onAction={() => {
          bootstrap();
        }}
      />
    );
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
          onEnableWriteAccess={enableWriteAccess}
        />
      )}
      {activeTab === 'projects' && (
        <ProjectsScreen
          accessToken={state.accessToken}
          onProfileUpdate={() => void refreshProfileState(state.accessToken)}
        />
      )}
      {activeTab === 'exam' && (
        <ExamScreen
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
