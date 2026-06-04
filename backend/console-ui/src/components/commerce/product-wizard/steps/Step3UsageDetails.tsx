import {
  APPLICATION_STAGES,
  CROP_OPTIONS,
  DISEASE_OPTIONS,
  PEST_OPTIONS,
} from '../constants';
import { WizardField, pwInputClass, pwSelectClass } from '../WizardField';
import type { WizardFormState } from '../types';

type Props = {
  state: WizardFormState;
  onChange: (next: WizardFormState) => void;
};

export function Step3UsageDetails({ state, onChange }: Props) {
  const u = state.usage;

  function patchUsage(partial: Partial<typeof u>) {
    const nextUsage = { ...u, ...partial };
    const crops = [...u.crops];
    if (partial.crop && partial.crop && !crops.includes(partial.crop)) {
      crops.push(partial.crop);
    }
    onChange({
      ...state,
      usage: { ...nextUsage, crops: partial.crop ? crops : nextUsage.crops },
    });
  }

  return (
    <div className="pw-step-panel">
      <h2 className="pw-section-title">Crop, Pest &amp; Disease Mapping</h2>
      <div className="pw-grid pw-grid--3">
        <WizardField label="Select Crop" required>
          <select
            className={pwSelectClass()}
            value={u.crop}
            onChange={(e) => patchUsage({ crop: e.target.value })}
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
            value={u.pest}
            onChange={(e) => patchUsage({ pest: e.target.value })}
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
            value={u.disease}
            onChange={(e) => patchUsage({ disease: e.target.value })}
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
          value={u.symptoms}
          onChange={(e) => patchUsage({ symptoms: e.target.value })}
          placeholder="Enter symptoms separated by comma"
        />
      </WizardField>

      <div className="pw-grid pw-grid--2">
        <WizardField label="Dosage / Acre" required>
          <input
            className={pwInputClass()}
            value={u.dosageAcre}
            onChange={(e) => patchUsage({ dosageAcre: e.target.value })}
            placeholder="Enter dosage"
          />
        </WizardField>
        <WizardField label="Dosage / 200L Water">
          <input
            className={pwInputClass()}
            value={u.dosageWater}
            onChange={(e) => patchUsage({ dosageWater: e.target.value })}
            placeholder="Enter dosage"
          />
        </WizardField>
        <WizardField label="Application Stage">
          <select
            className={pwSelectClass()}
            value={u.applicationStage}
            onChange={(e) => patchUsage({ applicationStage: e.target.value })}
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
            value={u.sprayIntervalDays}
            onChange={(e) => patchUsage({ sprayIntervalDays: e.target.value })}
            placeholder="Enter days"
          />
        </WizardField>
      </div>

      <WizardField label="Compatibility" full>
        <input
          className={pwInputClass()}
          value={u.compatibility}
          onChange={(e) => patchUsage({ compatibility: e.target.value })}
          placeholder="Enter compatible products"
        />
      </WizardField>
    </div>
  );
}
