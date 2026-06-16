import { useMemo } from 'react';
import { type RecommendationGroupDraft } from '@morbeez/shared';
import { Btn, Input, Panel } from '../../ui';
import type { VisitIssueDraft } from './types';

const APPLICATION_DAYS = [0, 7, 14, 21] as const;
const APPLICATION_TYPES = ['foliar_spray', 'soil_drench', 'granular', 'seed_treatment', 'other'] as const;

type Props = {
  issues: VisitIssueDraft[];
  groups: RecommendationGroupDraft[];
  onChange: (groups: RecommendationGroupDraft[]) => void;
};

function newLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function VisitRecPlanningStep({ issues, groups, onChange }: Props) {
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
        materials: issueLocalId
          ? [
              {
                localId: newLocalId('mat'),
                issueLocalId,
                category: 'fungicide',
                technicalName: '',
                dose: '',
                method: 'foliar spray',
              },
            ]
          : [],
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
      materials: [
        ...g.materials,
        {
          localId: newLocalId('mat'),
          issueLocalId,
          category: 'fungicide',
          technicalName: '',
          dose: '',
          method: '',
        },
      ],
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

  return (
    <div className="vw-stack">
      <p className="vw-hint">
        Plan recommendation groups with application day, materials, dose, and method.
      </p>
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
              <Input
                placeholder="Product / technical name"
                value={mat.technicalName}
                onChange={(e) => updateMaterial(gi, mi, { technicalName: e.target.value })}
              />
              <Input
                className="mt-1.5"
                placeholder="Dose (e.g. 2 ml/L)"
                value={mat.dose ?? ''}
                onChange={(e) => updateMaterial(gi, mi, { dose: e.target.value })}
              />
              <Input
                className="mt-1.5"
                placeholder="Method"
                value={mat.method ?? ''}
                onChange={(e) => updateMaterial(gi, mi, { method: e.target.value })}
              />
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
