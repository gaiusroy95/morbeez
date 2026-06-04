import { useState } from 'react';
import {
  LEAD_QUEUE_COLUMNS,
  VIEW_PRESETS,
  type LeadQueueColumnId,
  type ViewPresetId,
} from './lead-queue-config';

type Props = {
  columnOrder: LeadQueueColumnId[];
  visibleColumns: LeadQueueColumnId[];
  savedViews: { viewName: string; updatedAt: string }[];
  activeViewName: string;
  onToggleColumn: (id: LeadQueueColumnId) => void;
  onReorder: (fromId: LeadQueueColumnId, toId: LeadQueueColumnId) => void;
  onApplyPreset: (preset: ViewPresetId) => void;
  onLoadView: (viewName: string) => void;
  onSaveView: () => void;
  onReset: () => void;
};

export function LeadQueueColumnManager({
  columnOrder,
  visibleColumns,
  savedViews,
  activeViewName,
  onToggleColumn,
  onReorder,
  onApplyPreset,
  onLoadView,
  onSaveView,
  onReset,
}: Props) {
  const [dragId, setDragId] = useState<LeadQueueColumnId | null>(null);

  const colDef = (id: LeadQueueColumnId) => LEAD_QUEUE_COLUMNS.find((c) => c.id === id)!;

  return (
    <div className="tc-lq-column-panel">
      <div className="tc-lq-column-panel-head">
        <strong>Column manager</strong>
        <div className="tc-lq-column-panel-actions">
          <button type="button" className="tc-lq-link-btn" onClick={onSaveView}>
            Save view…
          </button>
          <button type="button" className="tc-lq-link-btn" onClick={onReset}>
            Reset default layout
          </button>
        </div>
      </div>

      <div className="tc-lq-view-row">
        <label className="tc-lq-view-label">
          Saved view
          <select
            className="tc-filter-select"
            value={activeViewName === 'active' ? '' : activeViewName}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onLoadView(v);
            }}
          >
            <option value="">Last session</option>
            {savedViews
              .filter((v) => v.viewName !== 'active')
              .map((v) => (
                <option key={v.viewName} value={v.viewName}>
                  {v.viewName}
                </option>
              ))}
          </select>
        </label>
        <div className="tc-lq-preset-btns">
          {(Object.keys(VIEW_PRESETS) as ViewPresetId[]).map((id) => (
            <button key={id} type="button" className="tc-lq-chip" onClick={() => onApplyPreset(id)}>
              {VIEW_PRESETS[id].label}
            </button>
          ))}
        </div>
      </div>

      <ul className="tc-lq-column-list">
        {columnOrder.map((id) => {
          const col = colDef(id);
          if (!col) return null;
          return (
            <li
              key={id}
              className={`tc-lq-column-item ${dragId === id ? 'tc-lq-column-item--drag' : ''}`}
              draggable
              onDragStart={() => setDragId(id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId && dragId !== id) onReorder(dragId, id);
                setDragId(null);
              }}
            >
              <span className="tc-lq-drag" aria-hidden title="Drag to reorder">
                ☰
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(id)}
                  disabled={id === 'priority' || id === 'farmerName' || id === 'actions'}
                  onChange={() => onToggleColumn(id)}
                />
                {col.label}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
