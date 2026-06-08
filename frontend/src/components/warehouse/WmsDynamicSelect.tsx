import { useEffect, useId, useMemo, useRef, useState } from 'react';
import '../../styles/dynamic-master-picker.css';

export type WmsSelectOption = {
  key: string;
  label: string;
  value: string;
};

export type WmsSelectField = {
  name: string;
  placeholder: string;
  narrow?: boolean;
};

type Props = {
  label: string;
  placeholder?: string;
  value: string;
  displayValue?: string;
  options: WmsSelectOption[];
  disabled?: boolean;
  loading?: boolean;
  allowManage?: boolean;
  addFields: WmsSelectField[];
  editFields?: WmsSelectField[];
  onSelect: (value: string, option: WmsSelectOption | null) => void;
  onAdd: (fields: Record<string, string>) => Promise<void>;
  onUpdate?: (option: WmsSelectOption, fields: Record<string, string>) => Promise<void>;
  onDelete?: (option: WmsSelectOption) => Promise<void>;
};

function filterOptions(options: WmsSelectOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

function emptyFieldState(fields: WmsSelectField[]) {
  return Object.fromEntries(fields.map((f) => [f.name, '']));
}

export function WmsDynamicSelect({
  label,
  placeholder = 'Select…',
  value,
  displayValue,
  options,
  disabled,
  loading,
  allowManage = true,
  addFields,
  editFields,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const editFieldDefs = editFields ?? addFields;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addValues, setAddValues] = useState(() => emptyFieldState(addFields));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState(() => emptyFieldState(editFieldDefs));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = useMemo(() => filterOptions(options, search), [options, search]);
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );
  const triggerLabel = selected?.label ?? displayValue?.trim() ?? placeholder;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleAdd() {
    if (!allowManage) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(addValues);
      setAddValues(emptyFieldState(addFields));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(option: WmsSelectOption) {
    if (!onUpdate) return;
    setBusy(true);
    setError(null);
    try {
      await onUpdate(option, editValues);
      setEditingKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(option: WmsSelectOption) {
    if (!onDelete) return;
    if (!window.confirm(`Remove "${option.label}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(option);
      if (value === option.value) onSelect('', null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(option: WmsSelectOption) {
    setEditingKey(option.key);
    const next = emptyFieldState(editFieldDefs);
    if (editFieldDefs.length === 1) {
      next[editFieldDefs[0].name] = option.label;
    } else if (editFieldDefs.length >= 2) {
      const parts = option.label.match(/^(.+?)\s*\((.+)\)$/);
      next[editFieldDefs[0].name] = parts?.[1]?.trim() ?? option.label;
      next[editFieldDefs[1].name] = parts?.[2]?.trim() ?? '';
    }
    setEditValues(next);
  }

  const canAdd = addFields.every((f) => addValues[f.name]?.trim());

  return (
    <div
      ref={rootRef}
      className={`dmp-root warehouse-dmp ${open ? 'dmp-root--open' : ''}`.trim()}
    >
      <span className="dmp-label">{label}</span>
      <button
        type="button"
        className="dmp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`dmp-trigger-text ${
            !selected && !displayValue?.trim() ? 'dmp-trigger-text--placeholder' : ''
          }`}
        >
          {loading ? 'Loading…' : triggerLabel}
        </span>
        <span className="dmp-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="dmp-panel" id={listId} role="listbox" aria-label={label}>
          <div className="dmp-search-wrap">
            <span className="dmp-search-icon" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              className="dmp-search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <ul className="dmp-list">
            {filtered.length === 0 ? (
              <li className="dmp-empty">No options match your search.</li>
            ) : (
              filtered.map((option) => {
                const isSelected = value === option.value;
                const editing = editingKey === option.key;
                return (
                  <li
                    key={option.key}
                    className={`dmp-row ${isSelected ? 'dmp-row--selected' : ''}`}
                  >
                    {editing ? (
                      <div className="dmp-edit-row">
                        {editFieldDefs.map((field) => (
                          <input
                            key={field.name}
                            className="dmp-edit-input"
                            placeholder={field.placeholder}
                            value={editValues[field.name] ?? ''}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [field.name]: e.target.value,
                              }))
                            }
                          />
                        ))}
                        <div className="dmp-edit-actions">
                          <button
                            type="button"
                            className="dmp-btn dmp-btn--primary"
                            disabled={busy}
                            onClick={() => void handleSaveEdit(option)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="dmp-btn"
                            disabled={busy}
                            onClick={() => setEditingKey(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="dmp-row-select"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelect(option.value, option);
                            setOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                        {allowManage && !disabled && (onUpdate || onDelete) ? (
                          <span className="dmp-row-actions">
                            {onUpdate ? (
                              <button
                                type="button"
                                className="dmp-icon-btn"
                                title="Edit"
                                aria-label={`Edit ${option.label}`}
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(option);
                                }}
                              >
                                ✎
                              </button>
                            ) : null}
                            {onDelete ? (
                              <button
                                type="button"
                                className="dmp-icon-btn"
                                title="Delete"
                                aria-label={`Delete ${option.label}`}
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(option);
                                }}
                              >
                                🗑
                              </button>
                            ) : null}
                          </span>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {allowManage && !disabled ? (
            <div className="dmp-footer">
              {addFields.map((field) => (
                <input
                  key={field.name}
                  className={`dmp-add-input ${field.narrow ? 'dmp-add-input--district' : ''}`}
                  placeholder={field.placeholder}
                  value={addValues[field.name] ?? ''}
                  onChange={(e) =>
                    setAddValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAdd();
                    }
                  }}
                />
              ))}
              <button
                type="button"
                className="dmp-add-btn"
                disabled={busy || !canAdd}
                onClick={() => void handleAdd()}
              >
                Add
              </button>
            </div>
          ) : null}

          {error ? <p className="dmp-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
