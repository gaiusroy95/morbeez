import {
  APPLICATION_STAGES,
  CROP_OPTIONS,
  DISEASE_OPTIONS,
  PEST_OPTIONS,
} from '../constants';
import { emptyCropMapping, type CropMappingEntry } from '../cropMapping';
import { WizardField, pwInputClass, pwSelectClass } from '../WizardField';
import type { WizardFormState } from '../types';

type Props = {
  state: WizardFormState;
  onChange: (next: WizardFormState) => void;
};

export function Step3UsageDetails({ state, onChange }: Props) {
  const mappings = state.usage.cropMappings;

  function setMappings(next: CropMappingEntry[]) {
    onChange({ ...state, usage: { cropMappings: next } });
  }

  function patchMapping(id: string, partial: Partial<CropMappingEntry>) {
    setMappings(
      mappings.map((m) => (m.id === id ? { ...m, ...partial } : m))
    );
  }

  function addMapping() {
    setMappings([...mappings, emptyCropMapping()]);
  }

  function removeMapping(id: string) {
    if (mappings.length <= 1) return;
    setMappings(mappings.filter((m) => m.id !== id));
  }

  return (
    <div className="pw-step-panel">
      <div className="pw-crop-mapping-header">
        <h2 className="pw-section-title">Crop, Pest &amp; Disease Mapping</h2>
        <button type="button" className="pw-btn pw-btn--ghost pw-btn--sm" onClick={addMapping}>
          + Add crop mapping
        </button>
      </div>

      <div className="pw-crop-mapping-list">
        {mappings.map((m, index) => (
          <section key={m.id} className="pw-crop-mapping-card">
            <div className="pw-crop-mapping-card-head">
              <h3 className="pw-crop-mapping-card-title">
                Crop mapping {index + 1}
                {m.crop ? ` — ${m.crop}` : ''}
              </h3>
              {mappings.length > 1 ? (
                <button
                  type="button"
                  className="pw-btn pw-btn--ghost pw-btn--sm pw-crop-mapping-remove"
                  onClick={() => removeMapping(m.id)}
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="pw-grid pw-grid--3">
              <WizardField label="Select Crop" required>
                <select
                  className={pwSelectClass()}
                  value={m.crop}
                  onChange={(e) => patchMapping(m.id, { crop: e.target.value })}
                >
                  <option value="">Select crop</option>
                  {CROP_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </WizardField>
              <WizardField label="Select Pest">
                <select
                  className={pwSelectClass()}
                  value={m.pest}
                  onChange={(e) => patchMapping(m.id, { pest: e.target.value })}
                >
                  <option value="">Select pest</option>
                  {PEST_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </WizardField>
              <WizardField label="Select Disease">
                <select
                  className={pwSelectClass()}
                  value={m.disease}
                  onChange={(e) => patchMapping(m.id, { disease: e.target.value })}
                >
                  <option value="">Select disease</option>
                  {DISEASE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </WizardField>
            </div>

            <WizardField label="Symptoms (Keywords)" full>
              <input
                className={pwInputClass()}
                value={m.symptoms}
                onChange={(e) => patchMapping(m.id, { symptoms: e.target.value })}
                placeholder="Enter symptoms separated by comma"
              />
            </WizardField>

            <div className="pw-grid pw-grid--2">
              <WizardField label="Dosage / Acre" required>
                <input
                  className={pwInputClass()}
                  value={m.dosageAcre}
                  onChange={(e) => patchMapping(m.id, { dosageAcre: e.target.value })}
                  placeholder="Enter dosage"
                />
              </WizardField>
              <WizardField label="Dosage / 200L Water">
                <input
                  className={pwInputClass()}
                  value={m.dosageWater}
                  onChange={(e) => patchMapping(m.id, { dosageWater: e.target.value })}
                  placeholder="Enter dosage"
                />
              </WizardField>
              <WizardField label="Application Stage">
                <select
                  className={pwSelectClass()}
                  value={m.applicationStage}
                  onChange={(e) => patchMapping(m.id, { applicationStage: e.target.value })}
                >
                  <option value="">Select stage</option>
                  {APPLICATION_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </WizardField>
              <WizardField label="Spray Interval (Days)">
                <input
                  className={pwInputClass()}
                  value={m.sprayIntervalDays}
                  onChange={(e) => patchMapping(m.id, { sprayIntervalDays: e.target.value })}
                  placeholder="Enter days"
                />
              </WizardField>
            </div>

            <WizardField label="Compatibility" full>
              <input
                className={pwInputClass()}
                value={m.compatibility}
                onChange={(e) => patchMapping(m.id, { compatibility: e.target.value })}
                placeholder="Enter compatible products"
              />
            </WizardField>
          </section>
        ))}
      </div>
    </div>
  );
}
