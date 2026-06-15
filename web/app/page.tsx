'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { InsightSummary, UserWordInsight, VocabStatus } from '@/lib/types';
import { ErrorBanner, PriorityBar, StatusPill } from '@/components/ui';

const STATUSES: VocabStatus[] = ['unknown', 'learning', 'known', 'ignored'];

export default function DashboardPage() {
  const [userId, setUserId] = useState('user_001');
  const [draftUser, setDraftUser] = useState('user_001');
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [words, setWords] = useState<UserWordInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [s, w] = await Promise.all([
        api.getSummary(uid),
        api.getUserWordInsights(uid, { limit: 100 }),
      ]);
      setSummary(s);
      setWords(w.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load. Is the API running on :3000?');
      setSummary(null);
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(userId);
  }, [userId, load]);

  async function changeStatus(wordInsightId: string, status: VocabStatus) {
    try {
      await api.updateVocabulary(userId, wordInsightId, status);
      await load(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 22 }}>
        <div>
          <h2 className="page-title">Your vocabulary</h2>
          <p className="page-sub">
            Words pulled from songs, ranked by what’s most useful to practice next.
          </p>
        </div>
        <Link className="btn primary" href={`/practice?user=${encodeURIComponent(userId)}`}>
          Start practice →
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            setUserId(draftUser.trim() || 'user_001');
          }}
        >
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="user">User</label>
            <input
              id="user"
              value={draftUser}
              onChange={(e) => setDraftUser(e.target.value)}
              placeholder="user_001"
            />
          </div>
          <button className="btn ghost" type="submit">
            Load
          </button>
        </form>
      </div>

      <ErrorBanner message={error} />

      {summary && (
        <div className="card" style={{ marginBottom: 18 }}>
          <p className="section-title">Summary</p>
          <div className="stat-grid">
            <div className="stat accent">
              <div className="num">
                {summary.attemptStats.accuracy === null
                  ? '—'
                  : `${Math.round(summary.attemptStats.accuracy * 100)}%`}
              </div>
              <div className="label">Accuracy ({summary.attemptStats.totalAttempts} attempts)</div>
            </div>
            <div className="stat">
              <div className="num">{summary.byStatus.known}</div>
              <div className="label">Known</div>
            </div>
            <div className="stat">
              <div className="num">{summary.byStatus.learning}</div>
              <div className="label">Learning</div>
            </div>
            <div className="stat">
              <div className="num">{summary.byStatus.unknown}</div>
              <div className="label">Unknown</div>
            </div>
            <div className="stat">
              <div className="num">{summary.totalInsights}</div>
              <div className="label">Total words</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="spread" style={{ marginBottom: 6 }}>
          <p className="section-title" style={{ margin: 0 }}>
            Words by priority
          </p>
          <span className="tag">{words.length} shown</span>
        </div>

        {loading ? (
          <div className="skeleton">Loading…</div>
        ) : words.length === 0 && !error ? (
          <div className="skeleton">No words yet. Try importing or seeding insights.</div>
        ) : (
          words.map((w) => (
            <div className="word-row" key={w.wordInsightId}>
              <div className="word-main">
                <div className="word-head">
                  <span className="term">{w.word}</span>
                  <span className="trans">
                    {w.translations.map((t) => `${t.text}`).join(' · ') || '—'}
                  </span>
                  <StatusPill status={w.status} />
                </div>
                <div className="word-reason">{w.recommendationReason}</div>
              </div>
              <div className="word-side">
                <PriorityBar score={w.priorityScore} />
                <select
                  className="tag"
                  value={w.status}
                  onChange={(e) => changeStatus(w.wordInsightId, e.target.value as VocabStatus)}
                  style={{ cursor: 'pointer', padding: '4px 8px' }}
                  aria-label={`status for ${w.word}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
