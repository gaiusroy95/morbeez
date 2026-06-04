import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const base = '/morbeez-staff/api/v1/os/telecaller';

type MetricScore = { key: string; label: string; score: number; max: number };

type Presentation = {
  opportunityScore: number;
  metrics: MetricScore[];
  classification: string;
  businessInsight: string;
  detectedSignals: { positive: string[]; negative: string[] };
  employeeInsights: { telecaller: string | null; agronomist: string | null };
};

type Profile = {
  farmerId: string;
  score: { opportunityScore: number; calculatedAt: string } | null;
  retention: {
    riskBand: string;
    retentionScore: number;
    daysSinceLastInbound: number | null;
  } | null;
  summary: {
    opportunityLevel: string;
    engagementLevel: string;
    trustLevel: string;
    relationshipLevel: string;
    acrePotentialLevel: string;
    retentionRiskLabel: string;
  } | null;
  presentation: Presentation | null;
  componentBreakdown: Array<{ label: string; points: number; max: number }>;
  attributions: Array<{ employeeRole: string; attributionType: string }>;
};

function riskClass(band: string): string {
  if (band === 'healthy') return 'tc-badge-strong';
  if (band === 'watch') return 'tc-badge-due';
  if (band === 'at_risk') return 'tc-badge-high';
  return 'tc-badge-high';
}

function riskLabel(band: string): string {
  if (band === 'healthy') return 'Healthy';
  if (band === 'watch') return 'Watch';
  if (band === 'at_risk') return 'At risk';
  if (band === 'churned') return 'Churned';
  return band;
}

function levelBadgeClass(level: string): string {
  const l = level.toLowerCase();
  if (l.includes('high') || l.includes('strong') || l.includes('premium')) return 'tc-badge-strong';
  if (l.includes('medium') || l.includes('building') || l.includes('moderate')) return 'tc-badge-due';
  if (l.includes('churned') || l.includes('low') || l.includes('weak') || l.includes('risk')) {
    return 'tc-badge-high';
  }
  return 'tc-badge-due';
}

function metricBarClass(score: number): string {
  if (score >= 75) return 'tc-intel-metric-fill-strong';
  if (score >= 45) return 'tc-intel-metric-fill-mid';
  return 'tc-intel-metric-fill-low';
}

