import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Props = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function PageLoader({ label = 'Loading…', className, compact }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-10' : 'min-h-[280px] py-16',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-400/25" />
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
      </div>
      <p className="mt-4 text-sm font-medium text-ink-secondary">{label}</p>
      <p className="mt-1 max-w-xs text-xs text-ink-muted">Please wait while we fetch the latest data</p>
    </div>
  );
}

export function PageShell({
  loading,
  error,
  children,
  loadingLabel,
  className,
  description,
  actions,
}: {
  loading?: boolean;
  error?: string | null;
  children?: ReactNode;
  loadingLabel?: string;
  className?: string;
  description?: string;
  actions?: ReactNode;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated shadow-[var(--shadow-card)]',
          className
        )}
      >
        <PageLoader label={loadingLabel} />
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="rounded-[var(--radius-control)] border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }
  return (
    <div className={cn('space-y-5 sm:space-y-6', className)}>
      {description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {description ? <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">{description}</p> : <span />}
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
