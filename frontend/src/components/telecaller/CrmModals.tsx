import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field, Modal, inputClass } from '../Modal';
import { SearchSelect, StaticSelect } from '../ui';
import { MasterSelect } from './MasterSelect';
import { InteractionTypePicker } from './InteractionTypePicker';
import { FieldActivityTypePicker } from '../operations/field-activities/FieldActivityTypePicker';
import type { FieldActivityType } from '../operations/field-activities/field-activity-utils';
import { CRM_WORKFLOW_STATUSES, type CrmWorkflowStatus } from './crmInteractionTypes';
import {
  EMPTY_STRUCTURED_FINDING,
  StructuredFieldFindingFields,
  structuredFindingToPayload,
  validateStructuredFinding,
  type StructuredFieldFindingValues,
} from './StructuredFieldFindingFields';

const base = '/morbeez-staff/api/v1/os/telecaller';
const telecallerBase = '/morbeez-staff/api/v1/os/telecaller';

export type CrmModalType =
  | 'block'
  | 'interaction'
  | 'recommendation'
  | 'finding'
  | 'order'
  | 'call'
  | 'task'
  | 'visit'
  | 'note'
  | null;

type BlockOption = { id: string; name: string; cropName?: string };

type Props = {
  type: CrmModalType;
  leadId: string;
  blocks: BlockOption[];
  onClose: () => void;
  onSaved: () => void;
};

export function CrmModals({ type, leadId, blocks, onClose, onSaved }: Props) {
  if (!type) return null;

  if (type === 'block') return <AddBlockModal leadId={leadId} onClose={onClose} onSaved={onSaved} />;
  if (type === 'interaction')
    return <AddInteractionModal leadId={leadId} blocks={blocks} onClose={onClose} onSaved={onSaved} />;
  if (type === 'recommendation')
    return (
      <AddRecommendationModal leadId={leadId} blocks={blocks} onClose={onClose} onSaved={onSaved} />
    );
  if (type === 'finding')
    return <AddFieldFindingModal leadId={leadId} blocks={blocks} onClose={onClose} onSaved={onSaved} />;
  if (type === 'order')
    return <NewOrderModal leadId={leadId} blocks={blocks} onClose={onClose} onSaved={onSaved} />;
  if (type === 'call') return <LogCallModal leadId={leadId} onClose={onClose} onSaved={onSaved} />;
  if (type === 'task') return <AddTaskModal leadId={leadId} onClose={onClose} onSaved={onSaved} />;
  if (type === 'visit')
    return <ScheduleVisitModal leadId={leadId} blocks={blocks} onClose={onClose} onSaved={onSaved} />;
  if (type === 'note') return <AddNoteModal leadId={leadId} onClose={onClose} onSaved={onSaved} />;
  return null;
}

