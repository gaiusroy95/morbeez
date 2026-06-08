import { UNITS } from '../constants';
import { emptyVariant } from '../state';
import { WizardField, pwInputClass, pwSelectClass } from '../WizardField';
import type { WizardFormState, WizardVariant } from '../types';

type Props = {
  state: WizardFormState;
  onChange: (next: WizardFormState) => void;
};

export function Step2VariantsPricing({ state, onChange }: Props) {
  const variants = state.basic.variants;

  function setVariants(next: WizardVariant[]) {
    onChange({ ...state, basic: { ...state.basic, variants: next } });
  }

  function patchVariant(idx: number, partial: Partial<WizardVariant>) {
    const next = [...variants];
    next[idx] = { ...next[idx], ...partial };
    setVariants(next);
  }

  return (
    <div className="pw-step-panel">
      <h2 className="pw-section-title">Variants &amp; Pricing</h2>
      <div className="pw-table-card">
        <table className="pw-variants-table">
          <thead>
            <tr>
              <th>Pack Size</th>
              <th>Unit</th>
              <th>MRP (₹)</th>
              <th>Selling Price (₹)</th>
              <th>Dealer Price (₹)</th>
              <th>Stock</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    className="pw-table-input"
                    value={v.packSize}
                    onChange={(e) => patchVariant(idx, { packSize: e.target.value })}
                    placeholder="250"
                  />
                </td>
                <td>
                  <select
                    className="pw-table-input"
                    value={v.unit}
                    onChange={(e) => patchVariant(idx, { unit: e.target.value })}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="pw-table-input"
                    value={v.mrp}
                    onChange={(e) => patchVariant(idx, { mrp: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="pw-table-input"
                    value={v.sellingPrice}
                    onChange={(e) => patchVariant(idx, { sellingPrice: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="pw-table-input"
                    value={v.dealerPrice}
                    onChange={(e) => patchVariant(idx, { dealerPrice: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="pw-table-input"
                    value={v.stock}
                    onChange={(e) => patchVariant(idx, { stock: e.target.value })}
                    onFocus={(e) => e.target.select()}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="pw-icon-btn"
                    aria-label="Remove variant"
                    onClick={() => {
                      if (variants.length <= 1) return;
                      setVariants(variants.filter((_, i) => i !== idx));
                    }}
                  >
                    ⋮
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="pw-btn pw-btn--outline-sm pw-add-variant"
          onClick={() => setVariants([...variants, emptyVariant()])}
        >
          + Add Variant
        </button>
      </div>

      <h3 className="pw-subtitle">Other Details</h3>
      <div className="pw-grid pw-grid--2">
        <WizardField label="SKU Prefix">
          <input
            className={pwInputClass()}
            value={state.basic.skuPrefix}
            onChange={(e) =>
              onChange({
                ...state,
                basic: { ...state.basic, skuPrefix: e.target.value },
              })
            }
            placeholder="KCH-"
          />
        </WizardField>
        <WizardField label="HSN Code">
          <input
            className={pwInputClass()}
            value={state.basic.hsnCode}
            onChange={(e) =>
              onChange({
                ...state,
                basic: { ...state.basic, hsnCode: e.target.value },
              })
            }
            placeholder="3808"
          />
        </WizardField>
      </div>
    </div>
  );
}
