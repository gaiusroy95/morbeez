import { Field, Input, textareaClass } from '../../../ui';

type Props = {
  recommendation: string;
  rejectNote: string;
  onChangeRecommendation: (value: string) => void;
  onChangeNote: (value: string) => void;
};

export function VisitRejectEditRecStep({
  recommendation,
  rejectNote,
  onChangeRecommendation,
  onChangeNote,
}: Props) {
  return (
    <div className="vw-reject-flow">
      <Field label="Why is the recommendation not suitable?">
        <Input
          value={rejectNote}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder="e.g. Not suitable for current crop stage"
        />
      </Field>
      <span className="vw-field-label">Edited recommendation</span>
      <textarea
        className={textareaClass}
        value={recommendation}
        onChange={(e) => onChangeRecommendation(e.target.value)}
        placeholder="Edit the AI recommendation"
      />
    </div>
  );
}
