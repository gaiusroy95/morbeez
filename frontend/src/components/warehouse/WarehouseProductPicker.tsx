import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSuperAdminConfirm } from '../../hooks/useSuperAdminConfirm';
import { api } from '../../lib/api';
import { WMS_API } from './warehouse-api';
import '../../styles/dynamic-master-picker.css';

export type WarehouseInventoryItem = {
  inventoryItemId: string;
  sku: string;
  productTitle: string;
};

type ApiItem = { id: string; sku: string; productTitle: string };

function toRow(item: ApiItem): WarehouseInventoryItem {
  return {
    inventoryItemId: item.id,
    sku: item.sku,
    productTitle: item.productTitle,
  };
}

function labelFor(item: WarehouseInventoryItem): string {
  return `${item.productTitle} (${item.sku})`;
}

function filterItems(items: WarehouseInventoryItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.productTitle.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)
  );
}

type Props = {
  value: string;
  onChange: (inventoryItemId: string, item: WarehouseInventoryItem | null) => void;
  items: WarehouseInventoryItem[];
  onItemsChange: (items: WarehouseInventoryItem[]) => void;
  disabled?: boolean;
  allowManage?: boolean;
  compact?: boolean;
  placeholder?: string;
};

export function WarehouseProductPicker({
  value,
  onChange,
  items,
  onItemsChange,
  disabled,
  allowManage = true,
  compact = false,
  placeholder = 'Select…',
}: Props) {
  const { canEditDelete, requestConfirm, confirmModal } = useSuperAdminConfirm();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSku, setNewSku] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSku, setEditSku] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = useMemo(() => filterItems(items, search), [items, search]);
  const selected = useMemo(
    () => items.find((item) => item.inventoryItemId === value) ?? null,
    [items, value]
  );

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

  function emit(item: WarehouseInventoryItem | null) {
    onChange(item?.inventoryItemId ?? '', item);
  }

  async function handleAdd() {
    const title = newTitle.trim();
    const sku = newSku.trim();
    if (!title || !sku || !allowManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; item: { id: string; sku: string; product_title: string } }>(
        `${WMS_API}/inventory-items`,
        {
          method: 'POST',
          body: JSON.stringify({ sku, productTitle: title }),
        }
      );
      const row = toRow({
        id: res.item.id,
        sku: res.item.sku,
        productTitle: res.item.product_title,
      });
      onItemsChange([...items, row]);
      setNewTitle('');
      setNewSku('');
      emit(row);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add product');
    } finally {
      setBusy(false);
    }
  }

  function handleSaveEdit(id: string, itemLabel: string) {
    const title = editTitle.trim();
    const sku = editSku.trim();
    if (!title || !sku || !canEditDelete) return;
    requestConfirm('edit', itemLabel, async (confirmPassword) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api<{ ok: boolean; item: ApiItem }>(`${WMS_API}/inventory-items/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ sku, productTitle: title, confirmPassword }),
        });
        const row = toRow(res.item);
        onItemsChange(items.map((item) => (item.inventoryItemId === id ? row : item)));
        setEditingId(null);
        if (value === id) emit(row);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update product');
        throw err;
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete(id: string, itemLabel: string) {
    if (!allowManage || !canEditDelete) return;
    requestConfirm('delete', itemLabel, async (confirmPassword) => {
      setBusy(true);
      setError(null);
      try {
        await api(`${WMS_API}/inventory-items/${id}`, {
          method: 'DELETE',
          body: JSON.stringify({ confirmPassword }),
        });
        onItemsChange(items.filter((item) => item.inventoryItemId !== id));
        if (value === id) emit(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete product');
        throw err;
      } finally {
        setBusy(false);
      }
    });
  }

  function startEdit(item: WarehouseInventoryItem) {
    setEditingId(item.inventoryItemId);
    setEditTitle(item.productTitle);
    setEditSku(item.sku);
  }

  return (
    <>
    <div
      ref={rootRef}
      className={`dmp-root ${open ? 'dmp-root--open' : ''} ${compact ? 'dmp-root--compact' : ''}`.trim()}
    >
      {!compact ? <span className="dmp-label">Product</span> : null}
      <button
        type="button"
        className="dmp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`dmp-trigger-text ${!selected ? 'dmp-trigger-text--placeholder' : ''}`}
        >
          {selected ? labelFor(selected) : placeholder}
        </span>
        <span className="dmp-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          className="dmp-panel dmp-panel--table"
          id={listId}
          role="listbox"
          aria-label="Product"
        >
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
              <li className="dmp-empty">No products match your search.</li>
            ) : (
              filtered.map((item) => {
                const isSelected = value === item.inventoryItemId;
                const editing = editingId === item.inventoryItemId;
                return (
                  <li
                    key={item.inventoryItemId}
                    className={`dmp-row ${isSelected ? 'dmp-row--selected' : ''}`}
                  >
                    {editing ? (
                      <div className="dmp-edit-row">
                        <input
                          className="dmp-edit-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Product title"
                        />
                        <input
                          className="dmp-edit-input"
                          value={editSku}
                          onChange={(e) => setEditSku(e.target.value)}
                          placeholder="SKU"
                        />
                        <div className="dmp-edit-actions">
                          <button
                            type="button"
                            className="dmp-btn dmp-btn--primary"
                            disabled={busy}
                            onClick={() => handleSaveEdit(item.inventoryItemId, labelFor(item))}
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
                          aria-selected={isSelected}
                          onClick={() => {
                            emit(item);
                            setOpen(false);
                          }}
                        >
                          {labelFor(item)}
                        </button>
                        {allowManage && canEditDelete && !disabled ? (
                          <span className="dmp-row-actions">
                            <button
                              type="button"
                              className="dmp-icon-btn"
                              title="Edit"
                              aria-label={`Edit ${item.productTitle}`}
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
                              aria-label={`Delete ${item.productTitle}`}
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.inventoryItemId, labelFor(item));
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

          {allowManage && !disabled ? (
            <div className="dmp-footer">
              <input
                className="dmp-add-input"
                placeholder="Product title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
              <input
                className="dmp-add-input dmp-add-input--district"
                placeholder="SKU"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
              />
              <button
                type="button"
                className="dmp-add-btn"
                disabled={busy || !newTitle.trim() || !newSku.trim()}
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
