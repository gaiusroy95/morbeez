import { useMemo } from 'react';
import type { MeasurementTemplate } from '@morbeez/shared';
import { Field, Input, Panel } from '../../ui';

type Props = {
  cropType: string;
  templates: MeasurementTemplate[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

const GROUP_ORDER = ['Disease', 'Pest', 'Crop', 'Field', 'Other'] as const;

function measurementGroup(tpl: MeasurementTemplate): (typeof GROUP_ORDER)[number] {
  const key = `${tpl.measurementKey} ${tpl.labelEn}`.toLowerCase();
  if (/disease|incidence|severity|blight|rust|wilt/.test(key)) return 'Disease';
  if (/pest|insect|thrip|mite|count|trap/.test(key)) return 'Pest';
  if (/weed|moisture|soil|ph|ec/.test(key)) return 'Field';
  if (/height|stage|tiller|leaf|canopy|growth|dap/.test(key)) return 'Crop';
  return 'Other';
}

function MeasurementFields({
  templates,
  values,
  onChange,
}: {
  templates: MeasurementTemplate[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {templates.map((tpl) => (
        <div key={tpl.measurementKey}>
          {tpl.inputType === 'select' && Array.isArray(tpl.options) && tpl.options.length ? (
            <>
              <span className="vw-field-label">
                {tpl.labelEn}
                {tpl.required ? ' *' : ''}
              </span>
              <div className="vw-segmented">
                {(tpl.options as string[]).map((opt) => {
                  const active = values[tpl.measurementKey] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={['vw-segment', active ? 'vw-segment--active' : ''].filter(Boolean).join(' ')}
                      onClick={() => onChange(tpl.measurementKey, opt)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <Field label={`${tpl.labelEn}${tpl.unit ? ` (${tpl.unit})` : ''}${tpl.required ? ' *' : ''}`}>
              <Input
                type={tpl.inputType === 'number' ? 'number' : 'text'}
                value={values[tpl.measurementKey] ?? ''}
                onChange={(e) => onChange(tpl.measurementKey, e.target.value)}
              />
            </Field>
          )}
        </div>
      ))}
    </>
  );
}

export function VisitMeasurementsStep({ cropType, templates, values, onChange }: Props) {
  const label = cropType.replace(/_/g, ' ');
  const grouped = useMemo(() => {
    const map = new Map<string, MeasurementTemplate[]>();
    for (const tpl of templates) {
      const group = measurementGroup(tpl);
      const list = map.get(group) ?? [];
      list.push(tpl);
      map.set(group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, templates: map.get(g)! }));
  }, [templates]);

  return (
    <div className="vw-stack">
      <div className="vw-banner vw-banner--info">
        Measurements are grouped by category for the {label} template.
      </div>
      {templates.length ? (
        grouped.map(({ group, templates: groupTemplates }) => (
          <Panel key={group} title={`${group} measurements`}>
            <MeasurementFields templates={groupTemplates} values={values} onChange={onChange} />
          </Panel>
        ))
      ) : (
        <Panel title="Measurements">
          <p className="vw-hint">No measurement template for this crop. Continue to soil & weather.</p>
        </Panel>
      )}
    </div>
  );
}
