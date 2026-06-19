import type { CSSProperties } from 'react';

export type GingerSopV3Detail = {
  maiosVersion?: string;
  sopVersion?: string;
  channel?: string;
  route?: string;
  triage?: { level?: string; reason?: string };
  riskTags?: string[];
  evidence?: {
    tier?: string;
    completenessPct?: number;
    eqs?: number;
    photos?: Array<{ slot: string; status: string; qualityScore?: number }>;
  };
  diagnostics?: {
    hypotheses?: Array<{ label: string; probability: number }>;
    moduleScores?: Array<{
      module: string;
      weight: number;
      score: number;
      completeness: number;
      source?: string;
    }>;
    fusedConfidence?: number;
    modelConfidence?: number;
  };
  gates?: Array<{ gate: string; passed: boolean; reason: string; action?: string }>;
  fieldMetrics?: {
    spad?: number | null;
    plantHeightCm?: number | null;
    shootsPerHill?: number | null;
    shootDiameterMm?: number | null;
    leavesPerShoot?: number | null;
  };
  canopyAudit?: {
    bedFloorVisibilityScore?: number | null;
    weedPressureScore?: number | null;
    canopyClosurePct?: number | null;
    dapExpectedClosurePct?: number | null;
    canopyGapPct?: number | null;
    auditComplete?: boolean;
  };
  waterReading?: {
    irrigationPh?: number | null;
    irrigationEc?: number | null;
    source?: string;
  };
  inputHistory?: {
    days?: number;
    sprayCount?: number;
    fertigationCount?: number;
    warnings?: string[];
    hasRecentActivity?: boolean;
  };
  weatherStress?: {
    heatStress?: number;
    waterStress?: number;
    diseasePressure?: number;
  };
};

const MODULE_LABELS: Record<string, string> = {
  geo: 'Geo / plot',
  photo: 'Photo evidence',
  canopy: 'Canopy audit',
  field: 'Field metrics',
  root: 'Root evidence',
  soil: 'Soil report',
  water: 'Water pH/EC',
  history: 'Input history',
  weather: 'Weather stress',
};

