import { useMemo, useState } from 'react';
import {
  RECORD_SEVERITIES,
  buildFarmerExperienceSections,
  composeStructuredRecommendationText,
  formatActiveIngredientLine,
  type IssueMasterRow,
  type RecordSeverity,
  type FarmerRecommendationSource,
} from '@morbeez/shared';
import { Btn, Field, Input, Select, textareaClass } from '../../ui';
import type { VisitIssueDraft } from './types';
import { newIssueDraft, pickDefaultIssueCategory } from './types';
import {
  getFallbackIssueTypes,
  getIssueCategoryLabel,
  ISSUE_CATEGORY_OPTIONS,
} from './visitIssueTypes';

const SEVERITY_COLORS: Record<RecordSeverity, string> = {
  low: 'vw-severity--low',
  medium: 'vw-severity--medium',
  high: 'vw-severity--high',
};

type FarmerFeedbackProp = FarmerRecommendationSource & {
  priorExperience?: string | null;
  priorProduct?: string | null;
  priorOutcome?: string | null;
};

type Props = {
  issues: VisitIssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
  farmerFeedback?: FarmerFeedbackProp | null;
  onChange: (issues: VisitIssueDraft[]) => void;
};

function IssueEditorModal({
  issue,
  issueMaster,
  cropType,
  farmerFeedback,
  onSave,
  onRemove,
  onClose,
}: {
  issue: VisitIssueDraft;
  issueMaster: IssueMasterRow[];
  cropType: string;
  farmerFeedback?: FarmerFeedbackProp | null;
  onSave: (issue: VisitIssueDraft) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(issue);
  const [farmerExpOpen, setFarmerExpOpen] = useState(false);
  const farmerSections = buildFarmerExperienceSections(farmerFeedback ?? undefined);
  const hasFarmerExperience =
    farmerSections.observations.length > 0 ||
    farmerSections.activeIngredients.length > 0 ||
    farmerSections.symptomsReported ||
    farmerSections.responseAfterApplication;

  const nameOptions = useMemo(() => {
    const filtered = issueMaster.filter(
      (m) => m.category === draft.category && (!m.cropType || m.cropType === cropType)
    );
    if (filtered.length) return filtered.map((m) => m.issueName);
    return getFallbackIssueTypes(cropType, draft.category);
  }, [issueMaster, draft.category, cropType]);

  const recs = draft.recommendations ?? [];

  function updateRec(index: number, patch: Partial<NonNullable<VisitIssueDraft['recommendations']>[number]>) {
    const next = [...recs];
    const merged = { ...next[index], ...patch };
    merged.text = composeStructuredRecommendationText({
      activeIngredient: merged.activeIngredient,
      dose: merged.dose,
      method: merged.method,
      remarks: merged.remarks ?? merged.text,
    });
    next[index] = merged;
    setDraft((prev) => ({ ...prev, recommendations: next }));
  }

  return (
    <div className="vw-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="vw-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="vw-modal-header">
          <h3 className="vw-modal-title">{issue.issueName ? 'Edit issue details' : 'Add issue'}</h3>
          <Btn variant="secondary" size="sm" onClick={onClose}>
            Close
          </Btn>
        </div>

        <Field label="Category">
          <Select
            value={draft.category}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                category: e.target.value as VisitIssueDraft['category'],
                issueName: '',
              }))
            }
          >
            {ISSUE_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Issue type">
          <Select
            value={draft.issueName}
            onChange={(e) => setDraft((prev) => ({ ...prev, issueName: e.target.value }))}
          >
            <option value="">Select or type below</option>
            {nameOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Input
            className="mt-2"
            value={draft.issueName}
            onChange={(e) => setDraft((prev) => ({ ...prev, issueName: e.target.value }))}
            placeholder="Issue name"
          />
        </Field>

        <span className="vw-field-label">Severity</span>
        <div className="vw-segmented">
          {RECORD_SEVERITIES.map((sev) => (
            <button
              key={sev}
              type="button"
              className={['vw-segment', draft.severity === sev ? 'vw-segment--active' : ''].filter(Boolean).join(' ')}
              onClick={() => setDraft((prev) => ({ ...prev, severity: sev }))}
            >
              {sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        <Field label="Agronomist notes">
          <textarea
            className={textareaClass}
            value={draft.observation ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, observation: e.target.value }))}
            placeholder="Your field observations and validation notes…"
          />
        </Field>

        {hasFarmerExperience ? (
          <div className="vw-farmer-exp-collapse">
            <button
              type="button"
              className="vw-farmer-exp-collapse__toggle"
              onClick={() => setFarmerExpOpen((v) => !v)}
            >
              {farmerExpOpen ? '▼' : '▶'} Farmer experience
            </button>
            {farmerExpOpen ? (
              <div className="vw-farmer-exp-collapse__body">
                {farmerSections.observations.length ? (
                  <>
                    <p className="vw-farmer-section__title">Symptoms reported</p>
                    <ul className="vw-farmer-list">
                      {farmerSections.observations.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {farmerSections.activeIngredients.length ? (
                  <>
                    <p className="vw-farmer-section__title">Active ingredients applied</p>
                    <ul className="vw-farmer-list">
                      {farmerSections.activeIngredients.map((item) => (
                        <li key={item.label}>{formatActiveIngredientLine(item)}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {farmerSections.responseAfterApplication ? (
                  <>
                    <p className="vw-farmer-section__title">Response after application</p>
                    <p className="vw-muted">{farmerSections.responseAfterApplication}</p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="vw-rec-block">
          <p className="vw-field-label">Recommendations</p>
          {recs.map((rec, index) => (
            <div key={`rec-${index}`} className="vw-rec-card">
              <Field label="Recommendation type">
                <Input
                  value={rec.recommendationType ?? 'other'}
                  onChange={(e) => updateRec(index, { recommendationType: e.target.value as never })}
                />
              </Field>
              <Field label="Active ingredient">
                <Input
                  value={rec.activeIngredient ?? ''}
                  onChange={(e) => updateRec(index, { activeIngredient: e.target.value })}
                />
              </Field>
              <Field label="Dose">
                <Input value={rec.dose ?? ''} onChange={(e) => updateRec(index, { dose: e.target.value })} />
              </Field>
              <Field label="Method">
                <Input value={rec.method ?? ''} onChange={(e) => updateRec(index, { method: e.target.value })} />
              </Field>
              <Field label="Remarks">
                <textarea
                  className={textareaClass}
                  value={rec.remarks ?? rec.text}
                  onChange={(e) => updateRec(index, { remarks: e.target.value })}
                />
              </Field>
            </div>
          ))}
          <Btn
            variant="secondary"
            size="sm"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                recommendations: [
                  ...(prev.recommendations ?? []),
                  { text: '', recommendationType: 'other', priority: 'normal', status: 'open' },
                ],
              }))
            }
          >
            Add recommendation
          </Btn>
        </div>

        <div className="flex flex-wrap gap-2">
          {onRemove ? (
            <Btn variant="danger" onClick={onRemove}>
              Delete issue
            </Btn>
          ) : null}
          <Btn
            variant="primary"
            onClick={() => {
              if (!draft.issueName.trim()) return;
              onSave(draft);
            }}
          >
            Save issue
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function VisitIssuesStep({ issues, issueMaster, cropType, farmerFeedback, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VisitIssueDraft | null>(null);

  function openAdd() {
    setEditing(newIssueDraft(pickDefaultIssueCategory(), `new-${Date.now()}`));
    setModalOpen(true);
  }

  function openEdit(issue: VisitIssueDraft) {
    setEditing({ ...issue });
    setModalOpen(true);
  }

  function saveIssue(issue: VisitIssueDraft) {
    const exists = issues.some((i) => i.localId === issue.localId);
    onChange(exists ? issues.map((i) => (i.localId === issue.localId ? issue : i)) : [...issues, issue]);
    setModalOpen(false);
    setEditing(null);
  }

  function removeIssue(localId: string) {
    onChange(issues.filter((i) => i.localId !== localId));
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="vw-stack">
      <Btn variant="primary" onClick={openAdd}>
        + Add issue
      </Btn>

      {issues.map((issue) => (
        <button key={issue.localId} type="button" className="vw-issue-card" onClick={() => openEdit(issue)}>
          <div className="vw-issue-card-header">
            <span className="vw-issue-category">{getIssueCategoryLabel(issue.category)}</span>
            <span className={['vw-severity', SEVERITY_COLORS[issue.severity]].join(' ')}>{issue.severity}</span>
          </div>
          <div className="vw-issue-title">{issue.issueName || 'Unnamed issue'}</div>
          {issue.finalDiagnosis && issue.finalDiagnosis !== issue.issueName ? (
            <div className="vw-hint" style={{ fontWeight: 600, color: '#166534' }}>
              AI diagnosis: {issue.finalDiagnosis}
            </div>
          ) : null}
          {issue.observation ? <div className="vw-issue-obs">{issue.observation}</div> : null}
        </button>
      ))}

      {!issues.length ? (
        <p className="vw-hint" style={{ textAlign: 'center', padding: '16px 0' }}>
          No issues yet. Go back to AI if analysis did not run, or add an issue manually.
        </p>
      ) : null}

      {modalOpen && editing ? (
        <IssueEditorModal
          issue={editing}
          issueMaster={issueMaster}
          cropType={cropType}
          farmerFeedback={farmerFeedback}
          onSave={saveIssue}
          onRemove={issues.some((i) => i.localId === editing.localId) ? () => removeIssue(editing.localId) : undefined}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
