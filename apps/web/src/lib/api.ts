import type {
  ActionId,
  ActionResult,
  Archetype,
  ExamParty,
  ExamRunResult,
  ExamState,
  FeedItem,
  PartyCapacity,
  ProfileResponse,
  Project
} from '@sharaga/contracts';

type AuthResponse = {
  accessToken: string;
  user: { id: string; telegramId: number; firstName: string };
};

type ApiError = {
  code?: string;
  message?: string;
};

const API_TIMEOUT_MS = 10_000;
const TEMPORARY_UNAVAILABLE_MESSAGE = 'Сервис временно недоступен. Попробуй еще раз чуть позже.';
const NETWORK_ERROR_MESSAGE = 'Не удалось связаться с сервером. Проверь соединение и попробуй снова.';
const TIMEOUT_ERROR_MESSAGE = 'Сервер отвечает слишком долго. Попробуй еще раз.';

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    throw new Error(NETWORK_ERROR_MESSAGE);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function expectJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(response.status >= 500 ? TEMPORARY_UNAVAILABLE_MESSAGE : error?.message ?? fallbackMessage);
  }

  return (await response.json()) as T;
}

export async function authenticate(initData: string): Promise<AuthResponse> {
  const response = await apiFetch('/api/v1/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });

  return expectJson<AuthResponse>(response, 'Не удалось войти через Telegram');
}

export async function getProfile(accessToken: string): Promise<ProfileResponse> {
  const response = await apiFetch('/api/v1/profile', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return expectJson<ProfileResponse>(response, 'Не удалось загрузить профиль');
}

export async function setWriteAccess(accessToken: string, granted: boolean): Promise<{ writeAccessGranted: boolean }> {
  const response = await apiFetch('/api/v1/notifications/write-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ granted })
  });

  return expectJson<{ writeAccessGranted: boolean }>(response, 'Не удалось сохранить доступ к уведомлениям');
}

export async function selectArchetype(accessToken: string, archetype: Archetype): Promise<ProfileResponse> {
  const response = await apiFetch('/api/v1/class/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ archetype })
  });

  return expectJson<ProfileResponse>(response, 'Не удалось выбрать роль');
}

export async function performAction(
  accessToken: string,
  actionId: ActionId
): Promise<ProfileResponse & { result: ActionResult }> {
  const response = await apiFetch('/api/v1/actions/perform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ actionId })
  });

  return expectJson<ProfileResponse & { result: ActionResult }>(response, 'Не удалось выполнить действие');
}

export async function listProjects(accessToken: string): Promise<{ projects: Project[] }> {
  const response = await apiFetch('/api/v1/projects', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return expectJson<{ projects: Project[] }>(response, 'Не удалось загрузить проекты');
}

export async function contributeToProject(
  accessToken: string,
  projectId: string,
  requestId: string
): Promise<{ profile: ProfileResponse['profile']; project: Project; unlocked: boolean; contribution: { id: string } }> {
  const response = await apiFetch(`/api/v1/projects/${projectId}/contribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ requestId, amount: 1 })
  });

  return expectJson<{ profile: ProfileResponse['profile']; project: Project; unlocked: boolean; contribution: { id: string } }>(
    response,
    'Не удалось вложиться в проект'
  );
}

export async function claimBenefit(
  accessToken: string,
  projectId: string
): Promise<{ profile: ProfileResponse['profile'] }> {
  const response = await apiFetch(`/api/v1/projects/${projectId}/claim-benefit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return expectJson<{ profile: ProfileResponse['profile'] }>(response, 'Не удалось забрать бонус');
}

export async function likeContribution(accessToken: string, contributionId: string): Promise<void> {
  const response = await apiFetch(`/api/v1/contributions/${contributionId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  await expectJson<unknown>(response, 'Не удалось отправить спасибо');
}

export async function getFeed(
  accessToken: string,
  cursor?: string
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const url = cursor ? `/api/v1/feed?cursor=${encodeURIComponent(cursor)}` : '/api/v1/feed';
  const response = await apiFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return expectJson<{ items: FeedItem[]; nextCursor: string | null }>(response, 'Не удалось загрузить ленту');
}

export async function getExamState(accessToken: string): Promise<ExamState> {
  const response = await apiFetch('/api/v1/exam', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return expectJson<ExamState>(response, 'Не удалось загрузить экзамен');
}

export async function queueForExam(accessToken: string, capacity: PartyCapacity): Promise<{ party: ExamParty }> {
  const response = await apiFetch('/api/v1/parties/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ capacity })
  });

  return expectJson<{ party: ExamParty }>(response, 'Не удалось встать в очередь');
}

export async function setPartyReady(
  accessToken: string,
  partyId: string,
  ready: boolean
): Promise<{ party: ExamParty | null; run: ExamRunResult | null }> {
  const response = await apiFetch(`/api/v1/parties/${partyId}/ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ ready })
  });

  return expectJson<{ party: ExamParty | null; run: ExamRunResult | null }>(response, 'Не удалось обновить готовность');
}

export async function leaveParty(accessToken: string, partyId: string): Promise<{ party: ExamParty | null }> {
  const response = await apiFetch(`/api/v1/parties/${partyId}/leave`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return expectJson<{ party: ExamParty | null }>(response, 'Не удалось выйти из пати');
}
