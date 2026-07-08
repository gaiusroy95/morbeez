import type { FormEvent } from 'react';
import { StaticSelect } from '../../ui';
import { FieldActivityTypePicker, formPatchFromActivityType } from './FieldActivityTypePicker';
import {
  computeDapFromDates,
  type FieldActivityForm,
  type FieldActivityType,
} from './field-activity-utils';

type Props = {
  open: boolean;
  canWrite: boolean;
  apiBase: string;
  cropType?: string | null;
  plantingDate?: string | null;
  activityTypes: FieldActivityType[];
  form: FieldActivityForm;
  mode?: 'add' | 'edit';
  onFormChange: (
    value:
      | FieldActivityForm
      | ((prev: FieldActivityForm) => FieldActivityForm)
  ) => void;
  onActivityTypesChange: (types: FieldActivityType[]) => void;
  onClose: () => void;
  onSave: (e: FormEvent) => Promise<boolean>;
};

export function AddFieldActivityModal(props: Props) {
  if (!props.open) return null;

  const autoDap = computeDapFromDates(props.plantingDate, props.form.activityDate);
  const dapForDisplay = props.form.dap ? Number(props.form.dap) : autoDap;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await props.onSave(e);
    if (ok) props.onClose();
  }

  return (
    <div
      className="fa-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fa-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="fa-modal">
        <header className="fa-modal-header">
          <h2 id="fa-modal-title" className="fa-modal-title">
            {props.mode === 'edit' ? 'Edit Field Activity' : 'Add Field Activity'}
          </h2>
          <button
            type="button"
            className="fa-modal-close"
            aria-label="Close"
            onClick={props.onClose}
          >
            ×
          </button>
        </header>

        <form className="fa-modal-body" onSubmit={(e) => void handleSubmit(e)}>
          <FieldActivityTypePicker
            label="Activity Type"
            required
            disabled={!props.canWrite}
            apiBase={props.apiBase}
            cropType={props.cropType}
            types={props.activityTypes}
            value={props.form.activityTypeId}
            onTypeCreated={(type) => {
              props.onActivityTypesChange([...props.activityTypes, type]);
            }}
            onChange={(type) => {
              if (!type) return;
              props.onFormChange((f) => ({
                ...f,
                ...formPatchFromActivityType(type, f),
              }));
            }}
          />

          <div className="fa-modal-row">
            <label className="fa-field">
              <span className="fa-field-label">Activity Date *</span>
              <input
                type="date"
                className="fa-input"
                value={props.form.activityDate}
                onChange={(e) => props.onFormChange((f) => ({ ...f, activityDate: e.target.value }))}
                required
              />
            </label>
            <label className="fa-field">
              <span className="fa-field-label">DAP</span>
              <div className="fa-input fa-input--readonly">
                {dapForDisplay == null ? 'auto' : String(dapForDisplay)}
              </div>
            </label>
          </div>

          <label className="fa-field">
            <span className="fa-field-label">Notes</span>
            <textarea
              className="fa-textarea"
              value={props.form.notes}
              placeholder="Enter activity notes…"
              onChange={(e) => props.onFormChange((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>

          <label className="fa-field">
            <span className="fa-field-label">Cost (₹)</span>
            <div className="fa-cost-wrap">
              <span className="fa-cost-prefix">₹</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="fa-input fa-input--cost"
                value={props.form.costInr}
                placeholder="Enter cost (optional)"
                onChange={(e) => props.onFormChange((f) => ({ ...f, costInr: e.target.value }))}
              />
            </div>
          </label>

          <div className="fa-field">
            <span className="fa-field-label">Follow-up Required</span>
            <div className="fa-toggle">
              <button
                type="button"
                className={`fa-toggle-btn ${props.form.followUpRequired ? 'fa-toggle-btn--active' : ''}`}
                onClick={() => props.onFormChange((f) => ({ ...f, followUpRequired: true }))}
              >
                Yes
              </button>
              <button
                type="button"
                className={`fa-toggle-btn ${!props.form.followUpRequired ? 'fa-toggle-btn--active-no' : ''}`}
                onClick={() =>
                  props.onFormChange((f) => ({ ...f, followUpRequired: false, followUpDate: '' }))
                }
              >
                No
              </button>
            </div>
          </div>

          {props.form.followUpRequired ? (
            <label className="fa-field">
              <span className="fa-field-label">Follow-up Date</span>
              <input
                type="date"
                className="fa-input"
                value={props.form.followUpDate}
                onChange={(e) => props.onFormChange((f) => ({ ...f, followUpDate: e.target.value }))}
              />
            </label>
          ) : null}

          <StaticSelect
            label="Status"
            className="fa-input"
            value={props.form.status}
            onChange={(value) => props.onFormChange((f) => ({ ...f, status: value }))}
            options={[
              { value: 'completed', label: 'Completed' },
              { value: 'pending', label: 'Pending' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />

          <button
            type="submit"
            disabled={!props.canWrite || !props.form.activityTypeId}
            className="fa-save-btn"
          >
            Save Activity
          </button>
        </form>
      </div>
    </div>
  );
}