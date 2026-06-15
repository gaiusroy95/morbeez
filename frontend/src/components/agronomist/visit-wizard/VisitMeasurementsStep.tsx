import type { MeasurementTemplate } from '@morbeez/shared';
import { Field, Input, Panel } from '../../ui';

type Props = {
  cropType: string;
  templates: MeasurementTemplate[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

export function VisitMeasurementsStep({ cropType, templates, values, onChange }: Props) {
  const label = cropType.replace(/_/g, ' ');

  return (
    <div className="vw-stack">
      <div className="vw-banner vw-banner--info">
        Measurements are based on the {label} template.
      </div>
      {templates.length ? (
        <Panel title="Measurements">
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
        </Panel>
      ) : (
        <Panel title="Measurements">
          <p className="vw-hint">No measurement template for this crop. Continue to issues.</p>
        </Panel>
      )}
    </div>
  );
}
