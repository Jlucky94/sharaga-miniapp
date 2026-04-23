import React from 'react';

import { StatusPanel } from '../features/home/StatusPanel.js';

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('AppErrorBoundary caught an error', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <StatusPanel
          title="Что-то пошло не так"
          message="Интерфейс споткнулся на неожиданной ошибке. Перезагрузи мини-апп и попробуй еще раз."
          tone="error"
          actionLabel="Перезагрузить"
          onAction={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
