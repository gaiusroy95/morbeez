import { useEffect, useState } from 'react';
import { agronomistClient, type MonitoringPlanPreviewItem, type RecommendationGroupDraft } from '@morbeez/shared';
import { Alert, Loading } from '../../ui';
import type { VisitIssueDraft } from './types';

type Props = {
  issues: VisitIssueDraft[];
  recommendationGroups: RecommendationGroupDraft[];
  monitoringPlan: MonitoringPlanPreviewItem[];
  onChange: (items: MonitoringPlanPreviewItem[]) => void;
};

export function VisitMonitoringPlanStep({
  issues,
  recommendationGroups,
  monitoringPlan,
  onChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (monitoringPlan.length || !issues.length) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const items = await agronomistClient.previewMonitoringPlan({
        issues: issues.map((i) => ({
          localId: i.localId,
          issueName: i.issueName,
          severity: i.severity,
        })),
        recommendationGroups,
      });
      onChange(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load monitoring plan');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading label="Generating monitoring plan…" />;

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="vw-hint">Severity-based and material-based field monitoring schedule.</p>
      {monitoringPlan.map((item) => (
        <div key={item.localId} className="vw-issue-card">
          <div className="vw-issue-title">{item.issueLabel}</div>
          <div className="vw-hint">
            Check every {item.intervalDays} days · {item.checkType} · {item.severity} severity
          </div>
        </div>
      ))}
    </div>
  );
}
