import { useState } from 'react';

import type { ActionId, ActionResult, ProfileResponse } from '@sharaga/contracts';

import { authenticate, getProfile, performAction, selectArchetype } from '../lib/api.js';
import type { Archetype } from '@sharaga/contracts';

export type ReadyState = {
  status: 'ready';
  accessToken: string;
  profileData: ProfileResponse;
  result: ActionResult | null;
  pending: 'refresh' | 'archetype' | ActionId | null;
  errorMessage: string | null;
};

export type AppState =
  | { status: 'checking' }
  | { status: 'local'; message: string }
  | { status: 'error'; message: string }
  | ReadyState;

const DEV_INIT_DATA = import.meta.env.VITE_DEV_TELEGRAM_INIT_DATA as string | undefined;

export function useAppState() {
  const [state, setState] = useState<AppState>({ status: 'checking' });

  function bootstrap() {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    let cancelled = false;

    const initData = window.Telegram?.WebApp?.initData || (import.meta.env.DEV ? DEV_INIT_DATA : undefined);

    if (!initData) {
      setState({
        status: 'local',
        message:
          'Локальная разработка доступна, но для полного входа нужен Telegram initData. Добавь VITE_DEV_TELEGRAM_INIT_DATA, чтобы увидеть весь цикл.'
      });
      return () => { cancelled = true; };
    }

    async function run() {
      try {
        const auth = await authenticate(initData!);
        const profileData = await getProfile(auth.accessToken);

        if (!cancelled) {
          setState({
            status: 'ready',
            accessToken: auth.accessToken,
            profileData,
            result: null,
            pending: null,
            errorMessage: null
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Не удалось открыть сессию мини-аппа.'
          });
        }
      }
    }

    void run();
    return () => { cancelled = true; };
  }

  async function refreshProfileState(accessToken: string) {
    setState((current) => {
      if (current.status !== 'ready' || current.accessToken !== accessToken) return current;
      return { ...current, pending: 'refresh', errorMessage: null };
    });

    try {
      const profileData = await getProfile(accessToken);
      setState((current) => {
        if (current.status !== 'ready' || current.accessToken !== accessToken) return current;
        return { ...current, profileData, pending: null, errorMessage: null };
      });
    } catch (error) {
      setState((current) => {
        if (current.status !== 'ready' || current.accessToken !== accessToken) return current;
        return { ...current, pending: null, errorMessage: error instanceof Error ? error.message : 'Не удалось обновить профиль' };
      });
    }
  }

  async function chooseArchetype(archetype: Archetype) {
    setState((current) => {
      if (current.status !== 'ready') return current;
      return { ...current, pending: 'archetype', errorMessage: null };
    });

    const accessToken = state.status === 'ready' ? state.accessToken : null;
    if (!accessToken) return;

    try {
      const profileData = await selectArchetype(accessToken, archetype);
      setState((current) => {
        if (current.status !== 'ready') return current;
        return { ...current, profileData, result: null, pending: null, errorMessage: null };
      });
    } catch (error) {
      setState((current) => {
        if (current.status !== 'ready') return current;
        return { ...current, pending: null, errorMessage: error instanceof Error ? error.message : 'Не удалось выбрать роль' };
      });
    }
  }

  async function runAction(actionId: ActionId) {
    setState((current) => {
      if (current.status !== 'ready') return current;
      return { ...current, pending: actionId, errorMessage: null };
    });

    const accessToken = state.status === 'ready' ? state.accessToken : null;
    if (!accessToken) return;

    try {
      const response = await performAction(accessToken, actionId);
      setState((current) => {
        if (current.status !== 'ready') return current;
        return {
          ...current,
          profileData: {
            user: response.user,
            profile: response.profile,
            serverTime: response.serverTime,
            nextEnergyAt: response.nextEnergyAt
          },
          result: response.result,
          pending: null,
          errorMessage: null
        };
      });
    } catch (error) {
      setState((current) => {
        if (current.status !== 'ready') return current;
        return { ...current, pending: null, errorMessage: error instanceof Error ? error.message : 'Не удалось выполнить действие' };
      });
    }
  }

  return { state, bootstrap, chooseArchetype, refreshProfileState, runAction };
}