function useSubmit(onSaved: () => void, onClose: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function run(fn: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await fn();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return { saving, error, run };
}

function AddBlockModal({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [cropId, setCropId] = useState('');
  const [cropName, setCropName] = useState('');
  const [irrigationId, setIrrigationId] = useState('');
  const [soilId, setSoilId] = useState('');
  const [variety, setVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  return (
    <Modal
      title="Add farm block"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          if (!name.trim()) throw new Error('Block name is required');
          if (!cropName.trim() && !cropId) throw new Error('Select a crop');
          await api(`${base}/leads/${leadId}/blocks`, {
            method: 'POST',
            body: JSON.stringify({
              name: name.trim(),
              area: area.trim() || undefined,
              cropId: cropId || undefined,
              cropName: cropName.trim() || undefined,
              varietyName: variety.trim() || undefined,
              irrigationTypeId: irrigationId || undefined,
              soilTypeId: soilId || undefined,
              plantingDate: plantingDate || undefined,
            }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Block name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Area">
          <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="2.1 acre" />
        </Field>
        <MasterSelect
          masterType="crop"
          label="Crop"
          value={cropId}
          onChange={(id, n) => {
            setCropId(id);
            setCropName(n);
          }}
        />
        <Field label="Variety">
          <input className={inputClass} value={variety} onChange={(e) => setVariety(e.target.value)} />
        </Field>
        <MasterSelect
          masterType="irrigation_type"
          label="Irrigation"
          value={irrigationId}
          onChange={(id) => setIrrigationId(id)}
        />
        <MasterSelect
          masterType="soil_type"
          label="Soil type"
          value={soilId}
          onChange={(id) => setSoilId(id)}
        />
        <Field label="Planting date" className="sm:col-span-2">
          <input
            type="date"
            className={inputClass}
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function AddInteractionModal({
  leadId,
  blocks,
  onClose,
  onSaved,
}: {
  leadId: string;
  blocks: BlockOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [interactionType, setInteractionType] = useState('');
  const [interactionTypeName, setInteractionTypeName] = useState('');
  const [blockId, setBlockId] = useState('');
  const [summary, setSummary] = useState('');
  const [interactionDate, setInteractionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addFieldFinding, setAddFieldFinding] = useState(false);
  const [structuredFinding, setStructuredFinding] =
    useState<StructuredFieldFindingValues>(EMPTY_STRUCTURED_FINDING);
  const [addFieldActivity, setAddFieldActivity] = useState(false);
  const [fieldActivityTypeId, setFieldActivityTypeId] = useState('');
  const [fieldActivityLabel, setFieldActivityLabel] = useState('');
  const [fieldActivityDate, setFieldActivityDate] = useState('');
  const [fieldActivityTypes, setFieldActivityTypes] = useState<FieldActivityType[]>([]);
  const [escalate, setEscalate] = useState(false);
  const [recommendationCompleted, setRecommendationCompleted] = useState(false);
  const [recommendationSummary, setRecommendationSummary] = useState('');
  const [outcomeId, setOutcomeId] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextActionId, setNextActionId] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<CrmWorkflowStatus>('Closed');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  const selectedBlock = blocks.find((b) => b.id === blockId);

  useEffect(() => {
    if (!addFieldActivity || !blockId) {
      setFieldActivityTypes([]);
      return;
    }
    const cropType = selectedBlock?.cropName ?? '';
    void api<{ ok: boolean; types: FieldActivityType[] }>(
      `${telecallerBase}/leads/${leadId}/field-activity-types?cropType=${encodeURIComponent(cropType)}&activeOnly=true`
    )
      .then((res) => setFieldActivityTypes(res.types ?? []))
      .catch(() => setFieldActivityTypes([]));
  }, [addFieldActivity, blockId, selectedBlock?.cropName, leadId]);

  return (
    <Modal
      title="Add interaction"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          if (!interactionTypeName.trim()) throw new Error('Interaction type is required');
          if (!summary.trim()) throw new Error('Summary is required');
          if ((addFieldFinding || addFieldActivity) && !blockId) {
            throw new Error('Select a block for field finding or activity');
          }
          if (addFieldFinding) {
            const findingErr = validateStructuredFinding(structuredFinding);
            if (findingErr) throw new Error(findingErr);
          }
          if (addFieldActivity && !fieldActivityDate) {
            throw new Error('Field activity date is required');
          }
          const findingPayload = addFieldFinding ? structuredFindingToPayload(structuredFinding) : null;
          const effectiveWorkflow: CrmWorkflowStatus = escalate
            ? 'Escalated'
            : workflowStatus === 'Closed' && nextAction.trim()
              ? 'Active'
              : workflowStatus;
          await api(`${base}/leads/${leadId}/interactions`, {
            method: 'POST',
            body: JSON.stringify({
              interactionType: interactionTypeName.trim(),
              blockId: blockId || undefined,
              summary: summary.trim(),
              interactionAt: interactionDate
                ? new Date(`${interactionDate}T12:00:00`).toISOString()
                : undefined,
              outcome: outcome.trim() || undefined,
              nextAction: nextAction.trim() || undefined,
              nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : undefined,
              workflowStatus: effectiveWorkflow,
              addFieldFinding,
              ...(findingPayload ?? {}),
              fieldActivityLabel: addFieldActivity ? fieldActivityLabel.trim() || undefined : undefined,
              fieldActivityTypeId: addFieldActivity ? fieldActivityTypeId || undefined : undefined,
              fieldActivityDate: addFieldActivity ? fieldActivityDate : undefined,
              addFieldActivity,
              recommendationSummary: recommendationCompleted
                ? recommendationSummary.trim() || summary.trim()
                : undefined,
              recommendationCompleted,
              escalate,
            }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        <InteractionTypePicker
          value={interactionType}
          onChange={(id, name) => {
            setInteractionType(id);
            setInteractionTypeName(name);
          }}
          required
        />
        <Field label="Interaction date">
          <input
            type="date"
            className={inputClass}
            value={interactionDate}
            onChange={(e) => setInteractionDate(e.target.value)}
          />
        </Field>
        <Field label="Block">
          <StaticSelect
            className={inputClass}
            value={blockId}
            onChange={setBlockId}
            options={[
              { value: '', label: '— None —' },
              ...blocks.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Field>
        <Field label="Summary">
          <textarea
            className={inputClass}
            rows={3}
            value={summary}
            placeholder="Communication summary for this operational session…"
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>

        <div className="tc-ix-form-checks space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addFieldFinding}
              onChange={(e) => setAddFieldFinding(e.target.checked)}
            />
            Add field finding
          </label>
          {addFieldFinding ? (
            <StructuredFieldFindingFields
              values={structuredFinding}
              cropType={selectedBlock?.cropName}
              diagnosisApiBase={base}
              onChange={(patch) => setStructuredFinding((prev) => ({ ...prev, ...patch }))}
            />
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addFieldActivity}
              onChange={(e) => setAddFieldActivity(e.target.checked)}
            />
            Add field activity
          </label>
          {addFieldActivity ? (
            <>
              <FieldActivityTypePicker
                label="Field activity"
                types={fieldActivityTypes}
                value={fieldActivityTypeId}
                cropType={selectedBlock?.cropName}
                apiBase={`${telecallerBase}/leads/${leadId}`}
                onChange={(type) => {
                  setFieldActivityTypeId(type?.id ?? '');
                  setFieldActivityLabel(type?.activity_name ?? '');
                }}
                onTypeCreated={(type) => {
                  setFieldActivityTypes((prev) => [...prev, type]);
                  setFieldActivityTypeId(type.id);
                  setFieldActivityLabel(type.activity_name);
                }}
              />
              <Field label="Activity date (independent from interaction date)">
                <input
                  type="date"
                  className={inputClass}
                  value={fieldActivityDate}
                  onChange={(e) => setFieldActivityDate(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={escalate} onChange={(e) => setEscalate(e.target.checked)} />
            Escalate
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recommendationCompleted}
              onChange={(e) => setRecommendationCompleted(e.target.checked)}
            />
            Recommendation completed
          </label>
          {recommendationCompleted ? (
            <Field label="Recommendation">
              <textarea
                className={inputClass}
                rows={2}
                value={recommendationSummary}
                placeholder="Technical / product recommendation summary…"
                onChange={(e) => setRecommendationSummary(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <MasterSelect
          masterType="interaction_outcome"
          label="Interaction outcome"
          value={outcomeId}
          onChange={(id, name) => {
            setOutcomeId(id);
            setOutcome(name);
          }}
        />
        <MasterSelect
          masterType="interaction_next_action"
          label="Next action"
          value={nextActionId}
          onChange={(id, name) => {
            setNextActionId(id);
            setNextAction(name);
            if (name.trim() && workflowStatus === 'Closed') setWorkflowStatus('Active');
          }}
        />
        <Field label="Workflow status">
          <StaticSelect
            className={inputClass}
            value={escalate ? 'Escalated' : workflowStatus}
            disabled={escalate}
            onChange={(value) => setWorkflowStatus(value as CrmWorkflowStatus)}
            options={CRM_WORKFLOW_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Next action due (optional — or auto from &quot;after N days&quot;)">
          <input
            type="datetime-local"
            className={inputClass}
            value={nextActionAt}
            onChange={(e) => setNextActionAt(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function AddRecommendationModal({
  leadId,
  blocks,
  onClose,
  onSaved,
}: {
  leadId: string;
  blocks: BlockOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [blockId, setBlockId] = useState('');
  const [problem, setProblem] = useState('');
  const [text, setText] = useState('');
  const [dosage, setDosage] = useState('');
  const [methodId, setMethodId] = useState('');
  const [methodName, setMethodName] = useState('');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  return (
    <Modal
      title="Add recommendation"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          if (!text.trim()) throw new Error('Recommendation text is required');
          await api(`${base}/leads/${leadId}/recommendations`, {
            method: 'POST',
            body: JSON.stringify({
              blockId: blockId || undefined,
              problem: problem.trim() || undefined,
              recommendation: text.trim(),
              dosage: dosage.trim() || undefined,
              applicationMethod: methodName.trim() || undefined,
              recType: 'agronomist',
            }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        <Field label="Block">
          <StaticSelect
            className={inputClass}
            value={blockId}
            onChange={setBlockId}
            options={[
              { value: '', label: '— None —' },
              ...blocks.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Field>
        <Field label="Problem / need">
          <input className={inputClass} value={problem} onChange={(e) => setProblem(e.target.value)} />
        </Field>
        <Field label="Recommendation">
          <textarea className={inputClass} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="Dosage">
          <input className={inputClass} value={dosage} onChange={(e) => setDosage(e.target.value)} />
        </Field>
        <MasterSelect
          masterType="application_method"
          label="Application method"
          value={methodId}
          onChange={(id, n) => {
            setMethodId(id);
            setMethodName(n);
          }}
        />
      </div>
    </Modal>
  );
}

function AddFieldFindingModal({
  leadId,
  blocks,
  onClose,
  onSaved,
}: {
  leadId: string;
  blocks: BlockOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [blockId, setBlockId] = useState(blocks[0]?.id ?? '');
  const [structuredFinding, setStructuredFinding] =
    useState<StructuredFieldFindingValues>(EMPTY_STRUCTURED_FINDING);
  const { saving, error, run } = useSubmit(onSaved, onClose);

  const block = blocks.find((b) => b.id === blockId);

  return (
    <Modal
      title="Add field finding"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          if (!block) throw new Error('Select a block');
          const findingErr = validateStructuredFinding(structuredFinding);
          if (findingErr) throw new Error(findingErr);
          const payload = structuredFindingToPayload(structuredFinding);
          await api(`${base}/leads/${leadId}/field-findings`, {
            method: 'POST',
            body: JSON.stringify({
              blockId: block.id,
              blockName: block.name,
              cropType: block.cropName ?? '—',
              ...payload,
            }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        <Field label="Block">
          <StaticSelect
            className={inputClass}
            value={blockId}
            onChange={setBlockId}
            options={blocks.map((b) => ({
              value: b.id,
              label: `${b.name} — ${b.cropName ?? 'crop'}`,
            }))}
          />
        </Field>
        <StructuredFieldFindingFields
          values={structuredFinding}
          cropType={block?.cropName}
          diagnosisApiBase={base}
          onChange={(patch) => setStructuredFinding((prev) => ({ ...prev, ...patch }))}
        />
      </div>
    </Modal>
  );
}

type CatalogItem = { variantId?: number; title: string; price: number };

function NewOrderModal({
  leadId,
  blocks,
  onClose,
  onSaved,
}: {
  leadId: string;
  blocks: BlockOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [variantKey, setVariantKey] = useState('');
  const [title, setTitle] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [blockId, setBlockId] = useState('');
  const [address, setAddress] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentName, setPaymentName] = useState('');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  useEffect(() => {
    api<{ ok: boolean; items: CatalogItem[] }>(`${base}/orders/catalog`)
      .then((d) => setCatalog(d.items ?? []))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    const item = catalog.find((c) => String(c.variantId) === variantKey);
    if (item) {
      setTitle(item.title);
      setPrice(String(item.price));
    }
  }, [variantKey, catalog]);

  return (
    <Modal
      title="New order"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          const lineTitle = title.trim() || 'Product';
          const unitPrice = Number(price) || 0;
          const quantity = Number(qty) || 1;
          await api(`${base}/leads/${leadId}/orders`, {
            method: 'POST',
            body: JSON.stringify({
              blockId: blockId || undefined,
              lineItems: [
                {
                  variantId: variantKey ? Number(variantKey) : undefined,
                  title: lineTitle,
                  quantity,
                  price: unitPrice,
                },
              ],
              paymentMode: paymentName.trim() || undefined,
              deliveryAddress: address.trim() || undefined,
            }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        {catalog.length > 0 ? (
          <Field label="Catalog product">
            <SearchSelect
              className={inputClass}
              value={variantKey}
              onChange={setVariantKey}
              options={[
                { value: '', label: 'Custom' },
                ...catalog.map((c) => ({
                  value: String(c.variantId),
                  label: `${c.title} — ₹${c.price}`,
                })),
              ]}
            />
          </Field>
        ) : null}
        <Field label="Product title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty">
            <input type="number" min={1} className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Unit price (₹)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Block">
          <StaticSelect
            className={inputClass}
            value={blockId}
            onChange={setBlockId}
            options={[
              { value: '', label: '—' },
              ...blocks.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Field>
        <MasterSelect
          masterType="payment_mode"
          label="Payment mode"
          value={paymentId}
          onChange={(id, n) => {
            setPaymentId(id);
            setPaymentName(n);
          }}
        />
        <Field label="Delivery address">
          <textarea className={inputClass} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function LogCallModal({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [outcomeId, setOutcomeId] = useState('');
  const [outcome, setOutcome] = useState('answered');
  const [notes, setNotes] = useState('');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  return (
    <Modal
      title="Log call"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          await api(`${base}/leads/${leadId}/calls`, {
            method: 'POST',
            body: JSON.stringify({ outcome, notes: notes.trim() || undefined }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        <MasterSelect
          masterType="interaction_outcome"
          label="Outcome"
          value={outcomeId}
          displayValue={outcome.replace(/_/g, ' ')}
          onChange={(id, name) => {
            setOutcomeId(id);
            setOutcome(name);
          }}
          apiBase={`${base}/masters`}
        />
        <Field label="Notes">
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function defaultDueTodayLocal(): string {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AddNoteModal({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState('');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  return (
    <Modal
      title="Add note"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          const text = note.trim();
          if (!text) throw new Error('Note is required');
          await api(`${base}/leads/${leadId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ note: text }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <Field label="Note">
        <textarea
          className={inputClass}
          rows={6}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note for this farmer…"
        />
      </Field>
    </Modal>
  );
}

function AddTaskModal({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('Follow-up call');
  const [dueAt, setDueAt] = useState(defaultDueTodayLocal);
  const [notes, setNotes] = useState('');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  return (
    <Modal
      title="Schedule follow-up"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          await api(`${base}/leads/${leadId}/tasks`, {
            method: 'POST',
            body: JSON.stringify({
              title: title.trim(),
              dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
              notes: notes.trim() || undefined,
              taskType: 'follow_up',
            }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        <Field label="Title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Due">
          <input
            type="datetime-local"
            className={inputClass}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Follow-ups due today appear in your CRM notifications when you open the workspace.
          </p>
        </Field>
        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ScheduleVisitModal({
  leadId,
  blocks,
  onClose,
  onSaved,
}: {
  leadId: string;
  blocks: BlockOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultDue = new Date(Date.now() + 2 * 86400000);
  defaultDue.setMinutes(0, 0, 0);
  const [title, setTitle] = useState('Field visit');
  const [dueAt, setDueAt] = useState(defaultDue.toISOString().slice(0, 16));
  const [blockId, setBlockId] = useState('');
  const [notes, setNotes] = useState('');
  const { saving, error, run } = useSubmit(onSaved, onClose);

  return (
    <Modal
      title="Schedule field visit"
      onClose={onClose}
      saving={saving}
      onSave={() =>
        run(async () => {
          await api(`${base}/leads/${leadId}/schedule-visit`, {
            method: 'POST',
            body: JSON.stringify({
              title: title.trim(),
              dueAt: new Date(dueAt).toISOString(),
              blockId: blockId || undefined,
              notes: notes.trim() || undefined,
            }),
          });
        })
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        <Field label="Title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Date & time">
          <input
            type="datetime-local"
            className={inputClass}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>
        <Field label="Block">
          <StaticSelect
            className={inputClass}
            value={blockId}
            onChange={setBlockId}
            options={[
              { value: '', label: '—' },
              ...blocks.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Field>
        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
