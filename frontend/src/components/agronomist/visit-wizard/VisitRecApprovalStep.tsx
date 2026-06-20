import { useEffect, useState } from 'react';
import { agronomistClient, formatMaterialApplicationMode, formatMaterialDose, type RecommendationGroupDraft } from '@morbeez/shared';
import { Alert, Btn, Panel, textareaClass } from '../../ui';

type Props = {
  groups: RecommendationGroupDraft[];
  approved: boolean;
  overrideReason?: string;
  onApprovedChange: (approved: boolean, overrideReason?: string) => void;
  checkCompatibility?: typeof agronomistClient.checkRecommendationCompatibility;
};

type CompatPair = {
  productA: string;
  productB: string;
  status: string;
  message?: string;
};

export function VisitRecApprovalStep({
  groups,
  approved,
  overrideReason: overrideReasonProp,
  onApprovedChange,
  checkCompatibility = agronomistClient.checkRecommendationCompatibility,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<CompatPair[]>([]);
  const [hasIncompatible, setHasIncompatible] = useState(false);
  const [error, setError] = useState('');
  const [overrideReason, setOverrideReason] = useState(overrideReasonProp ?? '');

  useEffect(() => {
    const materials = groups.flatMap((g) =>
      g.materials.map((m) => ({ technicalName: m.technicalName.trim() })).filter((m) => m.technicalName)
    );
    if (materials.length < 2) {
      setPairs([]);
      setHasIncompatible(false);
      return;
    }
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError('');
      try {
        const r = await checkCompatibility({ materials });
        if (cancelled) return;
        setHasIncompatible(Boolean(r.hasIncompatiblePair));
        setPairs(
          (r.pairs ?? []).map((p) => ({
            productA: String(p.productA ?? ''),
            productB: String(p.productB ?? ''),
            status: String(p.status ?? 'unknown'),
            message: p.message ? String(p.message) : undefined,
          }))
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Compatibility check failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [groups, checkCompatibility]);

  return (
    <div className="vw-stack">
      <Panel title="Recommendation groups">
        {groups.map((g, i) => (
          <div key={g.localId} className="vw-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <p className="vw-row-value" style={{ textAlign: 'left' }}>
              Group {i + 1}: {g.applicationType.replace(/_/g, ' ')} · Day {g.applicationDay}
            </p>
            {g.materials.map((m) => {
              const dose = formatMaterialDose(m);
              const mode = formatMaterialApplicationMode(m.applicationMode);
              return (
                <p key={m.localId} className="vw-hint" style={{ marginTop: 2 }}>
                  • {m.technicalName || 'Unnamed'}
                  {dose ? ` — ${dose}` : ''}
                  {mode ? ` (${mode})` : ''}
                </p>
              );
            })}
          </div>
        ))}
      </Panel>

      <Panel title="Compatibility check">
        {loading ? <p className="vw-hint">Checking product compatibility…</p> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!pairs.length && !loading ? (
          <p className="vw-hint">Add at least two materials to run compatibility checks.</p>
        ) : null}
        {pairs.map((p) => (
          <div key={`${p.productA}-${p.productB}`} className="vw-compat-row">
            <span className="vw-row-value" style={{ textAlign: 'left', flex: 1 }}>
              {p.productA} + {p.productB}
            </span>
            <span
              className={[
                'vw-compat-status',
                p.status === 'not_recommended' ? 'vw-compat-status--bad' : '',
                p.status === 'ok' ? 'vw-compat-status--good' : '',
                p.status !== 'not_recommended' && p.status !== 'ok' ? 'vw-compat-status--warn' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {p.status.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
        {hasIncompatible && !approved ? (
          <p className="vw-banner vw-banner--warn" style={{ marginTop: 8 }}>
            Some products are not recommended together. Approve with override reason if you proceed.
          </p>
        ) : null}
        {hasIncompatible ? (
          <>
            <span className="vw-field-label" style={{ marginTop: 8 }}>
              Override reason
            </span>
            <textarea
              className={textareaClass}
              placeholder="Explain why you are proceeding despite incompatible pairs"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </>
        ) : null}
      </Panel>

      <div className="vw-stack" style={{ gap: 8 }}>
        <Btn
          variant="primary"
          onClick={() => onApprovedChange(true, hasIncompatible ? overrideReason : undefined)}
          disabled={hasIncompatible && !overrideReason.trim()}
        >
          {approved ? 'Approved ✓' : 'Approve recommendations'}
        </Btn>
        <Btn variant="secondary" onClick={() => onApprovedChange(false)}>
          Modify plan
        </Btn>
      </div>
    </div>
  );
}
