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

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, options);
}

export async function authenticate(initData: string): Promise<AuthResponse> {
  const response = await apiFetch('/api/v1/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось войти через Telegram');
  }

  return (await response.json()) as AuthResponse;
}

export async function getProfile(accessToken: string): Promise<ProfileResponse> {
  const response = await apiFetch('/api/v1/profile', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось загрузить профиль');
  }

  return (await response.json()) as ProfileResponse;
}

export async function selectArchetype(accessToken: string, archetype: Archetype): Promise<ProfileResponse> {
  const response = await apiFetch('/api/v1/class/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ archetype })
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось выбрать роль');
  }

  return (await response.json()) as ProfileResponse;
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

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось выполнить действие');
  }

  return (await response.json()) as ProfileResponse & { result: ActionResult };
}

export async function listProjects(accessToken: string): Promise<{ projects: Project[] }> {
  const response = await apiFetch('/api/v1/projects', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось загрузить проекты');
  }

  return (await response.json()) as { projects: Project[] };
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

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось вложиться в проект');
  }

  return (await response.json()) as { profile: ProfileResponse['profile']; project: Project; unlocked: boolean; contribution: { id: string } };
}

export async function claimBenefit(
  accessToken: string,
  projectId: string
): Promise<{ profile: ProfileResponse['profile'] }> {
  const response = await apiFetch(`/api/v1/projects/${projectId}/claim-benefit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось забрать бонус');
  }

  return (await response.json()) as { profile: ProfileResponse['profile'] };
}

export async function likeContribution(
  accessToken: string,
  contributionId: string
): Promise<void> {
  const response = await apiFetch(`/api/v1/contributions/${contributionId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось отправить спасибо');
  }
}

export async function getFeed(
  accessToken: string,
  cursor?: string
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const url = cursor ? `/api/v1/feed?cursor=${encodeURIComponent(cursor)}` : '/api/v1/feed';
  const response = await apiFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось загрузить ленту');
  }

  return (await response.json()) as { items: FeedItem[]; nextCursor: string | null };
}

export async function getExamState(accessToken: string): Promise<ExamState> {
  const response = await apiFetch('/api/v1/exam', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось загрузить экзамен');
  }

  return (await response.json()) as ExamState;
}

export async function queueForExam(accessToken: string, capacity: PartyCapacity): Promise<{ party: ExamParty }> {
  const response = await apiFetch('/api/v1/parties/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ capacity })
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось встать в очередь');
  }

  return (await response.json()) as { party: ExamParty };
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

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось обновить готовность');
  }

  return (await response.json()) as { party: ExamParty | null; run: ExamRunResult | null };
}

export async function leaveParty(accessToken: string, partyId: string): Promise<{ party: ExamParty | null }> {
  const response = await apiFetch(`/api/v1/parties/${partyId}/leave`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Не удалось выйти из пати');
  }

  return (await response.json()) as { party: ExamParty | null };
}
