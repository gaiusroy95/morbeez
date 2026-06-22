import { useEffect, useState } from 'react';
import { agronomistClient, type TriagePreview } from '@morbeez/shared';
import { Alert, Panel } from '../../ui';

type Props = {
  farmerId: string;
  blockId: string;
  blockAssessment?: { blockHealth: string; cropPerformance: string; soilMoisture: string };
  measurements: Record<string, string>;
  analyzePhotos?: Array<{ dataBase64: string; mimeType?: string }>;
  triage: TriagePreview | null;
  onTriage: (triage: TriagePreview | null) => void;
};

const LEVEL_LABEL: Record<string, string> = {
  L1: 'Simple',
  L2: 'Moderate',
  L3: 'Complex',
  L4: 'Critical',
};

export function VisitAiTriageStep(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (props.triage) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const measurementRows = Object.entries(props.measurements)
        .filter(([, v]) => v?.trim())
        .map(([key, value]) => ({ key, value }));
      const { triage, capability } = await agronomistClient.triagePreview({
        farmerId: props.farmerId,
        blockId: props.blockId,
        blockAssessment: props.blockAssessment,
        measurements: measurementRows,
        analyzePhotos: props.analyzePhotos,
      });
      props.onTriage(triage);
      if (!capability.capable) setError('AI diagnosis degraded — escalation may be required.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Triage failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vw-step">
      {loading ? <p className="vw-hint">Classifying case complexity…</p> : null}
      {error ? <Alert variant="warning">{error}</Alert> : null}
      {props.triage ? (
        <Panel title="AI triage">
          <p className="vw-triage-level">
            {LEVEL_LABEL[props.triage.level] ?? props.triage.level} ({props.triage.level})
          </p>
          <p className="vw-hint">{props.triage.reason}</p>
          <p className="vw-hint">Route: {props.triage.route}</p>
          {props.triage.blockAutoApprove ? (
            <p className="vw-warn">Auto-approve blocked for this case.</p>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
