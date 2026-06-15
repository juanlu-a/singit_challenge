import type { VocabStatus } from '@/lib/types';

export function StatusPill({ status }: { status: VocabStatus }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

export function PriorityBar({ score }: { score: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  return (
    <div className="prio">
      <div className="bar">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="cap">priority {score.toFixed(2)}</div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="banner error">⚠ {message}</div>;
}
