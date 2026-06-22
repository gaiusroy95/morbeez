import { useEffect, useState } from 'react';
import { agronomistClient } from '@morbeez/shared';
import { Alert, Panel } from '../../ui';

type Option = {
  id: string;
  label: string;
  costInr: number;
  expectedRecoveryPct: number;
  roiNote: string;
};

type Props = {
  issueLabel: string;
  cropType: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function VisitEconomicOptimizerStep({ issueLabel, cropType, selectedId, onSelect }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void agronomistClient
      .previewRecommendationOptions({ issueLabel, cropType, farmerSegment: 'roi_focused' })
      .then((rows) => setOptions(rows as Option[]))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load options'));
  }, [issueLabel, cropType]);

  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="vw-step">
      <Panel title="Economic optimizer">
        <p className="vw-hint">Compare treatment options by cost and expected recovery.</p>
        <div className="vw-eco-grid">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`vw-eco-card${selectedId === opt.id ? ' vw-eco-card--active' : ''}`}
              onClick={() => onSelect(opt.id)}
            >
              <strong>{opt.label}</strong>
              <div>₹{opt.costInr}</div>
              <div>{opt.expectedRecoveryPct}% recovery</div>
              <div className="vw-hint">{opt.roiNote}</div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
