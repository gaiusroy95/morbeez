import { useState, type FormEvent } from 'react';
import { AddFieldActivityModal } from './AddFieldActivityModal';
import {
  colorClassForTag,
  computeDapFromDates,
  formatDateLabel,
  fieldActivityAddedFromLabel,
  iconForActivityType,
  type FieldActivity,
  type FieldActivityBlock,
  type FieldActivityForm,
  type FieldActivityType,
} from './field-activity-utils';
import '../../../styles/field-activities.css';

type Props = {
  canWrite: boolean;
  apiBase: string;
  blocks: FieldActivityBlock[];
  selectedBlockId: string;
  activities: FieldActivity[];
  activityTypes: FieldActivityType[];
  form: FieldActivityForm;
  onFormChange: (
    value: FieldActivityForm | ((prev: FieldActivityForm) => FieldActivityForm)
  ) => void;
  onActivityTypesChange: (types: FieldActivityType[]) => void;
  onSave: (e: FormEvent) => Promise<boolean>;
  onBlockChange: (blockId: string) => void;
};

function dateBadgeParts(iso: string): { day: string; month: string; year: string } {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { day: '--', month: '---', year: '----' };
  return {
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
    year: d.toLocaleDateString('en-IN', { year: 'numeric' }),
  };
}

function statusPillClass(status: FieldActivity['activity_status']): string {
  if (status === 'completed') return 'fa-status-pill--completed';
  if (status === 'pending') return 'fa-status-pill--pending';
  return 'fa-status-pill--cancelled';
}