function triageTone(level?: string): string {
  if (level === 'L4') return 'cr-sop-triage--l4';
  if (level === 'L3') return 'cr-sop-triage--l3';
  if (level === 'L2') return 'cr-sop-triage--l2';
  return 'cr-sop-triage--l1';
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function GingerSopReviewPanel({ sop }: { sop: GingerSopV3Detail }) {
  const modules = sop.diagnostics?.moduleScores ?? [];
  const capturedPhotos =
    sop.evidence?.photos?.filter((p) => p.status === 'captured').length ?? 0;
  const fused = sop.diagnostics?.fusedConfidence;

  return (
    <section className="cr-sop-block">
      <div className="cr-sop-head">
        <h3 className="cr-h3">MAIOS v{sop.maiosVersion ?? sop.sopVersion ?? '12.0'}</h3>
        <div className="cr-sop-badges">
          {sop.triage?.level ? (
            <span className={`cr-sop-triage ${triageTone(sop.triage.level)}`}>
              {sop.triage.level}
            </span>
          ) : null}
          {sop.evidence?.tier ? (
            <span className="cr-sop-chip">{sop.evidence.tier}</span>
          ) : null}
          {sop.route ? <span className="cr-sop-chip cr-sop-chip--route">{sop.route}</span> : null}
        </div>
      </div>

      {sop.triage?.reason ? <p className="cr-sop-reason">{sop.triage.reason}</p> : null}

      <div className="cr-sop-grid">
        <div className="cr-sop-card">
          <h4 className="cr-sop-k">Evidence</h4>
          <p className="cr-sop-v">
            {sop.evidence?.completenessPct ?? 0}% complete · EQS {sop.evidence?.eqs ?? '—'} ·{' '}
            {capturedPhotos} photos captured
          </p>
          {fused != null ? (
            <p className="cr-sop-sub">Fused confidence {pct(fused * 100)}</p>
          ) : null}
        </div>

        <div className="cr-sop-card">
          <h4 className="cr-sop-k">Field metrics</h4>
          {sop.fieldMetrics ? (
            <ul className="cr-sop-metrics">
              {sop.fieldMetrics.spad != null ? <li>SPAD {sop.fieldMetrics.spad}</li> : null}
              {sop.fieldMetrics.plantHeightCm != null ? (
                <li>Height {sop.fieldMetrics.plantHeightCm} cm</li>
              ) : null}
              {sop.fieldMetrics.shootsPerHill != null ? (
                <li>Shoots {sop.fieldMetrics.shootsPerHill}/hill</li>
              ) : null}
              {sop.fieldMetrics.leavesPerShoot != null ? (
                <li>Leaves/shoot {sop.fieldMetrics.leavesPerShoot}</li>
              ) : null}
            </ul>
          ) : (
            <p className="cr-muted">No visit measurements yet</p>
          )}
        </div>

        <div className="cr-sop-card">
          <h4 className="cr-sop-k">Canopy audit</h4>
          {sop.canopyAudit?.auditComplete ? (
            <ul className="cr-sop-metrics">
              {sop.canopyAudit.canopyClosurePct != null ? (
                <li>Closure {sop.canopyAudit.canopyClosurePct}%</li>
              ) : null}
              {sop.canopyAudit.dapExpectedClosurePct != null ? (
                <li>Expected {sop.canopyAudit.dapExpectedClosurePct}%</li>
              ) : null}
              {sop.canopyAudit.canopyGapPct != null ? (
                <li>Gap {sop.canopyAudit.canopyGapPct}%</li>
              ) : null}
              {sop.canopyAudit.weedPressureScore != null ? (
                <li>Weed score {sop.canopyAudit.weedPressureScore}/5</li>
              ) : null}
            </ul>
          ) : (
            <p className="cr-muted">Bed/canopy audit pending</p>
          )}
        </div>

        <div className="cr-sop-card">
          <h4 className="cr-sop-k">Water · history</h4>
          <ul className="cr-sop-metrics">
            {sop.waterReading?.irrigationPh != null ? (
              <li>pH {sop.waterReading.irrigationPh}</li>
            ) : null}
            {sop.waterReading?.irrigationEc != null ? (
              <li>EC {sop.waterReading.irrigationEc} dS/m</li>
            ) : null}
            {sop.inputHistory?.hasRecentActivity ? (
              <li>
                {sop.inputHistory.sprayCount ?? 0} sprays · {sop.inputHistory.fertigationCount ?? 0}{' '}
                fertigations ({sop.inputHistory.days ?? 21}d)
              </li>
            ) : (
              <li className="cr-muted">No 21-day input log</li>
            )}
          </ul>
        </div>
      </div>

      {sop.riskTags && sop.riskTags.length > 0 ? (
        <div className="cr-sop-tags">
          {sop.riskTags.map((tag) => (
            <span key={tag} className="cr-sop-risk">
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      ) : null}

      {sop.inputHistory?.warnings && sop.inputHistory.warnings.length > 0 ? (
        <ul className="cr-sop-warnings">
          {sop.inputHistory.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {modules.length > 0 ? (
        <div className="cr-sop-modules">
          <h4 className="cr-sop-k">Module scores</h4>
          <ul className="cr-breakdown cr-breakdown--sop">
            {modules.map((m) => (
              <li key={m.module}>
                <span className="cr-bd-label">
                  {MODULE_LABELS[m.module] ?? m.module}{' '}
                  <span className="cr-muted">w{m.weight}</span>
                </span>
                <div className="cr-bar-track cr-bar-track--sm">
                  <div
                    className={`cr-bar-fill ${m.score >= 70 ? 'cr-bar-fill--green' : 'cr-bar-fill--orange'}`}
                    style={{ width: `${m.score}%` } as CSSProperties}
                  />
                </div>
                <span className="cr-bd-val">{m.score}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sop.diagnostics?.hypotheses && sop.diagnostics.hypotheses.length > 0 ? (
        <div className="cr-sop-hyp">
          <h4 className="cr-sop-k">Differential (top 5)</h4>
          <ol className="cr-sop-hyp-list">
            {sop.diagnostics.hypotheses.slice(0, 5).map((h) => (
              <li key={h.label}>
                {h.label} <span className="cr-muted">{h.probability}%</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {sop.gates && sop.gates.length > 0 ? (
        <div className="cr-sop-gates">
          <h4 className="cr-sop-k">Decision gates</h4>
          <ul>
            {sop.gates.map((g) => (
              <li key={g.gate} className={g.passed ? 'is-pass' : 'is-fail'}>
                <span className="cr-sop-gate-id">{g.gate}</span>
                <span>{g.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
