import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCrmMasters } from '../lib/useCrmMasters';
import {
  itemMatchesCropSlug,
  itemMatchesMarketKey,
  labelFromMasterItem,
  marketKeyFromItem,
  parseMarketKey,
  type MasterPickerItem,
} from '../lib/master-picker-utils';
import '../styles/dynamic-master-picker.css';

export type DynamicMasterPickerType = 'crop' | 'market' | 'pest' | 'disease';

function addFieldPlaceholder(masterType: DynamicMasterPickerType): string {
  if (masterType === 'market') return 'Market name';
  if (masterType === 'crop') return 'Crop name';
  if (masterType === 'pest') return 'Pest name';
  return 'Disease name';
}

type BaseProps = {
  masterType: DynamicMasterPickerType;
  label: string;
  allowManage?: boolean;
  apiBase?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  /** When masterType is crop, `value` may be a crop slug (e.g. ginger) instead of master id. */
  cropValueSlug?: boolean;
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string;
  /** Shown when `value` id is not in the loaded list (e.g. legacy saved label). */
  displayValue?: string;
  onChange: (id: string, item: MasterPickerItem | null) => void;
  /** When masterType is market, also emit legacy market key `name|district`. */
  onMarketKeyChange?: (marketKey: string, item: MasterPickerItem | null) => void;
};

type MultiProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (marketKeys: string[]) => void;
};

export type DynamicMasterPickerProps = SingleProps | MultiProps;

function filterItems(items: MasterPickerItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const label = labelFromMasterItem(item).toLowerCase();
    return label.includes(q) || item.name.toLowerCase().includes(q);
  });
}

