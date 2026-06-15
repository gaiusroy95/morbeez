import {
  VISIT_AI_EVIDENCE_PHOTO_LABELS,
  VISIT_AI_EVIDENCE_PHOTO_TYPES,
  type VisitAiEvidenceRequest,
} from '@morbeez/shared';

type Props = {
  evidenceRequest: VisitAiEvidenceRequest;
  onChange: (next: VisitAiEvidenceRequest) => void;
};

const YES_NO = ['yes', 'no'] as const;

export function VisitRejectEvidenceStep({ evidenceRequest, onChange }: Props) {
  function togglePhoto(photoType: string) {
    const set = new Set(evidenceRequest.photoTypes);
    if (set.has(photoType)) set.delete(photoType);
    else set.add(photoType);
    onChange({ ...evidenceRequest, photoTypes: [...set] });
  }

  function setAnswer(key: string, answer: string) {
    onChange({
      ...evidenceRequest,
      questions: evidenceRequest.questions.map((q) => (q.key === key ? { ...q, answer } : q)),
    });
  }

  return (
    <div className="vw-reject-flow">
      <span className="vw-field-label">Request photos from farmer</span>
      <div className="vw-segmented">
        {VISIT_AI_EVIDENCE_PHOTO_TYPES.map((photoType) => {
          const active = evidenceRequest.photoTypes.includes(photoType);
          return (
            <button
              key={photoType}
              type="button"
              className={['vw-segment', active ? 'vw-segment--active' : ''].filter(Boolean).join(' ')}
              onClick={() => togglePhoto(photoType)}
            >
              {VISIT_AI_EVIDENCE_PHOTO_LABELS[photoType]}
            </button>
          );
        })}
      </div>
      <span className="vw-field-label">Evidence questions</span>
      {evidenceRequest.questions.map((q) => (
        <div key={q.key} className="vw-evidence-question">
          <p>{q.text}</p>
          <div className="vw-segmented">
            {YES_NO.map((v) => (
              <button
                key={v}
                type="button"
                className={['vw-segment', q.answer === v ? 'vw-segment--active' : ''].filter(Boolean).join(' ')}
                onClick={() => setAnswer(q.key, v)}
              >
                {v === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="vw-muted">WhatsApp will be sent to the farmer. No recommendation until evidence is received.</p>
    </div>
  );
}
