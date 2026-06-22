import { useMemo, useState } from 'react';
import {
  agronomistClient,
  defaultRecommendationMaterial,
  DOSE_BASIS_OPTIONS,
  DOSE_UNIT_OPTIONS,
  MATERIAL_APPLICATION_MODE_OPTIONS,
  protocolToRecommendationGroups,
  type RecommendationGroupDraft,
} from '@morbeez/shared';
import { Btn, Input, Panel, StaticSelect } from '../../ui';
import type { VisitIssueDraft } from './types';

const APPLICATION_DAYS = [0, 7, 14, 21] as const;
const APPLICATION_TYPES = ['foliar_spray', 'soil_drench', 'granular', 'seed_treatment', 'other'] as const;

type Props = {
  cropType: string;
  issues: VisitIssueDraft[];
  groups: RecommendationGroupDraft[];
  onChange: (groups: RecommendationGroupDraft[]) => void;
};

function newLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function VisitRecPlanningStep({ cropType, issues, groups, onChange }: Props) {
  const [protocolBusy, setProtocolBusy] = useState(false);
  const [protocolMsg, setProtocolMsg] = useState('');
  const issueOptions = useMemo(
    () => issues.map((i) => ({ id: i.localId, label: i.issueName })),
    [issues]
  );

  function addGroup() {
    const issueLocalId = issues[0]?.localId ?? '';
    onChange([
      ...groups,
      {
        localId: newLocalId('grp'),
        applicationType: 'foliar_spray',
        applicationDay: 0,
        sortOrder: groups.length,
        materials: issueLocalId ? [defaultRecommendationMaterial(issueLocalId, newLocalId('mat'))] : [],
      },
    ]);
  }

  function updateGroup(index: number, patch: Partial<RecommendationGroupDraft>) {
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function addMaterial(groupIndex: number) {
    const g = groups[groupIndex];
    if (!g) return;
    const issueLocalId = issues[0]?.localId ?? '';
    updateGroup(groupIndex, {
      materials: [...g.materials, defaultRecommendationMaterial(issueLocalId, newLocalId('mat'))],
    });
  }

  function updateMaterial(
    groupIndex: number,
    matIndex: number,
    patch: Partial<RecommendationGroupDraft['materials'][number]>
  ) {
    const g = groups[groupIndex];
    if (!g) return;
    updateGroup(groupIndex, {
      materials: g.materials.map((m, i) => (i === matIndex ? { ...m, ...patch } : m)),
    });
  }

  async function loadProtocol() {
    const issueLabel = issues[0]?.finalDiagnosis ?? issues[0]?.issueName ?? '';
    const issueLocalId = issues[0]?.localId ?? '';
    if (!issueLocalId) {
      setProtocolMsg('Add an issue before loading a protocol.');
      return;
    }
    setProtocolBusy(true);
    setProtocolMsg('');
    try {
      const protocols = await agronomistClient.listProtocols(cropType);
      const match =
        protocols.find(
          (p) =>
            String(p.status) === 'published' &&
            String(p.issue_label ?? '').toLowerCase() === issueLabel.toLowerCase()
        ) ?? protocols.find((p) => String(p.status) === 'published');
      if (!match) {
        setProtocolMsg('No published protocol found for this crop/issue.');
        return;
      }
      onChange(protocolToRecommendationGroups(match, issueLocalId));
      setProtocolMsg(`Loaded protocol: ${String(match.label)}`);
    } catch (e) {
      setProtocolMsg(e instanceof Error ? e.message : 'Could not load protocol');
    } finally {
      setProtocolBusy(false);
    }
  }

  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Plan recommendation groups with application day and materials (name, dose, qty unit, application mode).
      </p>
      <div className="flex gap-2 items-center flex-wrap">
        <Btn
          variant="secondary"
          size="sm"
          label={protocolBusy ? 'Loading…' : 'Load published protocol'}
          onClick={() => void loadProtocol()}
          disabled={protocolBusy}
        />
        {protocolMsg ? <span className="vw-hint">{protocolMsg}</span> : null}
      </div>
      {groups.map((group, gi) => (
        <Panel key={group.localId} title={`Group ${gi + 1}`}>
          <span className="vw-field-label">Application type</span>
          <div className="vw-chip-row" style={{ marginBottom: 8 }}>
            {APPLICATION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={['vw-chip', group.applicationType === t ? 'vw-chip--active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => updateGroup(gi, { applicationType: t })}
              >
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <span className="vw-field-label">Application day</span>
          <div className="vw-chip-row" style={{ marginBottom: 8 }}>
            {APPLICATION_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={['vw-chip', group.applicationDay === d ? 'vw-chip--active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => updateGroup(gi, { applicationDay: d })}
              >
                Day {d}
              </button>
            ))}
          </div>
          {group.materials.map((mat, mi) => (
            <div key={mat.localId} className="vw-material-box">
              <p className="vw-field-label" style={{ fontWeight: 700, color: '#0f172a' }}>
                Material {mi + 1}
              </p>
              <span className="vw-field-label">Linked issue</span>
              <div className="vw-chip-row" style={{ marginBottom: 8 }}>
                {issueOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={['vw-chip', mat.issueLocalId === opt.id ? 'vw-chip--active' : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => updateMaterial(gi, mi, { issueLocalId: opt.id })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="vw-field-label">Name</span>
              <Input
                placeholder="Product / material name"
                value={mat.technicalName}
                onChange={(e) => updateMaterial(gi, mi, { technicalName: e.target.value })}
              />
              <span className="vw-field-label">Dose</span>
              <Input
                className="mt-1.5"
                placeholder="Quantity (e.g. 2, 500)"
                value={mat.doseQuantity ?? ''}
                onChange={(e) => updateMaterial(gi, mi, { doseQuantity: e.target.value })}
                inputMode="decimal"
              />
              <span className="vw-field-label">Dose per</span>
              <StaticSelect
                className="mt-1.5"
                value={mat.doseBasis ?? ''}
                onChange={(e) =>
                  updateMaterial(gi, mi, {
                    doseBasis: e.target.value as RecommendationGroupDraft['materials'][number]['doseBasis'],
                  })
                }
              >
                <option value="">Select basis</option>
                {DOSE_BASIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </StaticSelect>
              <span className="vw-field-label">Qty unit</span>
              <StaticSelect
                className="mt-1.5"
                value={mat.doseUnit ?? ''}
                onChange={(e) =>
                  updateMaterial(gi, mi, {
                    doseUnit: e.target.value as RecommendationGroupDraft['materials'][number]['doseUnit'],
                  })
                }
              >
                <option value="">Select unit</option>
                {DOSE_UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </StaticSelect>
              <span className="vw-field-label">Application mode</span>
              <StaticSelect
                className="mt-1.5"
                value={mat.applicationMode ?? ''}
                onChange={(e) =>
                  updateMaterial(gi, mi, {
                    applicationMode: e.target
                      .value as RecommendationGroupDraft['materials'][number]['applicationMode'],
                  })
                }
              >
                <option value="">Select mode</option>
                {MATERIAL_APPLICATION_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </StaticSelect>
            </div>
          ))}
          <Btn variant="secondary" size="sm" className="mt-2" onClick={() => addMaterial(gi)}>
            Add material
          </Btn>
        </Panel>
      ))}
      <Btn variant="primary" onClick={addGroup}>
        Add recommendation group
      </Btn>
    </div>
  );
}