export function DynamicMasterPicker(props: DynamicMasterPickerProps) {
  const {
    masterType,
    label,
    allowManage = true,
    apiBase,
    placeholder = 'Select…',
    required,
    className,
    disabled,
    cropValueSlug = false,
  } = props;

  const { items, loading, createMaster, updateMaster, deleteMaster } = useCrmMasters(
    masterType,
    null,
    { apiBase }
  );

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = useMemo(() => filterItems(items, search), [items, search]);

  const selectedItems = useMemo(() => {
    if (props.multiple) {
      return items.filter((item) => props.value.some((key) => itemMatchesMarketKey(item, key)));
    }
    if (!props.value) return [];
    if (masterType === 'crop' && cropValueSlug && props.value) {
      const bySlug = items.find((item) => itemMatchesCropSlug(item, props.value));
      return bySlug ? [bySlug] : [];
    }
    const byId = items.find((item) => item.id === props.value);
    if (byId) return [byId];
    if (masterType === 'market' && props.value) {
      return items.filter((item) => itemMatchesMarketKey(item, props.value));
    }
    return [];
  }, [items, props]);

  const triggerLabel = useMemo(() => {
    if (props.multiple) {
      if (!props.value.length) return placeholder;
      if (selectedItems.length) {
        return selectedItems.map((item) => labelFromMasterItem(item)).join(', ');
      }
      return `${props.value.length} selected`;
    }
    if (selectedItems[0]) return labelFromMasterItem(selectedItems[0]);
    if (!props.multiple && props.displayValue?.trim()) return props.displayValue.trim();
    return placeholder;
  }, [props, placeholder, selectedItems]);

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

  function emitSingle(item: MasterPickerItem | null) {
    if (props.multiple) return;
    const id = item?.id ?? '';
    props.onChange(id, item);
    if (masterType === 'market' && props.onMarketKeyChange) {
      props.onMarketKeyChange(item ? marketKeyFromItem(item) : '', item);
    }
  }

  function toggleMulti(item: MasterPickerItem) {
    if (!props.multiple) return;
    const key = marketKeyFromItem(item);
    const next = props.value.includes(key)
      ? props.value.filter((k) => k !== key)
      : [...props.value, key];
    props.onChange(next);
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name || !allowManage) return;
    setBusy(true);
    setError(null);
    try {
      const item = await createMaster({
        name,
        category: masterType === 'market' ? newDistrict.trim() || undefined : undefined,
      });
      setNewName('');
      setNewDistrict('');
      if (props.multiple) {
        toggleMulti(item);
      } else {
        emitSingle(item);
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add option');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const item = await updateMaster(id, {
        name,
        category: masterType === 'market' ? editDistrict.trim() || undefined : undefined,
      });
      setEditingId(null);
      if (!props.multiple && props.value === id) emitSingle(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update option');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!allowManage) return;
    if (!window.confirm('Remove this option? It will be hidden from future selections.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMaster(id);
      if (!props.multiple && props.value === id) emitSingle(null);
      if (props.multiple) {
        const removed = items.find((item) => item.id === id);
        if (removed) {
          const key = marketKeyFromItem(removed);
          props.onChange(props.value.filter((k) => k !== key));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete option');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: MasterPickerItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDistrict(item.category?.trim() ?? '');
  }

  function isSelected(item: MasterPickerItem) {
    if (props.multiple) return props.value.some((key) => itemMatchesMarketKey(item, key));
    if (props.value === item.id) return true;
    if (masterType === 'crop' && cropValueSlug && props.value) return itemMatchesCropSlug(item, props.value);
    if (masterType === 'market' && props.value) return itemMatchesMarketKey(item, props.value);
    return false;
  }

  function selectRow(item: MasterPickerItem) {
    if (props.multiple) {
      toggleMulti(item);
      return;
    }
    emitSingle(item);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`dmp-root ${open ? 'dmp-root--open' : ''} ${className ?? ''}`.trim()}
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
            !selectedItems.length &&
            !props.multiple &&
            !(props.multiple === false && props.displayValue?.trim())
              ? 'dmp-trigger-text--placeholder'
              : ''
          }`}
        >
          {loading ? 'Loading…' : triggerLabel}
        </span>
        <span className="dmp-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="dmp-panel" id={listId} role="listbox" aria-label={label} aria-multiselectable={!!props.multiple}>
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
              filtered.map((item) => {
                const selected = isSelected(item);
                const editing = editingId === item.id;
                return (
                  <li key={item.id} className={`dmp-row ${selected ? 'dmp-row--selected' : ''}`}>
                    {editing ? (
                      <div className="dmp-edit-row">
                        <input
                          className="dmp-edit-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                        />
                        {masterType === 'market' ? (
                          <input
                            className="dmp-edit-input"
                            value={editDistrict}
                            onChange={(e) => setEditDistrict(e.target.value)}
                            placeholder="District (optional)"
                          />
                        ) : null}
                        <div className="dmp-edit-actions">
                          <button
                            type="button"
                            className="dmp-btn dmp-btn--primary"
                            disabled={busy}
                            onClick={() => void handleSaveEdit(item.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="dmp-btn"
                            disabled={busy}
                            onClick={() => setEditingId(null)}
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
                          aria-selected={selected}
                          onClick={() => selectRow(item)}
                        >
                          {props.multiple ? (
                            <span className={`dmp-check ${selected ? 'dmp-check--on' : ''}`} aria-hidden />
                          ) : null}
                          {labelFromMasterItem(item)}
                        </button>
                        {allowManage ? (
                          <span className="dmp-row-actions">
                            <button
                              type="button"
                              className="dmp-icon-btn"
                              title="Edit"
                              aria-label={`Edit ${item.name}`}
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(item);
                              }}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="dmp-icon-btn"
                              title="Delete"
                              aria-label={`Delete ${item.name}`}
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(item.id);
                              }}
                            >
                              🗑
                            </button>
                          </span>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {allowManage ? (
            <div className="dmp-footer">
              <input
                className="dmp-add-input"
                placeholder={addFieldPlaceholder(masterType)}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
              {masterType === 'market' ? (
                <input
                  className="dmp-add-input dmp-add-input--district"
                  placeholder="District"
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                />
              ) : null}
              <button
                type="button"
                className="dmp-add-btn"
                disabled={busy || !newName.trim()}
                onClick={() => void handleAdd()}
              >
                Add
              </button>
            </div>
          ) : null}

          {error ? <p className="dmp-error">{error}</p> : null}
          {required && !props.multiple && !props.value ? (
            <p className="dmp-hint">Selection required</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Resolve a market key to display label using loaded items (fallback to parsed key). */
export function marketKeyLabel(key: string, items: MasterPickerItem[]): string {
  const match = items.find((item) => itemMatchesMarketKey(item, key));
  if (match) return labelFromMasterItem(match);
  const { marketName, district } = parseMarketKey(key);
  return district ? `${marketName} (${district})` : marketName;
}
