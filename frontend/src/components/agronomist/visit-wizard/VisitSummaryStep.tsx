import {
  RECOMMENDATION_FOLLOWED,
  VISIT_FOLLOWUP_OUTCOMES,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type MeasurementTemplate,
  type RecommendationFollowed,
  type SoilMoistureLevel,
  type VisitFollowupOutcome,
} from '@morbeez/shared';
import { Btn, Field, Panel, textareaClass } from '../../ui';
import type { FollowUpDraft, VisitIssueDraft } from './types';
import { computeVisitQualityScore } from './visitQualityScore';

type Props = {
  photoCount: number;
  photoTypeCount?: number;
  templates: MeasurementTemplate[];
  measurements: Record<string, string>;
  issues: VisitIssueDraft[];
  followUps: FollowUpDraft[];
  onFollowUpChange: (index: number, next: FollowUpDraft) => void;
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  hasGps: boolean;
  gpsStatus: string;
  gpsLoading: boolean;
  onCaptureGps: () => void;
};

const FOLLOWED_LABELS: Record<RecommendationFollowed, string> = {
  yes: 'Yes',
  partially: 'Partially',
  no: 'No',
  not_applicable: 'N/A',
};

const OUTCOME_LABELS: Record<VisitFollowupOutcome, string> = {
  improved: 'Improved',
  no_change: 'No change',
  worsened: 'Worsened',
  not_reviewed: 'Not reviewed',
};

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="vw-row">
      <span className="vw-row-label">{label}</span>
      <span className="vw-row-value">{value}</span>
    </div>
  );
}

function FollowUpSection({
  items,
  onChange,
}: {
  items: FollowUpDraft[];
  onChange: (index: number, next: FollowUpDraft) => void;
}) {
  if (!items.length) return null;

  return (
    <Panel title="Follow-up on prior recommendations">
      <p className="vw-hint">Record outcomes from the farmer&apos;s last recommendations.</p>
      {items.map((item, index) => (
        <div key={item.recommendationId} className="vw-followup-card">
          <div className="vw-followup-label">{item.label}</div>
          <span className="vw-field-label">Followed?</span>
          <div className="vw-segmented">
            {RECOMMENDATION_FOLLOWED.map((v) => (
              <button
                key={v}
                type="button"
                className={['vw-segment', item.followed === v ? 'vw-segment--active' : ''].filter(Boolean).join(' ')}
                onClick={() => onChange(index, { ...item, followed: v })}
              >
                {FOLLOWED_LABELS[v]}
              </button>
            ))}
          </div>
          <span className="vw-field-label">Outcome</span>
          <div className="vw-segmented">
            {VISIT_FOLLOWUP_OUTCOMES.map((v) => (
              <button
                key={v}
                type="button"
                className={['vw-segment', item.outcome === v ? 'vw-segment--active' : ''].filter(Boolean).join(' ')}
                onClick={() => onChange(index, { ...item, outcome: v })}
              >
                {OUTCOME_LABELS[v]}
              </button>
            ))}
          </div>
          <Field label="Notes">
            <textarea
              className={textareaClass}
              value={item.notes}
              onChange={(e) => onChange(index, { ...item, notes: e.target.value })}
              placeholder="Farmer feedback or field observation"
            />
          </Field>
        </div>
      ))}
    </Panel>
  );
}

export function VisitSummaryStep({
  photoCount,
  photoTypeCount,
  templates,
  measurements,
  issues,
  followUps,
  onFollowUpChange,
  blockHealth,
  cropPerformance,
  soilMoisture,
  hasGps,
  gpsStatus,
  gpsLoading,
  onCaptureGps,
}: Props) {
  const filledMeasurements = templates.filter((t) => measurements[t.measurementKey]?.trim()).length;
  const requiredMeasurements = templates.filter((t) => t.required).length;
  const recCount = issues.filter((i) => i.finalRecommendation?.trim()).length;
  const qaAnswered = issues.reduce(
    (n, i) => n + (i.followUpQuestions?.filter((q) => q.answer?.trim()).length ?? 0),
    0
  );
  const qaTotal = issues.reduce((n, i) => n + (i.followUpQuestions?.length ?? 0), 0);
  const hasReview = issues.every((i) => i.agronomistReview?.action);
  const quality = computeVisitQualityScore({
    blockHealth,
    cropPerformance,
    soilMoisture,
    photoCount,
    photoTypeCount,
    filledMeasurements,
    requiredMeasurements,
    issueCount: issues.length,
    recommendationCount: recCount,
    hasGps,
    qaAnsweredCount: qaAnswered,
    qaTotalCount: qaTotal,
    hasReviewDecision: hasReview,
  });

  return (
    <div className="vw-stack">
      <Panel title="Visit summary">
        <SummaryRow label="Photos" value={photoCount} />
        <SummaryRow label="Photo types" value={photoTypeCount ?? 0} />
        <SummaryRow label="Measurements" value={filledMeasurements} />
        <SummaryRow label="Issues" value={issues.length} />
        <SummaryRow label="Q&A answered" value={`${qaAnswered}/${qaTotal || '—'}`} />
        <SummaryRow label="Recommendations" value={recCount} />
      </Panel>

      <Panel title="AI & review">
        {issues.map((issue) => (
          <div key={issue.localId} className="vw-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <strong>{issue.finalDiagnosis ?? issue.issueName}</strong>
            <span className="vw-hint">
              Review: {issue.agronomistReview?.action?.replace(/_/g, ' ') ?? 'pending'}
              {issue.reviewAfterDays ? ` · Re-check in ${issue.reviewAfterDays}d` : ''}
            </span>
          </div>
        ))}
      </Panel>

      <div className="vw-score-card">
        <div className="vw-score-ring">{quality.score}%</div>
        <p className="vw-hint">Case quality score</p>
        <p style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>{quality.label}</p>
        <p className="vw-hint">{quality.message}</p>
      </div>

      <FollowUpSection items={followUps} onChange={onFollowUpChange} />

      <Panel title="Plot GPS">
        <p className="vw-hint">Stand at the plot and capture GPS for accurate weather advice.</p>
        {gpsStatus ? <p className="vw-hint" style={{ color: '#15803d', fontWeight: 600 }}>{gpsStatus}</p> : null}
        <Btn variant="secondary" onClick={onCaptureGps} disabled={gpsLoading}>
          {gpsLoading ? 'Getting location…' : hasGps ? 'Update GPS' : 'Capture plot GPS'}
        </Btn>
      </Panel>
    </div>
  );
}