export function FarmerIntelligencePanel({
  leadId,
  fallbackLeadScore,
}: {
  leadId: string;
  fallbackLeadScore: number;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<{ ok: boolean; profile: Profile }>(`${base}/leads/${leadId}/intelligence`)
      .then((d) => {
        if (!cancelled) setProfile(d.profile);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const pres = profile?.presentation;
  const opportunity = pres?.opportunityScore ?? profile?.score?.opportunityScore;
  const summary = profile?.summary;
  const primaryAttribution = profile?.attributions?.[0];

  return (
    <>
      <article className="tc-profile-metric">
        <span>Opportunity score</span>
        <strong>
          {loading ? '…' : opportunity != null ? opportunity : Math.round(fallbackLeadScore * 20)}
          <small>/100</small>
          {pres ? (
            <em className={levelBadgeClass(pres.classification)}>{pres.classification}</em>
          ) : summary ? (
            <em className={levelBadgeClass(summary.opportunityLevel)}>{summary.opportunityLevel}</em>
          ) : opportunity != null && opportunity >= 70 ? (
            <em className="tc-badge-strong">High</em>
          ) : opportunity != null ? (
            <em className="tc-badge-due">Scored</em>
          ) : (
            <em className="tc-badge-due">Estimate</em>
          )}
        </strong>
      </article>
      <article className="tc-profile-metric">
        <span>Engagement</span>
        <strong>
          {loading
            ? '…'
            : pres?.metrics.find((m) => m.key === 'engagement')?.score ?? summary?.engagementLevel ?? '—'}
          {pres ? (
            <em className={levelBadgeClass(String(pres.metrics.find((m) => m.key === 'engagement')?.score))}>
              /100
            </em>
          ) : summary ? (
            <em className={levelBadgeClass(summary.engagementLevel)}>30d signal</em>
          ) : null}
        </strong>
      </article>
      <article className="tc-profile-metric">
        <span>Trust</span>
        <strong>
          {loading
            ? '…'
            : pres?.metrics.find((m) => m.key === 'trust')?.score ?? summary?.trustLevel ?? '—'}
          {pres ? (
            <em className={levelBadgeClass(String(pres.metrics.find((m) => m.key === 'trust')?.score))}>
              /100
            </em>
          ) : summary ? (
            <em className={levelBadgeClass(summary.trustLevel)}>Advisory</em>
          ) : null}
        </strong>
      </article>
      <article className="tc-profile-metric">
        <span>Retention risk</span>
        <strong>
          {loading
            ? '…'
            : summary?.retentionRiskLabel ??
              (profile?.retention ? riskLabel(profile.retention.riskBand) : '—')}
          {profile?.retention ? (
            <em className={riskClass(profile.retention.riskBand)}>
              {pres?.metrics.find((m) => m.key === 'retentionStability')?.score ??
                profile.retention.retentionScore}
              <small>/100</small>
            </em>
          ) : null}
        </strong>
      </article>

      {pres ? (
        <article className="tc-dashboard-card tc-intel-summary" style={{ gridColumn: '1 / -1' }}>
          <h3>Dynamic farmer intelligence</h3>
          <p className="tc-intel-classification">{pres.classification}</p>
          <p className="tc-intel-insight">{pres.businessInsight}</p>

          <table className="tc-intel-metrics-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {pres.metrics.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>
                    <div className="tc-intel-metric-cell">
                      <span>{row.score}</span>
                      <div className="tc-intel-metric-bar" aria-hidden>
                        <div
                          className={`tc-intel-metric-fill ${metricBarClass(row.score)}`}
                          style={{ width: `${row.score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(pres.detectedSignals.positive.length > 0 ||
            pres.detectedSignals.negative.length > 0) && (
            <div className="tc-intel-signals">
              <h4>System detected</h4>
              {pres.detectedSignals.positive.length > 0 ? (
                <ul className="tc-intel-signals-pos">
                  {pres.detectedSignals.positive.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {pres.detectedSignals.negative.length > 0 ? (
                <ul className="tc-intel-signals-neg">
                  {pres.detectedSignals.negative.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {(pres.employeeInsights.telecaller || pres.employeeInsights.agronomist) && (
            <dl className="tc-intel-summary-grid tc-intel-role-insights">
              {pres.employeeInsights.telecaller ? (
                <div>
                  <dt>Telecaller insight</dt>
                  <dd>{pres.employeeInsights.telecaller}</dd>
                </div>
              ) : null}
              {pres.employeeInsights.agronomist ? (
                <div>
                  <dt>Agronomist insight</dt>
                  <dd>{pres.employeeInsights.agronomist}</dd>
                </div>
              ) : null}
            </dl>
          )}

          <dl className="tc-intel-summary-grid">
            <div>
              <dt>Assigned team</dt>
              <dd>
                {primaryAttribution
                  ? `${primaryAttribution.employeeRole} · ${primaryAttribution.attributionType}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Last scored</dt>
              <dd>
                {profile?.score
                  ? new Date(profile.score.calculatedAt).toLocaleString('en-IN')
                  : '—'}
              </dd>
            </div>
          </dl>
        </article>
      ) : profile?.score && summary ? (
        <article className="tc-dashboard-card tc-intel-summary" style={{ gridColumn: '1 / -1' }}>
          <h3>Farmer intelligence</h3>
          <dl className="tc-intel-summary-grid">
            <div>
              <dt>Relationship</dt>
              <dd>
                <span className={levelBadgeClass(summary.relationshipLevel)}>
                  {summary.relationshipLevel}
                </span>
              </dd>
            </div>
            <div>
              <dt>Acre potential</dt>
              <dd>
                <span className={levelBadgeClass(summary.acrePotentialLevel)}>
                  {summary.acrePotentialLevel}
                </span>
              </dd>
            </div>
          </dl>
          {profile.componentBreakdown.length > 0 ? (
            <div className="tc-intel-breakdown">
              {profile.componentBreakdown.slice(0, 6).map((row) => (
                <div key={row.label} className="tc-intel-breakdown-row">
                  <span>{row.label}</span>
                  <span>
                    {row.points}/{row.max}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}
    </>
  );
}
