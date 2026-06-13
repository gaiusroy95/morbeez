import { useState } from 'react';
import { DiagnosisLabelPicker } from '../agronomist/DiagnosisLabelPicker';
import { Field, inputClass } from '../Modal';
import { StaticSelect } from '../ui';
import {
  FINDING_TYPES,
  FINDING_TYPE_LABELS,
  REVIEW_SEVERITIES,
  REVIEW_SEVERITY_LABELS,
  type FindingType,
  type ReviewSeverity,
} from '../../lib/ai-training-enums';

export type StructuredFieldFindingValues = {
  findingType: FindingType | '';
  severity: ReviewSeverity | '';
  finalConfirmedIssue: string;
  affectedAreaPct: string;
  observations: string;
};

export const EMPTY_STRUCTURED_FINDING: StructuredFieldFindingValues = {
  findingType: '',
  severity: '',
  finalConfirmedIssue: '',
  affectedAreaPct: '',
  observations: '',
};

type Props = {
  values: StructuredFieldFindingValues;
  cropType?: string | null;
  diagnosisApiBase: string;
  disabled?: boolean;
  onChange: (patch: Partial<StructuredFieldFindingValues>) => void;
};

export function StructuredFieldFindingFields({
  values,
  cropType,
  diagnosisApiBase,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="tc-structured-finding space-y-3">
      <Field label="Finding type *">
        <StaticSelect
          className={inputClass}
          value={values.findingType}
          disabled={disabled}
          onChange={(value) => onChange({ findingType: value as FindingType | '' })}
          options={[
            { value: '', label: '— Select type —' },
            ...FINDING_TYPES.map((t) => ({ value: t, label: FINDING_TYPE_LABELS[t] })),
          ]}
        />
      </Field>

      <Field label="Severity *">
        <div className="tc-structured-finding-severity">
          {REVIEW_SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              className={`tc-structured-finding-sev-btn${values.severity === s ? ' is-active' : ''}`}
              onClick={() => onChange({ severity: s })}
            >
              {REVIEW_SEVERITY_LABELS[s]}
            </button>
          ))}
        </div>
      </Field>

      <DiagnosisLabelPicker
        label="Confirmed issue"
        required
        apiBase={diagnosisApiBase}
        cropType={cropType}
        value={values.finalConfirmedIssue}
        disabled={disabled}
        placeholder="Search or add diagnosis…"
        onChange={(label) => onChange({ finalConfirmedIssue: label })}
      />

      <Field label="Affected area (% of block)">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          className={inputClass}
          disabled={disabled}
          value={values.affectedAreaPct}
          placeholder="e.g. 15"
          onChange={(e) => onChange({ affectedAreaPct: e.target.value })}
        />
      </Field>

      <Field label="Field notes (optional)">
        <textarea
          className={inputClass}
          rows={2}
          disabled={disabled}
          value={values.observations}
          placeholder="Symptoms, spread pattern, farmer context…"
          onChange={(e) => onChange({ observations: e.target.value })}
        />
      </Field>

      <FollowUpQuestionSuggestions
        cropType={cropType}
        issueName={values.finalConfirmedIssue}
        findingType={values.findingType}
        observations={values.observations}
        disabled={disabled}
        onInsert={(q) =>
          onChange({
            observations: [values.observations.trim(), q].filter(Boolean).join('\n'),
          })
        }
      />
    </div>
  );
}

function FollowUpQuestionSuggestions({
  cropType,
  issueName,
  findingType,
  observations,
  disabled,
  onInsert,
}: {
  cropType?: string | null;
  issueName: string;
  findingType: FindingType | '';
  observations: string;
  disabled?: boolean;
  onInsert: (question: string) => void;
}) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!issueName.trim() || !findingType) return;
    setLoading(true);
    try {
      const category =
        findingType === 'nutrient_deficiency'
          ? 'nutrient_deficiency'
          : findingType === 'irrigation'
            ? 'water_stress'
            : findingType;
      const res = await fetch('/morbeez-staff/api/v1/os/field/issue-follow-up-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          issueCategory: category,
          issueName: issueName.trim(),
          cropType: cropType ?? 'ginger',
          observation: observations.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { questions?: string[] };
      setQuestions(data.questions ?? []);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tc-followup-questions">
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || loading} onClick={() => void load()}>
        {loading ? 'Loading…' : 'Suggest follow-up questions'}
      </button>
      {questions.length ? (
        <ul className="tc-followup-questions-list">
          {questions.map((q) => (
            <li key={q}>
              <button type="button" className="btn btn-link btn-sm" disabled={disabled} onClick={() => onInsert(q)}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function validateStructuredFinding(values: StructuredFieldFindingValues): string | null {
  if (!values.findingType) return 'Finding type is required';
  if (!values.severity) return 'Severity is required';
  if (!values.finalConfirmedIssue.trim()) return 'Confirmed issue is required';
  if (values.affectedAreaPct.trim()) {
    const pct = Number(values.affectedAreaPct);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return 'Affected area must be between 0 and 100';
    }
  }
  return null;
}

export function structuredFindingToPayload(values: StructuredFieldFindingValues) {
  const affected =
    values.affectedAreaPct.trim() !== '' ? Number(values.affectedAreaPct) : undefined;
  return {
    findingType: values.findingType,
    severity: values.severity,
    finalConfirmedIssue: values.finalConfirmedIssue.trim(),
    affectedAreaPct: affected,
    observations: values.observations.trim() || undefined,
    diseasePest: values.finalConfirmedIssue.trim(),
    diseaseTone: deriveDiseaseTone(values.findingType as FindingType, values.severity as ReviewSeverity),
  };
}

function deriveDiseaseTone(
  findingType: FindingType,
  severity: ReviewSeverity
): 'healthy' | 'warning' | 'danger' {
  if (findingType === 'growth_observation' && severity === 'mild') return 'healthy';
  if (severity === 'severe' || findingType === 'disease' || findingType === 'pest') return 'danger';
  return 'warning';
}
