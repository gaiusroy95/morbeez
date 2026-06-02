import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const base = '/morbeez-staff/api/v1/os/telecaller';

type MetricScore = { key: string; label: string; score: number; max: number };

type EmployeePresentation = {
  performanceScore: number;
  metrics: MetricScore[];
  classification: string;
  businessInsight: string;
  detectedSignals: { positive: string[]; negative: string[] };
};

type WorkspaceIntelligence = {
  employee: {
    performanceScore: number | null;
    relationshipQuality: number | null;
    engagementGrowth: number | null;
    retentionQuality: number | null;
    attributedFarmers: number | null;
    isEngineScore: boolean;
  };
  employeePresentation: EmployeePresentation | null;
  cohort: {
    highOpportunityCount: number;
    atRiskCount: number;
    churnedCount: number;
    openAlertsCount: number;
  };
  priorityFarmers: Array<{
    leadId: string | null;
    farmerName: string;
    opportunityScore: number;
    riskBand: string | null;
    reason: string;
  }>;
  suggestedActions: Array<{ id: string; title: string; detail: string }>;
};

type Props = {
  onSelectLead: (leadId: string) => void;
};

export function TelecallerIntelligenceBar({ onSelectLead }: Props) {
  const [data, setData] = useState<WorkspaceIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<{ ok: boolean; intelligence: WorkspaceIntelligence }>(`${base}/workspace-intelligence`)
      .then((r) => {
        if (!cancelled) setData(r.intelligence);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !data) return null;
  if (!data) return null;

  const emp = data.employee;
  const empPres = data.employeePresentation;

  return (
    <section className="tc-intel-bar">
      <div className="tc-intel-bar-head">
        <h3>Relationship intelligence</h3>
        <button type="button" className="tc-intel-bar-toggle" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="tc-intel-bar-kpis">
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Your performance</span>
              <strong>
                {empPres?.performanceScore ?? emp.performanceScore ?? '—'}
                {(empPres || emp.performanceScore != null) && <small>/100</small>}
              </strong>
              <span className="tc-intel-kpi-sub">
                {empPres?.classification ??
                  (emp.isEngineScore ? 'Engine score' : 'Run recalc in Intelligence')}
              </span>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Engagement growth</span>
              <strong>
                {empPres?.metrics.find((m) => m.key === 'engagementGrowth')?.score ??
                  emp.engagementGrowth ??
                  '—'}
              </strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Relationship quality</span>
              <strong>
                {empPres?.metrics.find((m) => m.key === 'relationshipQuality')?.score ??
                  emp.relationshipQuality ??
                  '—'}
              </strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">Retention quality</span>
              <strong>
                {empPres?.metrics.find((m) => m.key === 'retentionQuality')?.score ??
                  emp.retentionQuality ??
                  '—'}
              </strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">High opportunity</span>
              <strong>{data.cohort.highOpportunityCount}</strong>
            </div>
            <div className="tc-intel-kpi">
              <span className="tc-intel-kpi-label">At risk</span>
              <strong className={data.cohort.atRiskCount > 0 ? 'tc-intel-warn' : ''}>
                {data.cohort.atRiskCount}
              </strong>
            </div>
          </div>

          {empPres ? (
            <div className="tc-intel-employee-detail">
              <p className="tc-intel-insight">{empPres.businessInsight}</p>
              {empPres.detectedSignals.positive.length > 0 ||
              empPres.detectedSignals.negative.length > 0 ? (
                <div className="tc-intel-signals tc-intel-signals-compact">
                  {empPres.detectedSignals.positive.map((s) => (
                    <span key={s} className="tc-intel-signal-chip tc-intel-signal-pos">
                      {s}
                    </span>
                  ))}
                  {empPres.detectedSignals.negative.map((s) => (
                    <span key={s} className="tc-intel-signal-chip tc-intel-signal-neg">
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
              <table className="tc-intel-metrics-table tc-intel-metrics-table-compact">
                <tbody>
                  {empPres.metrics.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{row.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {data.suggestedActions.length > 0 ? (
            <ul className="tc-intel-actions">
              {data.suggestedActions.map((a) => (
                <li key={a.id}>
                  <strong>{a.title}</strong>
                  <span>{a.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {data.priorityFarmers.length > 0 ? (
            <div className="tc-intel-priority">
              <h4>Priority farmers</h4>
              <ul>
                {data.priorityFarmers.map((f) => (
                  <li key={f.leadId ?? f.farmerName}>
                    {f.leadId ? (
                      <button
                        type="button"
                        className="tc-intel-priority-btn"
                        onClick={() => onSelectLead(f.leadId!)}
                      >
                        <span className="tc-intel-priority-name">{f.farmerName}</span>
                        <span className="tc-intel-priority-meta">
                          Score {f.opportunityScore}
                          {f.riskBand ? ` · ${f.riskBand.replace('_', ' ')}` : ''}
                        </span>
                        <span className="tc-intel-priority-reason">{f.reason}</span>
                      </button>
                    ) : (
                      <div>
                        <span className="tc-intel-priority-name">{f.farmerName}</span>
                        <span className="tc-intel-priority-meta">Score {f.opportunityScore}</span>
                      </div>
                    )}
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
