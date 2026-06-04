import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const base = '/morbeez-staff/api/v1/os/agronomist';

type WorkspaceIntelligence = {
  employee: {
    performanceScore: number | null;
    trustBuilding: number | null;
    knowledgeContribution: number | null;
    relationshipQuality: number | null;
    attributedFarmers: number | null;
  };
  cohort: {
    openEscalations: number;
    highOpportunityFarmers: number;
    farmersNeedingTrust: number;
  };
  confidence?: {
    autoSendPct: number | null;
    employeeReviewPct: number | null;
    escalatePct: number | null;
    autoSentRatePct: number | null;
    correctionRatePct: number | null;
    avgConfidencePct: number | null;
  };
  focusFarmers: Array<{
    farmerId: string;
    farmerName: string;
    opportunityScore: number | null;
    riskBand: string | null;
    reason: string;
  }>;
};

export function AgronomistIntelligenceBar() {
  const [data, setData] = useState<WorkspaceIntelligence | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ ok: boolean; intelligence: WorkspaceIntelligence }>(`${base}/workspace-intelligence`),
      api<{ ok: boolean; stats: WorkspaceIntelligence['confidence'] & Record<string, unknown> }>(
        `${base}/confidence-stats?days=30`
      ).catch(() => null),
    ])
      .then(([intelRes, statsRes]) => {
        if (cancelled) return;
        const stats = statsRes?.stats;
        setData({
          ...intelRes.intelligence,
          confidence: stats
            ? {
                autoSendPct: (stats as { byBand?: { autoSendPct?: number } }).byBand?.autoSendPct ?? null,
                employeeReviewPct:
                  (stats as { byBand?: { employeeReviewPct?: number } }).byBand?.employeeReviewPct ?? null,
                escalatePct: (stats as { byBand?: { escalatePct?: number } }).byBand?.escalatePct ?? null,
                autoSentRatePct: (stats as { autoSentRatePct?: number }).autoSentRatePct ?? null,
                correctionRatePct: (stats as { correctionRatePct?: number }).correctionRatePct ?? null,
                avgConfidencePct: (stats as { avgConfidencePct?: number }).avgConfidencePct ?? null,
              }
            : undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const emp = data.employee;

  return (
    <section className="tc-intel-bar ag-intel-bar">
      <div className="tc-intel-bar-head">
        <h3>Agronomist intelligence</h3>
        <button type="button" className="tc-intel-bar-toggle" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      {!collapsed ? (
        <>
          <div className="tc-intel-bar-kpis">
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Performance</span>
              <strong>{emp.performanceScore ?? '—'}</strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Trust building</span>
              <strong>{emp.trustBuilding ?? '—'}</strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Knowledge</span>
              <strong>{emp.knowledgeContribution ?? '—'}</strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Open cases</span>
              <strong>{data.cohort.openEscalations}</strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">High opportunity</span>
              <strong>{data.cohort.highOpportunityFarmers}</strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Need trust</span>
              <strong>{data.cohort.farmersNeedingTrust}</strong>
            </div>
            {data.confidence ? (
              <>
                <div className="tc-intel-kpi">
                  <span className="tc-intel-kpi-label">Auto-send band</span>
                  <strong>
                    {data.confidence.autoSendPct != null
                      ? `${data.confidence.autoSendPct}%`
                      : '—'}
                  </strong>
                </div>
                <div className="tc-intel-kpi">
                  <span className="tc-intel-kpi-label">Avg confidence</span>
                  <strong>
                    {data.confidence.avgConfidencePct != null
                      ? `${data.confidence.avgConfidencePct}%`
                      : '—'}
                  </strong>
                </div>
                <div className="tc-intel-kpi">
                  <span className="tc-intel-kpi-label">Correction rate</span>
                  <strong>
                    {data.confidence.correctionRatePct != null
                      ? `${data.confidence.correctionRatePct}%`
                      : '—'}
                  </strong>
                </div>
              </>
            ) : null}
          </div>
          {data.focusFarmers.length > 0 ? (
            <div className="tc-intel-priority">
              <h4>Focus farmers (your recent visits)</h4>
              <ul>
                {data.focusFarmers.map((f) => (
                  <li key={f.farmerId}>
                    <span className="tc-intel-priority-name">{f.farmerName}</span>
                    <span className="tc-intel-priority-meta">
                      {f.opportunityScore != null ? `Score ${f.opportunityScore}` : 'Unscored'}
                      {f.riskBand ? ` · ${f.riskBand.replace('_', ' ')}` : ''}
                    </span>
                    <span className="tc-intel-priority-reason">{f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
