import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import '../../styles/field-activity-type-picker.css';

type Props = {
  label?: string;
  value: string;
  cropType?: string | null;
  apiBase: string;
  extraOptions?: string[];
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (label: string) => void;
  onLabelCreated?: (label: string) => void;
};

function filterLabels(labels: string[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return labels;
  return labels.filter((label) => label.toLowerCase().includes(q));
}

export function DiagnosisLabelPicker({
  label = 'Correct Diagnosis',
  value,
  cropType,
  apiBase,
  extraOptions = [],
  required,
  disabled,
  placeholder = 'Search or add diagnosis…',
  onChange,
  onLabelCreated,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [remoteLabels, setRemoteLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allLabels = useMemo(() => {
    const merged = new Set<string>([...remoteLabels, ...extraOptions, value].filter(Boolean));
    return [...merged].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [remoteLabels, extraOptions, value]);

  const filtered = useMemo(() => filterLabels(allLabels, search), [allLabels, search]);
  const trimmedSearch = search.trim();
  const canCreate =
    trimmedSearch.length > 0 &&
    !allLabels.some((item) => item.toLowerCase() === trimmedSearch.toLowerCase());

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams();
          if (cropType?.trim()) params.set('cropType', cropType.trim());
          if (search.trim()) params.set('search', search.trim());
          const q = params.toString();
          const res = await api<{ ok: boolean; labels: string[] }>(
            `${apiBase}/diagnosis-labels${q ? `?${q}` : ''}`
          );
          if (!cancelled) setRemoteLabels(res.labels ?? []);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Could not load diagnosis labels');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, search.trim() ? 180 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, cropType, search, apiBase]);

  async function createLabel(name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; label: string }>(`${apiBase}/diagnosis-labels`, {
        method: 'POST',
        body: JSON.stringify({
          label: name,
          cropType: cropType?.trim().toLowerCase() || null,
        }),
      });
      const created = res.label;
      setRemoteLabels((prev) => [...new Set([...prev, created])]);
      onLabelCreated?.(created);
      onChange(created);
      setSearch('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add diagnosis label');
    } finally {
      setBusy(false);
    }
  }

  function selectLabel(next: string) {
    onChange(next);
    setSearch('');
    setOpen(false);
  }

  return (
    <div className="fatp-root" ref={rootRef}>
      <label className="fatp-label" htmlFor={listId}>
        {label}
        {required ? ' *' : ''}
      </label>
      <button
        id={listId}
        type="button"
        className="fatp-trigger cr-input"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className={`fatp-trigger-text ${value ? '' : 'fatp-trigger-text--placeholder'}`}>
          {value || placeholder}
        </span>
        <span className="fatp-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="fatp-panel" role="listbox">
          <div className="fatp-search-wrap">
            <span className="fatp-search-icon" aria-hidden>
              ⌕
            </span>
            <input
              className="fatp-search"
              type="search"
              value={search}
              placeholder="Search or add new diagnosis…"
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault();
                  void createLabel(trimmedSearch);
                }
              }}
            />
          </div>
          <ul className="fatp-list">
            {loading ? <li className="fatp-empty">Loading…</li> : null}
            {!loading
              ? filtered.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item === value}
                      className={`fatp-option ${item === value ? 'fatp-option--selected' : ''}`}
                      onClick={() => selectLabel(item)}
                    >
                      <span className="fatp-option-name">{item}</span>
                    </button>
                  </li>
                ))
              : null}
            {!loading && filtered.length === 0 && !canCreate ? (
              <li className="fatp-empty">No matching diagnoses.</li>
            ) : null}
          </ul>
          {canCreate ? (
            <button
              type="button"
              className="fatp-create"
              disabled={busy}
              onClick={() => void createLabel(trimmedSearch)}
            >
              {busy ? 'Adding…' : `+ Add "${trimmedSearch}"`}
            </button>
          ) : null}
          {error ? <p className="fatp-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
