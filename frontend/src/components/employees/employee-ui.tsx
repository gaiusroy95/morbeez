import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Badge } from '../ui';

export function perfBadgeTone(
  label: string
): 'success' | 'warn' | 'info' | 'neutral' {
  if (label === 'Excellent' || label === 'Very Good') return 'success';
  if (label === 'Good') return 'info';
  if (label === 'Average') return 'warn';
  return 'neutral';
}

export function PerfBadge({ label, score }: { label: string; score?: number }) {
  return (
    <Badge tone={perfBadgeTone(label)}>
      {score != null ? `${score} · ${label}` : label}
    </Badge>
  );
}

export function OnlineStatus({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-secondary">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          online ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]' : 'bg-border-strong'
        )}
        aria-hidden
      />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

export function ProgressRing({
  pct,
  label,
  display,
}: {
  pct: number;
  label: string;
  display: string;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 88 88" className="h-[88px] w-[88px]">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#eaefeb" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="#3aad62"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text
          x="44"
          y="48"
          textAnchor="middle"
          className="fill-ink text-[13px] font-bold"
        >
          {display}
        </text>
      </svg>
      <div className="text-center text-xs font-semibold text-ink-muted">{label}</div>
    </div>
  );
}

export function MiniStatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
    </article>
  );
}

export function PerformanceBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mb-3 flex items-center gap-3 last:mb-0">
      <span className="w-28 shrink-0 text-sm text-ink-secondary">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-bold text-ink">{pct}%</span>
    </div>
  );
}

export function ListItemRow({
  title,
  subtitle,
  trailing,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="font-semibold text-ink">{title}</div>
        {subtitle ? <div className="mt-0.5 text-sm text-ink-muted">{subtitle}</div> : null}
      </div>
      {trailing ? <div className="shrink-0 text-sm text-ink-muted">{trailing}</div> : null}
    </div>
  );
}

const KPI_ICON_TONES = {
  green: 'bg-brand-50 text-brand-600',
  blue: 'bg-sky-50 text-sky-600',
  teal: 'bg-teal-50 text-teal-600',
  purple: 'bg-violet-50 text-violet-600',
  orange: 'bg-amber-50 text-amber-600',
} as const;

export function EmployeeKpiCard({
  label,
  value,
  sub,
  icon,
  iconTone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  iconTone?: keyof typeof KPI_ICON_TONES;
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        {icon && iconTone ? (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]',
              KPI_ICON_TONES[iconTone]
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {sub ? <p className="mt-1.5 text-xs text-ink-muted">{sub}</p> : null}
    </article>
  );
}

export function FilterableStatCard({
  label,
  value,
  sub,
  active,
  onClick,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  valueClassName?: string;
}) {
  const className = cn(
    'rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated p-4 text-left shadow-[var(--shadow-card)] transition sm:p-5',
    active && 'ring-2 ring-brand-500 ring-offset-1',
    onClick && 'w-full cursor-pointer hover:border-brand-200 hover:shadow-md'
  );
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tracking-tight text-ink', valueClassName)}>{value}</p>
      {sub ? <p className="mt-1.5 text-xs text-ink-muted">{sub}</p> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <article className={className}>{body}</article>;
}
