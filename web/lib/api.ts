import type {
  AttemptResult,
  ExerciseType,
  InsightSummary,
  Paginated,
  PracticeSession,
  SessionResults,
  UserWordInsight,
  VocabStatus,
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status} — ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface CreateSessionInput {
  limit?: number;
  sourceLanguage?: string;
  translationLanguage?: string;
  statuses?: VocabStatus[];
  exerciseTypes?: ExerciseType[];
}

export const api = {
  baseUrl: BASE_URL,

  getUserWordInsights(userId: string, params: { status?: VocabStatus; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    q.set('limit', String(params.limit ?? 100));
    return request<Paginated<UserWordInsight>>(`/users/${userId}/word-insights?${q.toString()}`);
  },

  getSummary(userId: string) {
    return request<InsightSummary>(`/users/${userId}/insight-summary`);
  },

  updateVocabulary(userId: string, wordInsightId: string, status: VocabStatus) {
    return request(`/users/${userId}/vocabulary/${wordInsightId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  createSession(userId: string, input: CreateSessionInput) {
    return request<PracticeSession>(`/users/${userId}/practice-sessions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  submitAttempt(sessionId: string, exerciseId: string, answer: string) {
    return request<AttemptResult>(
      `/practice-sessions/${sessionId}/exercises/${exerciseId}/attempts`,
      { method: 'POST', body: JSON.stringify({ answer }) },
    );
  },

  getResults(sessionId: string) {
    return request<SessionResults>(`/practice-sessions/${sessionId}/results`);
  },
};
