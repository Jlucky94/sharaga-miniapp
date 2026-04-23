import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App.js';
import { AppErrorBoundary } from './app/AppErrorBoundary.js';
import './styles.css';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        requestWriteAccess?: ((callback?: (granted?: boolean) => void) => Promise<boolean> | void);
      };
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
