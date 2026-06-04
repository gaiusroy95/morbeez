import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import {
  activityEnumFromCategory,
  type FieldActivityType,
} from './field-activity-utils';
import '../../../styles/field-activity-type-picker.css';

type Props = {
  label?: string;
  types: FieldActivityType[];
  value: string;
  cropType?: string | null;
  apiBase: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (type: FieldActivityType | null) => void;
  onTypeCreated?: (type: FieldActivityType) => void;
};

function filterTypes(types: FieldActivityType[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return types;
  return types.filter((t) => {
    const name = t.activity_name.toLowerCase();
    const category = t.category.toLowerCase();
    const crop = String(t.crop ?? '').toLowerCase();
    return name.includes(q) || category.includes(q) || crop.includes(q);
  });
}

export function FieldActivityTypePicker({
  label = 'Activity Type',
  types,
  value,
  cropType,
  apiBase,
  required,
  disabled,
  placeholder = 'Select activity type…',
  onChange,
  onTypeCreated,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = types.find((t) => t.id === value) ?? null;
  const filtered = useMemo(() => filterTypes(types, search), [types, search]);
  const trimmedSearch = search.trim();
  const canCreate =
    trimmedSearch.length > 0 &&
    !types.some((t) => t.activity_name.toLowerCase() === trimmedSearch.toLowerCase());

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function createType(name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; type: FieldActivityType }>(`${apiBase}/field-activity-types`, {
        method: 'POST',
        body: JSON.stringify({
          activityName: name,
          crop: cropType?.trim().toLowerCase() || null,
        }),
      });
      const created = res.type;
      onTypeCreated?.(created);
      onChange(created);
      setSearch('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create activity type');
    } finally {
      setBusy(false);
    }
  }

  function selectType(type: FieldActivityType) {
    onChange(type);
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
        className="fatp-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`fatp-trigger-text ${selected ? '' : 'fatp-trigger-text--placeholder'}`}>
          {selected ? selected.activity_name : placeholder}
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
              placeholder="Search or add new type…"
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault();
                  void createType(trimmedSearch);
                }
              }}
            />
          </div>
          <ul className="fatp-list">
            {filtered.map((type) => (
              <li key={type.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={type.id === value}
                  className={`fatp-option ${type.id === value ? 'fatp-option--selected' : ''}`}
                  onClick={() => selectType(type)}
                >
                  <span className="fatp-option-name">{type.activity_name}</span>
                  <span className="fatp-option-meta">
                    {type.category}
                    {type.crop ? ` · ${type.crop}` : ' · all crops'}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && !canCreate ? (
              <li className="fatp-empty">No matching activity types.</li>
            ) : null}
          </ul>
          {canCreate ? (
            <button
              type="button"
              className="fatp-create"
              disabled={busy}
              onClick={() => void createType(trimmedSearch)}
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

export function formPatchFromActivityType(
  type: FieldActivityType,
  prev: { followUpRequired: boolean; activityDate: string; followUpDate: string }
) {
  return {
    activityTypeId: type.id,
    activityLabel: type.activity_name,
    activityType: activityEnumFromCategory(type.category),
    followUpDate:
      prev.followUpRequired && type.followup_default_days != null && prev.activityDate
        ? (() => {
            const due = new Date(`${prev.activityDate}T00:00:00.000Z`);
            due.setUTCDate(due.getUTCDate() + type.followup_default_days!);
            return due.toISOString().slice(0, 10);
          })()
        : prev.followUpDate,
  };
}
