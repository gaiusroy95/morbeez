import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal, Field, inputClass } from '../Modal';
import { Alert } from '../ui';
import {
  FINDING_TYPE_LABELS,
  REVIEW_SEVERITY_LABELS,
  type FindingType,
  type ReviewSeverity,
} from '../../lib/ai-training-enums';
import {
  EMPTY_STRUCTURED_FINDING,
  StructuredFieldFindingFields,
  structuredFindingToPayload,
  validateStructuredFinding,
  type StructuredFieldFindingValues,
} from './StructuredFieldFindingFields';

export type FieldFindingListRow = {
  id: string;
  visitedLabel?: string;
  blockName?: string;
  cropType?: string;
};

type FieldFindingDetail = {
  id: string;
  visitedLabel: string;
  blockName: string;
  cropType: string;
  agronomistName: string;
  agronomistRole: string;
  agronomistInitials: string;
  observations: string;
  parameters: Array<{ label: string; value: string }>;
  diseasePest: string;
  diseaseTone: string;
  actionTaken: string;
  followUpLabel: string;
  followUpAt: string | null;
  photoUrls: string[];
  findingType?: string | null;
  severity?: string | null;
  affectedAreaPct?: number | null;
  finalConfirmedIssue?: string | null;
  aiPrediction?: string | null;
};

type Props = {
  leadId: string;
  row: FieldFindingListRow;
  canWrite?: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

function diseaseClass(tone: string): string {
  return `tc-ff-disease tc-ff-disease--${tone}`;
}

function detailToStructured(detail: FieldFindingDetail): StructuredFieldFindingValues {
  return {
    findingType: (detail.findingType as FindingType) ?? '',
    severity: (detail.severity as ReviewSeverity) ?? '',
    finalConfirmedIssue: detail.finalConfirmedIssue ?? detail.diseasePest ?? '',
    affectedAreaPct:
      detail.affectedAreaPct != null && !Number.isNaN(detail.affectedAreaPct)
        ? String(detail.affectedAreaPct)
        : '',
    observations: detail.observations ?? '',
  };
}

export function FieldFindingDetailModal({ leadId, row, canWrite, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<FieldFindingDetail | null>(null);
  const [structuredFinding, setStructuredFinding] =
    useState<StructuredFieldFindingValues>(EMPTY_STRUCTURED_FINDING);
  const [actionTaken, setActionTaken] = useState('');

  const base = '/morbeez-staff/api/v1/os/telecaller';

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; finding: FieldFindingDetail }>(
        `${base}/leads/${leadId}/field-findings/${encodeURIComponent(row.id)}`
      );
      setDetail(d.finding);
      setStructuredFinding(detailToStructured(d.finding));
      setActionTaken(String(d.finding.actionTaken ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load field finding');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [leadId, row.id]);

  async function save() {
    if (!detail || !canWrite) return;
    const findingErr = validateStructuredFinding(structuredFinding);
    if (findingErr) {
      setError(findingErr);
      return;
    }
    const payload = structuredFindingToPayload(structuredFinding);
    setSaving(true);
    setError('');
    try {
      await api(`${base}/field-findings/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          observations: structuredFinding.observations.trim(),
          diseasePest: payload.diseasePest,
          diseaseTone: payload.diseaseTone,
          actionTaken: actionTaken.trim(),
          findingType: payload.findingType,
          severity: payload.severity,
          affectedAreaPct: payload.affectedAreaPct,
          finalConfirmedIssue: payload.finalConfirmedIssue,
        }),
      });
      setEditing(false);
      onSaved?.();
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const issueLabel =
    detail?.finalConfirmedIssue ?? detail?.diseasePest ?? '—';

  return (
    <Modal title="Field finding details" onClose={onClose} wide>
      {loading ? <p className="text-sm text-ink-muted">Loading…</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs text-ink-secondary">
              {detail.visitedLabel}
            </span>
            {detail.findingType ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-800">
                {FINDING_TYPE_LABELS[detail.findingType as FindingType] ?? detail.findingType}
              </span>
            ) : null}
            {detail.severity ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-900">
                {REVIEW_SEVERITY_LABELS[detail.severity as ReviewSeverity] ?? detail.severity}
              </span>
            ) : null}
            <span className={diseaseClass(detail.diseaseTone)}>{issueLabel}</span>
            {canWrite && !editing ? (
              <button
                type="button"
                className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="tc-ff-avatar">{detail.agronomistInitials}</div>
            <div>
              <p className="font-semibold text-ink">{String(detail.agronomistName)}</p>
              <p className="text-xs text-ink-muted">{String(detail.agronomistRole)}</p>
            </div>
            <div className="ml-auto text-right text-sm">
              <p className="font-medium text-ink">{detail.blockName}</p>
              <p className="text-ink-muted">{detail.cropType}</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <StructuredFieldFindingFields
                values={structuredFinding}
                cropType={detail.cropType}
                diagnosisApiBase={base}
                onChange={(patch) => setStructuredFinding((prev) => ({ ...prev, ...patch }))}
              />
              <Field label="Action taken">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {detail.affectedAreaPct != null ? (
                <p className="text-sm text-ink-secondary">
                  <strong>Affected area:</strong> {detail.affectedAreaPct}% of block
                </p>
              ) : null}

              <section>
                <h3 className="text-xs font-semibold uppercase text-ink-muted">Observations</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  {detail.observations || '—'}
                </p>
              </section>

              {detail.parameters.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-ink-muted">Parameters</h3>
                  <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {detail.parameters.map((p, i) => (
                      <li key={i} className="text-ink-secondary">
                        <span className="text-ink-muted">{p.label}:</span> {p.value}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.actionTaken ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-ink-muted">Action taken</h3>
                  <p className="mt-1 text-sm text-ink">{detail.actionTaken}</p>
                </section>
              ) : null}

              <p className="text-sm text-ink-secondary">
                <strong>Next follow-up:</strong> {detail.followUpLabel}
              </p>
            </>
          )}

          {detail.photoUrls.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-ink-muted">Photos</h3>
              <div className="tc-ff-photo-grid">
                {detail.photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="tc-ff-photo">
                    <img src={url} alt={`Field photo ${i + 1}`} />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
