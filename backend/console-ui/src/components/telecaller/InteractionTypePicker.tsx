import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCrmMasters } from '../../lib/useCrmMasters';
import '../../styles/field-activity-type-picker.css';

type MasterItem = { id: string; name: string };

type Props = {
  label?: string;
  value: string;
  onChange: (id: string, name: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  apiBase?: string;
};

function filterItems(items: MasterItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((t) => t.name.toLowerCase().includes(q));
}

export function InteractionTypePicker({
  label = 'Interaction type',
  value,
  onChange,
  required,
  disabled,
  placeholder = 'Search interaction type…',
  apiBase,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { items, loading, createMaster } = useCrmMasters('interaction_type', null, { apiBase });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = items.find((t) => t.id === value) ?? null;
  const filtered = useMemo(() => filterItems(items, search), [items, search]);
  const trimmedSearch = search.trim();
  const canCreate =
    trimmedSearch.length > 0 &&
    !items.some((t) => t.name.toLowerCase() === trimmedSearch.toLowerCase());

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function handleCreate(name: string) {
    setBusy(true);
    setError(null);
    try {
      const item = await createMaster(name.trim());
      onChange(item.id, item.name);
      setSearch('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add type');
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="block text-sm">
      <span className="text-slate-600">
        {label}
        {required ? ' *' : ''}
      </span>
      <div ref={rootRef} className={`fa-type-picker mt-1 ${open ? 'fa-type-picker--open' : ''}`}>
        <button
          type="button"
          className="fa-type-picker-trigger"
          disabled={disabled || loading}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={selected ? '' : 'fa-type-picker-placeholder'}>
            {selected?.name ?? placeholder}
          </span>
          <span className="fa-type-picker-chevron" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <div className="fa-type-picker-panel" role="listbox" id={listId}>
            <input
              className="fa-type-picker-search"
              value={search}
              placeholder="Type to search…"
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="fa-type-picker-list">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`fa-type-picker-option ${t.id === value ? 'fa-type-picker-option--active' : ''}`}
                    onClick={() => {
                      onChange(t.id, t.name);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
              {canCreate ? (
                <li>
                  <button
                    type="button"
                    className="fa-type-picker-create"
                    disabled={busy}
                    onClick={() => void handleCreate(trimmedSearch)}
                  >
                    + Add &quot;{trimmedSearch}&quot;
                  </button>
                </li>
              ) : null}
              {filtered.length === 0 && !canCreate ? (
                <li className="fa-type-picker-empty">No types match</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
