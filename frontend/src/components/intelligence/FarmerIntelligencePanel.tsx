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

function KpiCards({
  profile,
  loading,
  fallbackLeadScore,
}: {
  profile: Profile | null;
  loading: boolean;
  fallbackLeadScore: number;
}) {
  const pres = profile?.presentation;
  const opportunity = pres?.opportunityScore ?? profile?.score?.opportunityScore;
  const summary = profile?.summary;

  return (
    <>
      <article className="tc-kpi-card">
        <span className="tc-kpi-label">Opportunity score</span>
        <div className="tc-kpi-value-row">
          <strong>
            {loading ? '…' : opportunity != null ? opportunity : Math.round(fallbackLeadScore * 20)}
            <small>/100</small>
          </strong>
          {pres ? (
            <em className={levelBadgeClass(pres.classification)}>{pres.classification}</em>
          ) : summary ? (
            <em className={levelBadgeClass(summary.opportunityLevel)}>{summary.opportunityLevel}</em>
          ) : null}
        </div>
      </article>
      <article className="tc-kpi-card">
        <span className="tc-kpi-label">Engagement</span>
        <div className="tc-kpi-value-row">
          <strong>
            {loading
              ? '…'
              : pres?.metrics.find((m) => m.key === 'engagement')?.score ?? '—'}
            {pres ? <small>/100</small> : null}
          </strong>
          {summary ? (
            <em className={levelBadgeClass(summary.engagementLevel)}>{summary.engagementLevel}</em>
          ) : null}
        </div>
      </article>
      <article className="tc-kpi-card">
        <span className="tc-kpi-label">Trust</span>
        <div className="tc-kpi-value-row">
          <strong>
            {loading ? '…' : pres?.metrics.find((m) => m.key === 'trust')?.score ?? '—'}
            {pres ? <small>/100</small> : null}
          </strong>
          {summary ? (
            <em className={levelBadgeClass(summary.trustLevel)}>{summary.trustLevel}</em>
          ) : null}
        </div>
      </article>
      <article className="tc-kpi-card">
        <span className="tc-kpi-label">Retention risk</span>
        <div className="tc-kpi-value-row">
          <strong>
            {loading
              ? '…'
              : summary?.retentionRiskLabel ??
                (profile?.retention ? riskLabel(profile.retention.riskBand) : '—')}
          </strong>
          {profile?.retention ? (
            <em className={riskClass(profile.retention.riskBand)}>
              {pres?.metrics.find((m) => m.key === 'retentionStability')?.score ??
                profile.retention.retentionScore}
              <small>/100</small>
            </em>
          ) : null}
        </div>
      </article>
    </>
  );
}

function IntelligenceDetail({
  profile,
  loading,
}: {
  profile: Profile | null;
  loading: boolean;
}) {
  const pres = profile?.presentation;
  const summary = profile?.summary;
  const primaryAttribution = profile?.attributions?.[0];

  if (loading) {
    return (
      <article className="tc-intel-panel">
        <p className="tc-muted-inline">Loading intelligence…</p>
      </article>
    );
  }

  if (pres) {
    return (
      <article className="tc-intel-panel">
        <header className="tc-intel-panel-head">
          <h3>Dynamic farmer intelligence</h3>
          <span className="tc-intel-panel-badge">{pres.classification}</span>
        </header>
        {pres.businessInsight ? <p className="tc-intel-insight">{pres.businessInsight}</p> : null}

        <div className="tc-intel-metrics-list">
          {pres.metrics.map((row) => (
            <div key={row.key} className="tc-intel-metric-row">
              <span className="tc-intel-metric-label">{row.label}</span>
              <div className="tc-intel-metric-track">
                <div
                  className={`tc-intel-metric-fill ${metricBarClass(row.score)}`}
                  style={{ width: `${row.score}%` }}
                />
              </div>
              <span className="tc-intel-metric-score">{row.score}</span>
            </div>
          ))}
        </div>

        {(pres.detectedSignals.positive.length > 0 ||
          pres.detectedSignals.negative.length > 0 ||
          pres.employeeInsights.telecaller ||
          pres.employeeInsights.agronomist) && (
          <div className="tc-intel-insights-grid">
            {(pres.detectedSignals.positive.length > 0 ||
              pres.detectedSignals.negative.length > 0) && (
              <div className="tc-intel-insight-col">
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
            {pres.employeeInsights.telecaller ? (
              <div className="tc-intel-insight-col">
                <h4>Telecaller insight</h4>
                <p>{pres.employeeInsights.telecaller}</p>
              </div>
            ) : null}
            {pres.employeeInsights.agronomist ? (
              <div className="tc-intel-insight-col">
                <h4>Agronomist insight</h4>
                <p>{pres.employeeInsights.agronomist}</p>
              </div>
            ) : null}
          </div>
        )}

        <dl className="tc-intel-meta-row">
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
    );
  }

  if (profile?.score && summary) {
    return (
      <article className="tc-intel-panel">
        <header className="tc-intel-panel-head">
          <h3>Farmer intelligence</h3>
        </header>
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
    );
  }

  return (
    <article className="tc-intel-panel">
      <header className="tc-intel-panel-head">
        <h3>Dynamic farmer intelligence</h3>
      </header>
      <p className="tc-muted-inline">Intelligence scores will appear after enough farmer activity.</p>
    </article>
  );
}

export function useFarmerIntelligenceProfile(leadId: string, enabled = true) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || !leadId) {
      setLoading(false);
      return;
    }
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
  }, [leadId, enabled]);

  return { profile, loading };
}

export function FarmerIntelligencePanel({
  leadId,
  fallbackLeadScore,
  variant = 'all',
  profile: profileProp,
  loading: loadingProp,
}: {
  leadId: string;
  fallbackLeadScore: number;
  variant?: 'all' | 'kpis' | 'detail';
  profile?: Profile | null;
  loading?: boolean;
}) {
  const shouldFetch = profileProp === undefined;
  const fetched = useFarmerIntelligenceProfile(leadId, shouldFetch);
  const profile = profileProp ?? fetched.profile;
  const loading = loadingProp ?? fetched.loading;

  if (variant === 'kpis') {
    return (
      <KpiCards profile={profile} loading={loading} fallbackLeadScore={fallbackLeadScore} />
    );
  }

  if (variant === 'detail') {
    return <IntelligenceDetail profile={profile} loading={loading} />;
  }

  return (
    <>
      <KpiCards profile={profile} loading={loading} fallbackLeadScore={fallbackLeadScore} />
      <IntelligenceDetail profile={profile} loading={loading} />
    </>
  );
}
