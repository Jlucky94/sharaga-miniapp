import type {
  ActionId,
  ActionResult,
  Archetype,
  FeedItem,
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
    throw new Error(error?.message ?? 'Unable to authenticate with Telegram');
  }

  return (await response.json()) as AuthResponse;
}

export async function getProfile(accessToken: string): Promise<ProfileResponse> {
  const response = await apiFetch('/api/v1/profile', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Unable to load profile');
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
    throw new Error(error?.message ?? 'Unable to select archetype');
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
    throw new Error(error?.message ?? 'Unable to perform action');
  }

  return (await response.json()) as ProfileResponse & { result: ActionResult };
}

export async function listProjects(accessToken: string): Promise<{ projects: Project[] }> {
  const response = await apiFetch('/api/v1/projects', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const error = (await readJson(response)) as ApiError | null;
    throw new Error(error?.message ?? 'Unable to load projects');
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
    throw new Error(error?.message ?? 'Unable to contribute to project');
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
    throw new Error(error?.message ?? 'Unable to claim benefit');
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
    throw new Error(error?.message ?? 'Unable to like contribution');
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
    throw new Error(error?.message ?? 'Unable to load feed');
  }

  return (await response.json()) as { items: FeedItem[]; nextCursor: string | null };
}