function followUpSlaBadge(row: FieldActivity): { label: string; className: string } | null {
  if (!row.follow_up_required || !row.follow_up_date || row.activity_status === 'completed') {
    return null;
  }
  const due = new Date(`${row.follow_up_date}T00:00:00.000Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: 'Overdue', className: 'fa-sla--overdue' };
  if (diffDays === 0) return { label: 'Due today', className: 'fa-sla--today' };
  return { label: `Due in ${diffDays}d`, className: 'fa-sla--upcoming' };
}

export function FieldActivityPhase2Panel(props: Props) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  const selectedBlock = props.blocks.find((b) => b.id === props.selectedBlockId) ?? null;
  const autoDap = computeDapFromDates(selectedBlock?.planting_date, props.form.activityDate);
  const dapForDisplay = props.form.dap ? Number(props.form.dap) : autoDap;
  const pendingCount = props.activities.filter((item) => item.activity_status === 'pending').length;
  const healthStatus =
    pendingCount > 0 ? 'Moderate' : props.activities.length > 0 ? 'Active tracking' : 'No records';

  const timelineRows = [...props.activities].sort((a, b) => {
    const dateCmp = String(b.applied_at).localeCompare(String(a.applied_at));
    if (dateCmp !== 0) return dateCmp;
    return String(b.created_at).localeCompare(String(a.created_at));
  });

  return (
    <div className="fa-page">
      <div className="fa-page-toolbar">
        <p className="fa-page-breadcrumb">Operations / Field Activities</p>
        <div className="fa-page-controls">
          <select
            className="fa-block-select"
            value={props.selectedBlockId}
            onChange={(e) => props.onBlockChange(e.target.value)}
          >
            {props.blocks.map((block) => (
              <option key={block.id} value={block.id}>
                {(block.plot_label || block.name) ?? 'Block'} - {block.crop_type}{' '}
                {block.acreage_decimal != null ? `(${block.acreage_decimal} Acre)` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="fa-filter-btn">
            ▾ Filter
          </button>
        </div>
      </div>

      <section className="fa-summary-card">
        {selectedBlock ? (
          <div className="fa-summary-grid">
            <div className="fa-summary-main">
              <p className="fa-summary-title">
                <span className="fa-summary-icon" aria-hidden>
                  🌿
                </span>
                {String(selectedBlock.crop_type ?? '').toUpperCase()} -{' '}
                {(selectedBlock.plot_label || selectedBlock.name || 'BLOCK A').toUpperCase()}
              </p>
              <div className="fa-summary-metrics">
                <div>
                  <p className="fa-metric-label">Acreage</p>
                  <p className="fa-metric-value">{selectedBlock.acreage_decimal ?? '—'} Acre</p>
                </div>
                <div>
                  <p className="fa-metric-label">Planting Date</p>
                  <p className="fa-metric-value">
                    {selectedBlock.planting_date ? formatDateLabel(selectedBlock.planting_date) : '—'}
                  </p>
                </div>
                <div>
                  <p className="fa-metric-label">DAP</p>
                  <p className="fa-metric-value fa-metric-value--dap">
                    {dapForDisplay ?? '—'} Days
                  </p>
                </div>
                <div>
                  <p className="fa-metric-label">Growth Stage</p>
                  <p className="fa-metric-value">{selectedBlock.stage ?? '—'}</p>
                </div>
                <div>
                  <p className="fa-metric-label">Health Status</p>
                  <p className="fa-metric-value fa-metric-value--health">
                    <span className="fa-health-dot" aria-hidden />
                    {healthStatus}
                  </p>
                </div>
              </div>
            </div>
            <div className="fa-summary-thumb" aria-hidden />
          </div>
        ) : (
          <p className="fa-empty-hint">No blocks found. Create farm blocks first.</p>
        )}
      </section>

      <section className="fa-timeline-section">
        <div className="fa-timeline-header">
          <h3 className="fa-timeline-title">Field Activity Timeline</h3>
          <button
            type="button"
            disabled={!props.canWrite || !props.selectedBlockId}
            className="fa-add-btn"
            onClick={() => setAddModalOpen(true)}
          >
            + Add Activity
          </button>
        </div>

        <div className="fa-timeline-list">
          {timelineRows.map((row) => {
            const inferredDap = computeDapFromDates(selectedBlock?.planting_date, row.applied_at);
            const title =
              row.activity_label?.trim() ||
              row.field_activity_types?.activity_name ||
              row.activity_type.replace(/_/g, ' ');
            const icon = iconForActivityType(row.field_activity_types?.icon);
            const cardTone = colorClassForTag(row.field_activity_types?.color_tag);
            const badge = dateBadgeParts(row.applied_at);
            const sla = followUpSlaBadge(row);

            return (
              <article key={row.id} className="fa-timeline-row">
                <div className="fa-timeline-date">
                  <p className="fa-timeline-date-day">{badge.day}</p>
                  <p>{badge.month}</p>
                  <p>{badge.year}</p>
                </div>
                <div className={`fa-timeline-card ${cardTone}`}>
                  <div className="fa-timeline-card-head">
                    <div>
                      <p className="fa-timeline-card-title">
                        <span className="fa-timeline-card-icon">{icon}</span>
                        {title}
                      </p>
                      <p className="fa-timeline-dap">DAP {row.dap ?? inferredDap ?? '—'}</p>
                    </div>
                    <div className="fa-timeline-card-actions">
                      <span className={`fa-status-pill ${statusPillClass(row.activity_status)}`}>
                        {row.activity_status === 'completed'
                          ? 'Completed'
                          : row.activity_status === 'pending'
                            ? 'Pending'
                            : 'Cancelled'}
                      </span>
                      <button type="button" className="fa-menu-btn" aria-label="Activity actions">
                        ⋮
                      </button>
                    </div>
                  </div>
                  {row.notes ? <p className="fa-timeline-notes">{row.notes}</p> : null}
                  <div className="fa-timeline-footer">
                    <p>
                      <span className="fa-footer-label">Cost:</span> ₹
                      {Number(row.cost_inr ?? 0).toLocaleString('en-IN')}
                    </p>
                    <span className="fa-footer-divider" aria-hidden />
                    <p>
                      <span className="fa-footer-label">DAP:</span> {row.dap ?? '—'}
                    </p>
                    <span className="fa-footer-divider" aria-hidden />
                    <p>
                      <span className="fa-footer-label">Added from:</span>{' '}
                      {fieldActivityAddedFromLabel(row)}
                    </p>
                    <span className="fa-footer-divider" aria-hidden />
                    <p>
                      <span className="fa-footer-label">Follow-up:</span>{' '}
                      {row.follow_up_required
                        ? row.follow_up_date
                          ? formatDateLabel(row.follow_up_date)
                          : 'Required'
                        : 'No'}
                    </p>
                    {sla ? (
                      <span className={`fa-sla ${sla.className}`}>{sla.label}</span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}

          {timelineRows.length === 0 ? (
            <p className="fa-timeline-empty">
              No field activities for this block yet. Click &quot;+ Add Activity&quot; to log the
              first one.
            </p>
          ) : null}
        </div>
      </section>

      <AddFieldActivityModal
        open={addModalOpen}
        canWrite={props.canWrite}
        apiBase={props.apiBase}
        cropType={selectedBlock?.crop_type}
        plantingDate={selectedBlock?.planting_date}
        activityTypes={props.activityTypes}
        form={props.form}
        onFormChange={props.onFormChange}
        onActivityTypesChange={props.onActivityTypesChange}
        onClose={() => setAddModalOpen(false)}
        onSave={props.onSave}
      />
    </div>
  );
}
