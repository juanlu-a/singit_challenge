'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type {
  AttemptResult,
  Exercise,
  ExerciseOption,
  PracticeSession,
  SessionResults,
} from '@/lib/types';
import { ErrorBanner, StatusPill } from '@/components/ui';

type Phase = 'config' | 'playing' | 'done';

const KICKERS: Record<string, string> = {
  word_meaning: 'Choose the meaning',
  reverse_translation: 'Choose the word',
  word_to_image: 'Choose the image',
};

function PracticeInner() {
  const params = useSearchParams();
  const userId = params.get('user')?.trim() || 'user_001';

  const [phase, setPhase] = useState<Phase>('config');
  const [limit, setLimit] = useState(5);
  const [translationLanguage, setTranslationLanguage] = useState('es');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { choice: string; result: AttemptResult }>>(
    {},
  );
  const [results, setResults] = useState<SessionResults | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const s = await api.createSession(userId, {
        limit,
        sourceLanguage: 'en',
        translationLanguage,
        statuses: ['unknown', 'learning'],
      });
      setSession(s);
      setIndex(0);
      setAnswers({});
      setResults(null);
      setPhase('playing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session');
    } finally {
      setLoading(false);
    }
  }

  async function answer(exercise: Exercise, option: ExerciseOption) {
    if (answers[exercise.exerciseId] || !session) return;
    try {
      const result = await api.submitAttempt(session.sessionId, exercise.exerciseId, option.id);
      setAnswers((a) => ({ ...a, [exercise.exerciseId]: { choice: option.id, result } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit answer');
    }
  }

  async function next() {
    if (!session) return;
    if (index + 1 < session.exercises.length) {
      setIndex((i) => i + 1);
      return;
    }
    // finished — load results
    try {
      const r = await api.getResults(session.sessionId);
      setResults(r);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load results');
    }
  }

  // ---------- config ----------
  if (phase === 'config') {
    return (
      <div className="exercise-shell">
        <h2 className="page-title">Practice session</h2>
        <p className="page-sub">
          Exercises are generated from <b>{userId}</b>’s most relevant words (unknown + learning).
        </p>
        <ErrorBanner message={error} />
        <div className="card">
          <div className="row">
            <div className="field" style={{ width: 120 }}>
              <label htmlFor="limit">How many</label>
              <input
                id="limit"
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ width: 180 }}>
              <label htmlFor="lang">Translate to</label>
              <select
                id="lang"
                value={translationLanguage}
                onChange={(e) => setTranslationLanguage(e.target.value)}
              >
                <option value="es">Spanish (es)</option>
                <option value="pt">Portuguese (pt)</option>
              </select>
            </div>
            <button className="btn primary" onClick={start} disabled={loading}>
              {loading ? 'Building…' : 'Begin →'}
            </button>
          </div>
        </div>
        <p className="muted center" style={{ marginTop: 16, fontSize: 13 }}>
          <Link href="/">← Back to dashboard</Link>
        </p>
      </div>
    );
  }

  // ---------- done ----------
  if (phase === 'done' && results) {
    return (
      <div className="exercise-shell">
        <h2 className="page-title center">Session complete 🎉</h2>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="stat-grid">
            <div className="stat accent">
              <div className="num">
                {results.totalExercises === 0
                  ? '—'
                  : `${Math.round((results.correctCount / results.totalExercises) * 100)}%`}
              </div>
              <div className="label">Score</div>
            </div>
            <div className="stat">
              <div className="num">{results.correctCount}</div>
              <div className="label">Correct</div>
            </div>
            <div className="stat">
              <div className="num">{results.incorrectCount}</div>
              <div className="label">Incorrect</div>
            </div>
          </div>
        </div>

        {results.vocabularyState.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="section-title">Words you practiced</p>
            {results.vocabularyState.map((v) => (
              <div className="word-row" key={v.wordInsightId}>
                <div className="word-head">
                  <span className="term">{v.word}</span>
                  <StatusPill status={v.status} />
                </div>
                <span className="muted" style={{ fontSize: 13 }}>
                  ✓ {v.correctCount} · ✗ {v.incorrectCount}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="row center" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button className="btn primary" onClick={() => setPhase('config')}>
            Practice again
          </button>
          <Link className="btn ghost" href="/">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ---------- playing ----------
  if (!session) return null;

  if (session.exercises.length === 0) {
    return (
      <div className="exercise-shell">
        <div className="card center">
          <p style={{ fontWeight: 700, marginTop: 0 }}>No exercises could be generated.</p>
          <p className="muted">
            The selected words didn’t have enough data (e.g. translations) for the chosen language.
          </p>
          <button className="btn primary" onClick={() => setPhase('config')}>
            Try different settings
          </button>
        </div>
      </div>
    );
  }

  const exercise = session.exercises[index];
  const submitted = answers[exercise.exerciseId];
  const isImage = exercise.type === 'word_to_image';
  const progress = ((index + (submitted ? 1 : 0)) / session.exercises.length) * 100;

  return (
    <div className="exercise-shell">
      <div className="progress">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>

      <ErrorBanner message={error} />

      <div className="card">
        <div className="spread">
          <span className="ex-kicker">{KICKERS[exercise.type] ?? exercise.type}</span>
          <span className="tag">
            {index + 1} / {session.exercises.length}
          </span>
        </div>
        <div className="ex-prompt">{exercise.prompt}</div>

        <div className={`options${isImage ? ' images' : ''}`}>
          {exercise.options.map((opt) => {
            let cls = 'option' + (isImage ? ' image' : '');
            if (submitted) {
              if (opt.id === submitted.result.correctOptionId) cls += ' correct';
              else if (opt.id === submitted.choice) cls += ' wrong';
            }
            return (
              <button
                key={opt.id}
                className={cls}
                disabled={!!submitted}
                onClick={() => answer(exercise, opt)}
              >
                {isImage ? <ExImage url={opt.imageUrl ?? ''} /> : opt.value}
              </button>
            );
          })}
        </div>

        {submitted && (
          <div className={`feedback ${submitted.result.isCorrect ? 'ok' : 'no'}`}>
            <span className="msg">
              {submitted.result.isCorrect ? '✓ Correct!' : '✗ Not quite'}
            </span>
            {submitted.result.newStatus && (
              <span className="status-change">
                {submitted.result.previousStatus} → <b>{submitted.result.newStatus}</b>
              </span>
            )}
            <button className="btn primary sm" onClick={next}>
              {index + 1 < session.exercises.length ? 'Next →' : 'See results'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Image option with a graceful fallback (seed URLs are placeholders). */
function ExImage({ url }: { url: string }) {
  const [src, setSrc] = useState(url);
  return (
    <img
      src={src}
      alt=""
      onError={() => setSrc(`https://picsum.photos/seed/${encodeURIComponent(url)}/300/200`)}
    />
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="skeleton">Loading…</div>}>
      <PracticeInner />
    </Suspense>
  );
}
