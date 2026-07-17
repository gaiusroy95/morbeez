import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { StaticSelect } from '../../ui';
import { AddFieldActivityModal } from './AddFieldActivityModal';
import { useStaffPasswordConfirm } from '../../../hooks/useStaffPasswordConfirm';
import {
  colorClassForTag,
  computeDapFromDates,
  formatDateLabel,
  fieldActivityAddedFromLabel,
  iconForActivityType,
  isConfirmedVoiceActivity,
  type FieldActivity,
  type FieldActivityBlock,
  type FieldActivityForm,
  type FieldActivityType,
} from './field-activity-utils';
import '../../../styles/field-activities.css';

type Props = {
  canWrite: boolean;
  apiBase: string;
  breadcrumbLabel?: string;
  blocks: FieldActivityBlock[];
  selectedBlockId: string;
  activities: FieldActivity[];
  activityTypes: FieldActivityType[];
  form: FieldActivityForm;
  editingActivity?: FieldActivity | null;
  editModalOpen?: boolean;
  onFormChange: (
    value: FieldActivityForm | ((prev: FieldActivityForm) => FieldActivityForm)
  ) => void;
  onActivityTypesChange: (types: FieldActivityType[]) => void;
  onSave: (e: FormEvent) => Promise<boolean>;
  onEditSave?: (e: FormEvent) => Promise<boolean>;
  onCloseEditModal?: () => void;
  onBlockChange: (blockId: string) => void;
  onEditActivity?: (row: FieldActivity) => void;
  onDeleteActivity?: (row: FieldActivity, confirmPassword: string) => Promise<void>;
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

function activityTitle(row: FieldActivity): string {
  return (
    row.activity_label?.trim() ||
    row.field_activity_types?.activity_name ||
    row.activity_type.replace(/_/g, ' ')
  );
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN');
}

export function FieldActivityPhase2Panel(props: Props) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'voice'>('all');
  const [inspectedActivity, setInspectedActivity] = useState<FieldActivity | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { canConfirm, requestConfirm, confirmModal } = useStaffPasswordConfirm(props.canWrite);

  const selectedBlock = props.blocks.find((b) => b.id === props.selectedBlockId) ?? null;
  const autoDap = computeDapFromDates(selectedBlock?.planting_date, props.form.activityDate);
  const dapForDisplay = props.form.dap ? Number(props.form.dap) : autoDap;
  const pendingCount = props.activities.filter((item) => item.activity_status === 'pending').length;
  const healthStatus =
    pendingCount > 0 ? 'Moderate' : props.activities.length > 0 ? 'Active tracking' : 'No records';

  const timelineRows = [...props.activities]
    .filter((row) => sourceFilter === 'all' || isConfirmedVoiceActivity(row))
    .sort((a, b) => {
      const dateCmp = String(b.applied_at).localeCompare(String(a.applied_at));
      if (dateCmp !== 0) return dateCmp;
      return String(b.created_at).localeCompare(String(a.created_at));
    });

  useEffect(() => {
    if (!openMenuId) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMenuId]);

  return (
    <div className="fa-page">
      {confirmModal}
      <div className="fa-page-toolbar">
        <p className="fa-page-breadcrumb">
          {props.breadcrumbLabel ?? 'Operations / Field Activities'}
        </p>
        <div className="fa-page-controls">
          <StaticSelect
            className="fa-block-select"
            value={props.selectedBlockId}
            onChange={props.onBlockChange}
            options={props.blocks.map((block) => ({
              value: block.id,
              label: `${(block.plot_label || block.name) ?? 'Block'} - ${block.crop_type}${
                block.acreage_decimal != null ? ` (${block.acreage_decimal} Acre)` : ''
              }`,
            }))}
            compact
          />
          <StaticSelect
            className="fa-filter-btn"
            value={sourceFilter}
            onChange={(value) => setSourceFilter(value as 'all' | 'voice')}
            options={[
              { value: 'all', label: 'All activities' },
              { value: 'voice', label: 'Voice-derived' },
            ]}
            compact
          />
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
            const title = activityTitle(row);
            const icon = iconForActivityType(row.field_activity_types?.icon);
            const cardTone = colorClassForTag(row.field_activity_types?.color_tag);
            const badge = dateBadgeParts(row.applied_at);
            const sla = followUpSlaBadge(row);
            const menuOpen = openMenuId === row.id;
            const voiceDerived = isConfirmedVoiceActivity(row);

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
                      {voiceDerived ? (
                        <button
                          type="button"
                          className="fa-voice-badge"
                          onClick={() => setInspectedActivity(row)}
                        >
                          🎙 Voice-derived
                        </button>
                      ) : null}
                      {canConfirm ? (
                        <div
                          className="fa-row-menu-wrap"
                          ref={menuOpen ? menuRef : undefined}
                        >
                          <button
                            type="button"
                            className="fa-menu-btn"
                            aria-label="Activity actions"
                            aria-expanded={menuOpen}
                            onClick={() => setOpenMenuId(menuOpen ? null : row.id)}
                          >
                            ⋮
                          </button>
                          {menuOpen ? (
                            <div className="fa-row-menu" role="menu">
                              <button
                                type="button"
                                className="fa-row-menu-item"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  props.onEditActivity?.(row);
                                }}
                              >
                                Edit
                              </button>
                              {voiceDerived ? (
                                <button
                                  type="button"
                                  className="fa-row-menu-item"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setInspectedActivity(row);
                                  }}
                                >
                                  Inspect voice
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="fa-row-menu-item fa-row-menu-item--danger"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  requestConfirm('delete', title, async (confirmPassword) => {
                                    await props.onDeleteActivity?.(row, confirmPassword);
                                  });
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
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
              {sourceFilter === 'voice'
                ? 'No confirmed voice-derived activities for this block.'
                : 'No field activities for this block yet. Click "+ Add Activity" to log the first one.'}
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

      <AddFieldActivityModal
        open={Boolean(props.editModalOpen && props.editingActivity)}
        mode="edit"
        canWrite={props.canWrite}
        apiBase={props.apiBase}
        cropType={selectedBlock?.crop_type}
        plantingDate={selectedBlock?.planting_date}
        activityTypes={props.activityTypes}
        form={props.form}
        onFormChange={props.onFormChange}
        onActivityTypesChange={props.onActivityTypesChange}
        onClose={() => props.onCloseEditModal?.()}
        onSave={props.onEditSave ?? (async () => false)}
      />

      {inspectedActivity ? (
        <VoiceActivityDrawer
          activity={inspectedActivity}
          onClose={() => setInspectedActivity(null)}
        />
      ) : null}
    </div>
  );
}

function VoiceActivityDrawer({
  activity,
  onClose,
}: {
  activity: FieldActivity;
  onClose: () => void;
}) {
  const transcript = activity.transcript ?? activity.source_transcript;
  const language = activity.source_language ?? activity.language;
  const sourceMessage = activity.source_message ?? activity.sourceMessage;
  const sourceMessageId = activity.source_message_id ?? activity.sourceMessageId;
  const confidence = activity.extraction_confidence ?? activity.extractionConfidence;
  const warnings = activity.extraction_warnings ?? activity.extractionWarnings ?? [];
  const original = activity.original_values ?? activity.originalValues ?? {};
  const confirmed = activity.confirmed_values ?? activity.confirmedValues ?? {};
  const valueKeys = Array.from(new Set([...Object.keys(original), ...Object.keys(confirmed)]));
  const auditEvents = activity.audit_events ?? activity.auditEvents ?? [];
  const confirmedBy = activity.confirmed_by ?? activity.confirmedBy;
  const confirmedAt = activity.confirmed_at ?? activity.confirmedAt;
  const correctionReason = activity.correction_reason ?? activity.correctionReason;
  const roiEntryId = activity.roi_entry_id ?? activity.roiEntryId;
  const seasonId = activity.season_id ?? activity.seasonId ?? activity.season?.id;
  const seasonName = activity.season?.name ?? activity.season?.season_name;

  return (
    <>
      <button type="button" className="fa-drawer-backdrop" aria-label="Close activity inspection" onClick={onClose} />
      <aside className="fa-inspection-drawer" aria-label="Voice-derived activity inspection">
        <div className="fa-drawer-header">
          <div>
            <p className="fa-drawer-eyebrow">Confirmed voice-derived activity</p>
            <h2>{activityTitle(activity)}</h2>
          </div>
          <button type="button" className="fa-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="fa-drawer-body">
          <DrawerSection title="Source">
            <Detail label="Language" value={language?.toUpperCase()} />
            <Detail label="Source message ID" value={sourceMessageId} mono />
            <Detail label="Source message" value={sourceMessage} />
            <Detail label="Transcript" value={transcript} pre />
          </DrawerSection>

          <DrawerSection title="Extraction">
            <Detail
              label="Confidence"
              value={confidence != null ? `${Math.round((confidence <= 1 ? confidence * 100 : confidence))}%` : null}
            />
            {warnings.length ? (
              <ul className="fa-warning-list">
                {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
              </ul>
            ) : (
              <p className="fa-detail-empty">No extraction warnings recorded.</p>
            )}
          </DrawerSection>

          <DrawerSection title="Original vs confirmed">
            {valueKeys.length ? (
              <div className="fa-value-compare">
                <div className="fa-value-compare-head"><span>Field</span><span>Original</span><span>Confirmed</span></div>
                {valueKeys.map((key) => (
                  <div key={key} className="fa-value-compare-row">
                    <span>{key.replace(/_/g, ' ')}</span>
                    <span>{displayValue(original[key])}</span>
                    <span>{displayValue(confirmed[key])}</span>
                  </div>
                ))}
              </div>
            ) : <p className="fa-detail-empty">No value comparison supplied.</p>}
            <Detail label="Confirmed by" value={confirmedBy} />
            <Detail label="Confirmed at" value={formatDateTime(confirmedAt)} />
            <Detail label="Correction reason" value={correctionReason} />
          </DrawerSection>

          <DrawerSection title="Links">
            <Detail label="ROI entry" value={roiEntryId} mono />
            <Detail label="Season" value={seasonName ?? seasonId} />
          </DrawerSection>

          <DrawerSection title="Audit events">
            {auditEvents.length ? (
              <ol className="fa-audit-list">
                {auditEvents.map((event, index) => (
                  <li key={event.id ?? index}>
                    <strong>{event.action ?? event.event ?? 'Activity event'}</strong>
                    <span>{event.actor ?? 'System'} · {formatDateTime(event.created_at ?? event.createdAt)}</span>
                    {event.details ? <p>{displayValue(event.details)}</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="fa-detail-empty">No audit events supplied.</p>}
          </DrawerSection>
        </div>
      </aside>
    </>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="fa-drawer-section"><h3>{title}</h3>{children}</section>;
}

function Detail({
  label,
  value,
  mono = false,
  pre = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  pre?: boolean;
}) {
  return (
    <div className="fa-detail">
      <dt>{label}</dt>
      <dd className={`${mono ? 'fa-detail--mono' : ''} ${pre ? 'fa-detail--pre' : ''}`}>{value || '—'}</dd>
    </div>
  );
}
