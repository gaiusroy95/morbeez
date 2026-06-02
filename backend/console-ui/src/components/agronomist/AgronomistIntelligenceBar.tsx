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
    api<{ ok: boolean; intelligence: WorkspaceIntelligence }>(`${base}/workspace-intelligence`)
      .then((r) => {
        if (!cancelled) setData(r.intelligence);
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
