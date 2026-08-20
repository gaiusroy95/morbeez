import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function StatGrid({
  children,
  className,
  compact,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:gap-4',
        compact
          ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function EntityHeader({
  initials,
  title,
  badges,
  subtitle,
  meta,
  actions,
  back,
  sticky,
  className,
}: {
  initials?: string;
  title: ReactNode;
  badges?: ReactNode;
  subtitle?: ReactNode;
  meta?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
  back?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-b border-border/70 bg-surface-elevated',
        sticky && 'sticky top-0 z-20',
        className
      )}
    >
      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        {back ? <div>{back}</div> : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            {initials ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white sm:h-14 sm:w-14 sm:text-lg">
                {initials}
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
                {badges}
              </div>
              {subtitle ? <div className="mt-1 text-sm text-ink-muted">{subtitle}</div> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {meta && meta.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-4 sm:grid-cols-3 lg:grid-cols-6">
            {meta.map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{item.label}</p>
                <div className="mt-0.5 truncate text-sm font-medium text-ink">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  tabs,
  activeTab,
  onTabChange,
  widthClassName = 'w-full max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tabs?: ReadonlyArray<{ id: string; label: string }>;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  widthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-surface-elevated shadow-[var(--shadow-elevated)]',
          widthClassName
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-xs text-ink-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-subtle hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        {tabs && activeTab && onTabChange ? (
          <div className="flex gap-1 overflow-x-auto border-b border-border px-4 pt-1">
            {tabs.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    'relative shrink-0 px-3 py-2.5 text-xs font-semibold transition',
                    isActive
                      ? 'text-brand-700 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500'
                      : 'text-ink-muted hover:text-ink-secondary'
                  )}
                  onClick={() => onTabChange(t.id)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <footer className="border-t border-border/70 bg-surface-subtle/50 px-4 py-3">{footer}</footer>
        ) : null}
      </aside>
    </>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated shadow-[var(--shadow-card)]',
        className
      )}
    >
      <header className="border-b border-border/60 bg-surface-subtle/40 px-4 py-3 sm:px-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export type PendingUpload = {
  file: File;
  previewUrl?: string;
};

export function FileDropzone({
  accept,
  label,
  hint,
  value,
  onChange,
  imagePreview,
  disabled,
  className,
}: {
  accept: string;
  label: string;
  hint?: string;
  value: PendingUpload | null;
  onChange: (file: PendingUpload | null) => void;
  imagePreview?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    };
  }, [value?.previewUrl]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange({
      file,
      previewUrl:
        imagePreview && file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    });
  }

  function clear() {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={handleSelect}
      />
      {value?.previewUrl ? (
        <div
          className={cn(
            'relative overflow-hidden rounded-[var(--radius-control)] border border-border',
            className ?? 'h-28 w-28'
          )}
        >
          <img src={value.previewUrl} alt="Upload preview" className="h-full w-full object-cover" />
          <button
            type="button"
            className="absolute right-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 text-xs text-white"
            onClick={clear}
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      ) : value ? (
        <div
          className={cn(
            'flex items-center justify-between rounded-[var(--radius-control)] border border-border bg-surface-subtle px-3 py-2 text-sm',
            className ?? 'h-20'
          )}
        >
          <span className="truncate text-ink">{value.file.name}</span>
          <button
            type="button"
            className="ml-2 shrink-0 text-xs font-medium text-brand-600 hover:underline"
            onClick={clear}
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full items-center justify-center rounded-[var(--radius-control)] border-2 border-dashed border-border bg-surface-subtle text-sm text-ink-muted transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60',
            className ?? 'h-20'
          )}
        >
          {label}
          {hint ? <span className="ml-2 hidden text-xs sm:inline">{hint}</span> : null}
        </button>
      )}
    </div>
  );
}

export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-secondary">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export function FormRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
      )}
    >
      {children}
    </div>
  );
}
