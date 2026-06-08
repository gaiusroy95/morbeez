import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSuperAdminConfirm } from '../../hooks/useSuperAdminConfirm';
import { cn } from '../../lib/cn';
import '../../styles/dynamic-master-picker.css';

export type DynamicSelectOption = {
  key: string;
  label: string;
  value: string;
};

export type DynamicSelectField = {
  name: string;
  placeholder: string;
  narrow?: boolean;
};

type Props = {
  label?: string;
  placeholder?: string;
  value: string;
  displayValue?: string;
  options: DynamicSelectOption[];
  disabled?: boolean;
  loading?: boolean;
  allowManage?: boolean;
  addFields?: DynamicSelectField[];
  editFields?: DynamicSelectField[];
  className?: string;
  compact?: boolean;
  onChange: (value: string, option: DynamicSelectOption | null) => void;
  onAdd?: (fields: Record<string, string>) => Promise<void>;
  onUpdate?: (
    option: DynamicSelectOption,
    fields: Record<string, string>,
    confirmPassword: string
  ) => Promise<void>;
  onDelete?: (option: DynamicSelectOption, confirmPassword: string) => Promise<void>;
};

function filterOptions(options: DynamicSelectOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

function emptyFieldState(fields: DynamicSelectField[]) {
  return Object.fromEntries(fields.map((f) => [f.name, '']));
}

export function DynamicSelect({
  label,
  placeholder = 'Select…',
  value,
  displayValue,
  options,
  disabled,
  loading,
  allowManage = false,
  addFields = [{ name: 'label', placeholder: 'Name' }],
  editFields,
  className,
  compact,
  onChange,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const { canEditDelete, requestConfirm, confirmModal } = useSuperAdminConfirm();
  const canAdd = allowManage && !disabled && !!onAdd;
  const canMutate = canEditDelete && !disabled;
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
    if (!onAdd) return;
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

  function handleSaveEdit(option: DynamicSelectOption) {
    if (!onUpdate || !canMutate) return;
    requestConfirm('edit', option.label, async (confirmPassword) => {
      setBusy(true);
      setError(null);
      try {
        await onUpdate(option, editValues, confirmPassword);
        setEditingKey(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update');
        throw err;
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete(option: DynamicSelectOption) {
    if (!onDelete || !canMutate) return;
    requestConfirm('delete', option.label, async (confirmPassword) => {
      setBusy(true);
      setError(null);
      try {
        await onDelete(option, confirmPassword);
        if (value === option.value) onChange('', null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete');
        throw err;
      } finally {
        setBusy(false);
      }
    });
  }

  function startEdit(option: DynamicSelectOption) {
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

  const addFieldsReady = addFields.every((f) => addValues[f.name]?.trim());

  return (
    <>
    <div
      ref={rootRef}
      className={`dmp-root ${compact ? 'dmp-root--compact' : ''} ${open ? 'dmp-root--open' : ''} ${className ?? ''}`.trim()}
    >
      {label ? <span className="dmp-label">{label}</span> : null}
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
        <div className="dmp-panel" id={listId} role="listbox" aria-label={label ?? 'Options'}>
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
                            onChange(option.value, option);
                            setOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                        {canMutate && (onUpdate || onDelete) ? (
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

          {canAdd ? (
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
                disabled={busy || !addFieldsReady}
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
    {confirmModal}
    </>
  );
}

/**
 * Native &lt;select&gt; for fixed option lists (status filters, page size, enums).
 * Use this instead of SearchSelect when options are static and do not need search UI.
 */
export function StaticSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  compact,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn('dmp-root', compact && 'dmp-root--compact', className)}>
      {label ? (
        <label htmlFor={id} className="dmp-label">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        className={cn('dmp-native-select', compact && 'dmp-native-select--compact')}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder ? (
          <option value="" disabled={value !== ''}>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value || '__empty'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Searchable dropdown — use only for long lists (products, farmers, catalog). */
export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  compact,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const mapped = useMemo(
    () => options.map((o) => ({ key: o.value, value: o.value, label: o.label })),
    [options]
  );
  return (
    <DynamicSelect
      label={label}
      placeholder={placeholder}
      value={value}
      options={mapped}
      disabled={disabled}
      className={className}
      compact={compact}
      onChange={(v) => onChange(v)}
    />
  );
}
