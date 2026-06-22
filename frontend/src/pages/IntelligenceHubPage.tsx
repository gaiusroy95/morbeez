import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useSyncConsoleSearchMode } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import { matchesSearch } from '../lib/search-filter';
import { PincodeLookupPage } from './PincodeLookupPage';
import { Field, Modal, inputClass } from '../components/Modal';
import { Alert, HubTabs, PageShell, ReadOnlyBanner, StaticSelect } from '../components/ui';

const base = '/morbeez-staff/api/v1/os/intelligence';
const CROPS = ['ginger', 'banana', 'cardamom', 'pepper', 'tomato', 'chilli', 'brinjal', 'all'];

type ProtocolMaterial = {
  technicalName: string;
  doseQuantity: string;
  doseUnit: string;
  doseBasis: string;
  applicationMode: string;
};

type ProtocolStage = {
  day: number;
  applicationType: string;
  materials: ProtocolMaterial[];
};

const DEFAULT_MATERIAL: ProtocolMaterial = {
  technicalName: '',
  doseQuantity: '',
  doseUnit: 'KG',
  doseBasis: 'per_200_ltr_water',
  applicationMode: 'foliar_spray',
};

const DEFAULT_STAGE: ProtocolStage = {
  day: 0,
  applicationType: 'foliar_spray',
  materials: [{ ...DEFAULT_MATERIAL }],
};

type Tab =
  | 'pincode'
  | 'weather'
  | 'cultivation'
  | 'templates'
  | 'spray'
  | 'rotation'
  | 'protocols'
  | 'experiments';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'pincode', label: 'Pincode' },
  { id: 'weather', label: 'Weather rules' },
  { id: 'cultivation', label: 'Cultivation tasks' },
  { id: 'templates', label: 'Rec. templates' },
  { id: 'protocols', label: 'Protocol builder' },
  { id: 'experiments', label: 'A/B experiments' },
  { id: 'spray', label: 'Spray compatibility' },
  { id: 'rotation', label: 'Resistance rotation' },
];

function isIntelligenceTab(value: string | null): value is Tab {
  return TABS.some((t) => t.id === value);
}

export function IntelligenceHubPage({ canWrite }: { canWrite: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(() => (isIntelligenceTab(tabFromUrl) ? tabFromUrl : 'weather'));
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const searchDefaults = defaultsForPage('intelligence');
  useSyncConsoleSearchMode(
    tab === 'pincode' ? 'none' : 'local',
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search rules, templates, tasks…'
  );

  useEffect(() => {
    if (isIntelligenceTab(tabFromUrl)) setTab(tabFromUrl);
  }, [tabFromUrl]);

  const onTabChange = useCallback(
    (next: Tab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams);
      if (next === 'weather') params.delete('tab');
      else params.set('tab', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ resource: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [weatherRules, setWeatherRules] = useState<Array<Record<string, unknown>>>([]);
  const [cultTasks, setCultTasks] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [sprayRules, setSprayRules] = useState<Array<Record<string, unknown>>>([]);
  const [rotation, setRotation] = useState<Array<Record<string, unknown>>>([]);
  const [protocols, setProtocols] = useState<Array<Record<string, unknown>>>([]);
  const [experiments, setExperiments] = useState<Array<Record<string, unknown>>>([]);
  const [protocolDraft, setProtocolDraft] = useState({
    cropType: 'ginger',
    issueLabel: '',
    label: '',
    stages: [{ ...DEFAULT_STAGE, materials: [{ ...DEFAULT_MATERIAL }] }] as ProtocolStage[],
  });
  const [experimentDraft, setExperimentDraft] = useState({
    experimentKey: '',
    label: '',
    hypothesis: '',
    variants: 'control,treatment',
  });
  const [protocolSaving, setProtocolSaving] = useState(false);
  const [editingProtocolId, setEditingProtocolId] = useState<string | null>(null);

  function filterRows(rows: Array<Record<string, unknown>>) {
    if (!search.trim()) return rows;
    return rows.filter((r) =>
      matchesSearch(
        search,
        ...Object.values(r).map((v) =>
          v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
        )
      )
    );
  }

  const visibleWeatherRules = useMemo(() => filterRows(weatherRules), [weatherRules, search]);
  const visibleCultTasks = useMemo(() => filterRows(cultTasks), [cultTasks, search]);
  const visibleTemplates = useMemo(() => filterRows(templates), [templates, search]);
  const visibleSprayRules = useMemo(() => filterRows(sprayRules), [sprayRules, search]);
  const visibleRotation = useMemo(() => filterRows(rotation), [rotation, search]);

  const [modal, setModal] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);

  const bump = () => setReloadKey((k) => k + 1);

  const load = useCallback(async () => {
    if (tab === 'pincode') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const cropQ = cropFilter ? `&crop=${encodeURIComponent(cropFilter)}` : '';
    try {
      if (tab === 'weather') {
        const d = await api<{ ok: boolean; rules: Array<Record<string, unknown>> }>(
          `${base}/weather-rules?status=all${cropQ}`
        );
        setWeatherRules(d.rules ?? []);
      } else if (tab === 'cultivation') {
        const d = await api<{ ok: boolean; tasks: Array<Record<string, unknown>> }>(
          `${base}/cultivation-tasks?${cropQ.replace('&', '')}`
        );
        setCultTasks(d.tasks ?? []);
      } else if (tab === 'templates') {
        const d = await api<{ ok: boolean; templates: Array<Record<string, unknown>> }>(
          `${base}/recommendation-templates?status=all${cropQ}`
        );
        setTemplates(d.templates ?? []);
      } else if (tab === 'protocols') {
        const d = await api<{ ok: boolean; protocols: Array<Record<string, unknown>> }>(
          '/morbeez-staff/api/v1/os/protocols'
        );
        setProtocols(d.protocols ?? []);
      } else if (tab === 'experiments') {
        const d = await api<{ ok: boolean; experiments: Array<Record<string, unknown>> }>(
          '/morbeez-staff/api/v1/os/experiments'
        );
        setExperiments(d.experiments ?? []);
      } else if (tab === 'spray') {
        const d = await api<{ ok: boolean; rules: Array<Record<string, unknown>> }>(
          `${base}/spray-compatibility`
        );
        setSprayRules(d.rules ?? []);
      } else if (tab === 'rotation') {
        const d = await api<{ ok: boolean; rows: Array<Record<string, unknown>> }>(
          `${base}/resistance-rotation?${cropQ.replace('&', '')}`
        );
        setRotation(d.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, cropFilter, reloadKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(resource: string, id: string) {
    if (!canWrite) return;
    setPendingDelete({ resource, id });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await api(`${base}/${pendingDelete.resource}/${pendingDelete.id}`, { method: 'DELETE' });
      bump();
      setPendingDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div className="intelligence-hub">
      <p className="muted" style={{ marginBottom: 12 }}>
        Masters for rules, cultivation schedules, templates, and spray programs
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <HubTabs tabs={TABS} active={tab} onChange={onTabChange} />

      {tab !== 'pincode' && tab !== 'spray' ? (
        <div className="mt-4 flex items-center gap-2">
          <label className="text-sm text-slate-600">Crop filter</label>
          <StaticSelect
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            value={cropFilter}
            onChange={setCropFilter}
            options={[
              { value: '', label: 'All crops' },
              ...CROPS.map((c) => ({ value: c, label: c })),
            ]}
          />
          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setEditRow(null);
                setModal(tab);
              }}
              className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + Add
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === 'spray' && canWrite ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditRow(null);
              setModal('spray');
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + Add rule
          </button>
        </div>
      ) : null}

      {tab === 'pincode' ? (
        <div className="mt-4">
          <PincodeLookupPage embedded />
        </div>
      ) : (
        <PageShell loading={loading} error={null} loadingLabel="Loading masters…">
      {tab === 'weather' ? (
        <MasterTable
          headers={['Rule key', 'Crop', 'Action', 'Status', 'Priority', '']}
          rows={visibleWeatherRules.map((r) => [
            `${r.rule_key} v${r.version}`,
            String(r.crop_type ?? 'all'),
            String(r.action_type),
            String(r.status),
            String(r.priority),
            r.id as string,
          ])}
          canWrite={canWrite}
          resource="weather-rules"
          onEdit={(id) => {
            setEditRow(weatherRules.find((x) => x.id === id) ?? null);
            setModal('weather');
          }}
          onDelete={remove}
        />
      ) : null}

      {tab === 'cultivation' ? (
        <MasterTable
          headers={['Crop', 'Task', 'Title', 'DAP range', 'Active', '']}
          rows={visibleCultTasks.map((r) => [
            String(r.crop_type),
            String(r.task_key),
            String(r.title_en),
            r.target_dap_min != null
              ? `${r.target_dap_min}–${r.target_dap_max ?? '∞'}`
              : '—',
            r.active ? 'Yes' : 'No',
            r.id as string,
          ])}
          canWrite={canWrite}
          resource="cultivation-tasks"
          onEdit={(id) => {
            setEditRow(cultTasks.find((x) => x.id === id) ?? null);
            setModal('cultivation');
          }}
          onDelete={remove}
        />
      ) : null}

      {tab === 'templates' ? (
        <MasterTable
          headers={['Crop', 'Issue', 'Recommendation', 'Status', '']}
          rows={visibleTemplates.map((r) => [
            String(r.crop_type),
            String(r.issue_label_en ?? r.issue_key),
            String(r.recommendation_text_en).slice(0, 60) + '…',
            String(r.status),
            r.id as string,
          ])}
          canWrite={canWrite}
          resource="recommendation-templates"
          onEdit={(id) => {
            setEditRow(templates.find((x) => x.id === id) ?? null);
            setModal('templates');
          }}
          onDelete={remove}
        />
      ) : null}

      {tab === 'protocols' ? (
        <div>
          <p className="muted mb-2">Multi-day protocol definitions (D0/D3/D7/D14)</p>
          {canWrite ? (
            <div className="mb-4 p-3 border rounded">
              <h4 className="font-semibold mb-2">Create protocol</h4>
              <div className="grid gap-2 max-w-xl">
                <Field label="Crop">
                  <StaticSelect
                    value={protocolDraft.cropType}
                    onChange={(e) => setProtocolDraft((d) => ({ ...d, cropType: e.target.value }))}
                  >
                    {CROPS.filter((c) => c !== 'all').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </StaticSelect>
                </Field>
                <Field label="Issue label">
                  <input
                    className={inputClass}
                    value={protocolDraft.issueLabel}
                    onChange={(e) => setProtocolDraft((d) => ({ ...d, issueLabel: e.target.value }))}
                    placeholder="e.g. waterlogging"
                  />
                </Field>
                <Field label="Protocol name">
                  <input
                    className={inputClass}
                    value={protocolDraft.label}
                    onChange={(e) => setProtocolDraft((d) => ({ ...d, label: e.target.value }))}
                    placeholder="Ginger S3 waterlogging protocol"
                  />
                </Field>
                <Field label="Stages">
                  {protocolDraft.stages.map((stage, si) => (
                    <div key={si} className="border rounded p-2 mb-2">
                      <div className="flex gap-2 mb-2">
                        <input
                          className={inputClass}
                          type="number"
                          value={stage.day}
                          onChange={(e) =>
                            setProtocolDraft((d) => {
                              const stages = [...d.stages];
                              stages[si] = { ...stages[si]!, day: Number(e.target.value) };
                              return { ...d, stages };
                            })
                          }
                          placeholder="Day"
                        />
                        <input
                          className={inputClass}
                          value={stage.applicationType}
                          onChange={(e) =>
                            setProtocolDraft((d) => {
                              const stages = [...d.stages];
                              stages[si] = { ...stages[si]!, applicationType: e.target.value };
                              return { ...d, stages };
                            })
                          }
                          placeholder="Application type"
                        />
                      </div>
                      {stage.materials.map((mat, mi) => (
                        <input
                          key={mi}
                          className={`${inputClass} mb-1`}
                          value={mat.technicalName}
                          onChange={(e) =>
                            setProtocolDraft((d) => {
                              const stages = [...d.stages];
                              const materials = [...stages[si]!.materials];
                              materials[mi] = { ...materials[mi]!, technicalName: e.target.value };
                              stages[si] = { ...stages[si]!, materials };
                              return { ...d, stages };
                            })
                          }
                          placeholder="Product technical name"
                        />
                      ))}
                      <button
                        type="button"
                        className="text-sm underline"
                        onClick={() =>
                          setProtocolDraft((d) => {
                            const stages = [...d.stages];
                            stages[si] = {
                              ...stages[si]!,
                              materials: [...stages[si]!.materials, { ...DEFAULT_MATERIAL }],
                            };
                            return { ...d, stages };
                          })
                        }
                      >
                        + Material
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() =>
                      setProtocolDraft((d) => ({
                        ...d,
                        stages: [...d.stages, { ...DEFAULT_STAGE, materials: [{ ...DEFAULT_MATERIAL }] }],
                      }))
                    }
                  >
                    + Stage
                  </button>
                </Field>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={protocolSaving}
                  onClick={() => {
                    void (async () => {
                      setProtocolSaving(true);
                      setError('');
                      try {
                        const body = {
                          cropType: protocolDraft.cropType,
                          issueLabel: protocolDraft.issueLabel,
                          label: protocolDraft.label,
                          stages: protocolDraft.stages,
                        };
                        if (editingProtocolId) {
                          await api(`/morbeez-staff/api/v1/os/protocols/${editingProtocolId}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              label: body.label,
                              issueLabel: body.issueLabel,
                              stages: body.stages,
                            }),
                          });
                          setEditingProtocolId(null);
                        } else {
                          await api('/morbeez-staff/api/v1/os/protocols', {
                            method: 'POST',
                            body: JSON.stringify(body),
                          });
                        }
                        bump();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Could not save protocol');
                      } finally {
                        setProtocolSaving(false);
                      }
                    })();
                  }}
                >
                  {protocolSaving ? 'Saving…' : editingProtocolId ? 'Update draft' : 'Create draft'}
                </button>
              </div>
            </div>
          ) : null}
          <ul>
            {protocols.map((p) => (
              <li key={String(p.id)} className="mb-2">
                {String(p.label)} — {String(p.crop_type)} / {String(p.issue_label)} v{String(p.version)} (
                {String(p.status)})
                {canWrite && String(p.status) === 'draft' ? (
                  <>
                    <button
                      type="button"
                      className="ml-2 text-sm underline"
                      onClick={() => {
                        setEditingProtocolId(String(p.id));
                        setProtocolDraft({
                          cropType: String(p.crop_type ?? 'ginger'),
                          issueLabel: String(p.issue_label ?? ''),
                          label: String(p.label ?? ''),
                          stages: (Array.isArray(p.stages) ? p.stages : [{ ...DEFAULT_STAGE }]) as ProtocolStage[],
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ml-2 text-sm underline"
                      onClick={() => {
                        void api(`/morbeez-staff/api/v1/os/protocols/${String(p.id)}/publish`, { method: 'POST' }).then(
                          () => bump()
                        );
                      }}
                    >
                      Publish
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {!protocols.length ? <p className="muted">No protocols yet.</p> : null}
        </div>
      ) : null}

      {tab === 'experiments' ? (
        <div>
          {canWrite ? (
            <div className="mb-4 p-3 border rounded max-w-xl">
              <h4 className="font-semibold mb-2">Create experiment</h4>
              <Field label="Key">
                <input
                  className={inputClass}
                  value={experimentDraft.experimentKey}
                  onChange={(e) => setExperimentDraft((d) => ({ ...d, experimentKey: e.target.value }))}
                />
              </Field>
              <Field label="Label">
                <input
                  className={inputClass}
                  value={experimentDraft.label}
                  onChange={(e) => setExperimentDraft((d) => ({ ...d, label: e.target.value }))}
                />
              </Field>
              <Field label="Hypothesis">
                <input
                  className={inputClass}
                  value={experimentDraft.hypothesis}
                  onChange={(e) => setExperimentDraft((d) => ({ ...d, hypothesis: e.target.value }))}
                />
              </Field>
              <Field label="Variants (comma-separated)">
                <input
                  className={inputClass}
                  value={experimentDraft.variants}
                  onChange={(e) => setExperimentDraft((d) => ({ ...d, variants: e.target.value }))}
                />
              </Field>
              <button
                type="button"
                className="btn btn-primary mt-2"
                onClick={() => {
                  void api('/morbeez-staff/api/v1/os/experiments', {
                    method: 'POST',
                    body: JSON.stringify({
                      experimentKey: experimentDraft.experimentKey.trim(),
                      label: experimentDraft.label.trim(),
                      hypothesis: experimentDraft.hypothesis.trim() || undefined,
                      variants: experimentDraft.variants
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean)
                        .map((key) => ({ key })),
                    }),
                  }).then(() => bump());
                }}
              >
                Create draft
              </button>
            </div>
          ) : null}
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Key</th>
                <th>Label</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {experiments.map((e) => (
                <tr key={String(e.id)}>
                  <td>{String(e.experiment_key)}</td>
                  <td>{String(e.label)}</td>
                  <td>{String(e.status)}</td>
                  <td>
                    {canWrite && String(e.status) === 'draft' ? (
                      <button
                        type="button"
                        className="text-sm underline"
                        onClick={() => {
                          void api(`/morbeez-staff/api/v1/os/experiments/${String(e.id)}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'running' }),
                          }).then(() => bump());
                        }}
                      >
                        Start
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'spray' ? (
        <MasterTable
          headers={['Product A', 'Product B', 'Compatible', 'Gap (hrs)', '']}
          rows={visibleSprayRules.map((r) => [
            String(r.product_a),
            String(r.product_b),
            r.compatible ? 'Yes' : 'No',
            String(r.min_interval_hours ?? '—'),
            r.id as string,
          ])}
          canWrite={canWrite}
          resource="spray-compatibility"
          onEdit={(id) => {
            setEditRow(sprayRules.find((x) => x.id === id) ?? null);
            setModal('spray');
          }}
          onDelete={remove}
        />
      ) : null}

      {tab === 'rotation' ? (
        <MasterTable
          headers={['Crop', 'MoA', 'Order', 'Technical', '']}
          rows={visibleRotation.map((r) => [
            String(r.crop_type),
            String(r.mode_of_action),
            String(r.rotation_order),
            String(r.technical_name),
            r.id as string,
          ])}
          canWrite={canWrite}
          resource="resistance-rotation"
          onEdit={(id) => {
            setEditRow(rotation.find((x) => x.id === id) ?? null);
            setModal('rotation');
          }}
          onDelete={remove}
        />
      ) : null}
        </PageShell>
      )}

      {modal ? (
        <IntelligenceFormModal
          kind={modal}
          row={editRow}
          canWrite={canWrite}
          onClose={() => {
            setModal(null);
            setEditRow(null);
          }}
          onSaved={() => {
            setModal(null);
            setEditRow(null);
            bump();
          }}
        />
      ) : null}
      {pendingDelete ? (
        <Modal
          title="Delete row"
          onClose={() => setPendingDelete(null)}
          onSave={confirmDelete}
          saveLabel="Delete"
        >
          <p className="text-sm text-slate-700">Do you want to delete this row?</p>
        </Modal>
      ) : null}
    </div>
  );
}

function MasterTable({
  headers,
  rows,
  canWrite,
  resource,
  onEdit,
  onDelete,
}: {
  headers: string[];
  rows: (string | number)[][];
  canWrite: boolean;
  resource: string;
  onEdit: (id: string) => void;
  onDelete: (resource: string, id: string) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const id = String(row[row.length - 1]);
            const cells = row.slice(0, -1);
            return (
              <tr key={i} className="border-t border-slate-100">
                {cells.map((c, j) => (
                  <td key={j} className="px-4 py-3">
                    {c}
                  </td>
                ))}
                {canWrite ? (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="mr-2 text-xs text-emerald-700 hover:underline"
                      onClick={() => onEdit(id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => onDelete(resource, id)}
                    >
                      Del
                    </button>
                  </td>
                ) : (
                  <td />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No rows — apply migration 20260610000000_ag_intelligence_masters.sql if empty.
        </p>
      ) : null}
    </div>
  );
}

function IntelligenceFormModal({
  kind,
  row,
  onClose,
  onSaved,
}: {
  kind: string;
  row: Record<string, unknown> | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [f, setF] = useState(() => initForm(kind, row));

  async function save() {
    setSaving(true);
    setErr('');
    try {
      if (kind === 'weather') {
        await api(`${base}/weather-rules`, {
          method: 'POST',
          body: JSON.stringify({
            id: row?.id,
            ruleKey: f.ruleKey,
            cropType: f.cropType || null,
            actionType: f.actionType,
            conditionJson: JSON.parse(f.conditionJson || '{}'),
            actionPayload: JSON.parse(f.actionPayload || '{}'),
            priority: Number(f.priority) || 50,
            status: f.status,
            notes: f.notes,
          }),
        });
      } else if (kind === 'cultivation') {
        await api(`${base}/cultivation-tasks`, {
          method: 'POST',
          body: JSON.stringify({
            id: row?.id,
            cropType: f.cropType,
            taskKey: f.taskKey,
            titleEn: f.titleEn,
            instructionsEn: f.instructionsEn,
            targetDapMin: f.dapMin ? Number(f.dapMin) : null,
            targetDapMax: f.dapMax ? Number(f.dapMax) : null,
            priority: Number(f.priority) || 50,
            active: f.active === 'true',
          }),
        });
      } else if (kind === 'templates') {
        await api(`${base}/recommendation-templates`, {
          method: 'POST',
          body: JSON.stringify({
            id: row?.id,
            cropType: f.cropType,
            issueKey: f.issueKey,
            issueLabelEn: f.issueLabelEn,
            recommendationTextEn: f.recText,
            status: f.status,
            products: JSON.parse(f.products || '[]'),
          }),
        });
      } else if (kind === 'spray') {
        await api(`${base}/spray-compatibility`, {
          method: 'POST',
          body: JSON.stringify({
            id: row?.id,
            productA: f.productA,
            productB: f.productB,
            compatible: f.compatible === 'true',
            minIntervalHours: f.interval ? Number(f.interval) : null,
            notes: f.notes,
          }),
        });
      } else if (kind === 'rotation') {
        await api(`${base}/resistance-rotation`, {
          method: 'POST',
          body: JSON.stringify({
            id: row?.id,
            cropType: f.cropType,
            modeOfAction: f.moa,
            rotationOrder: Number(f.order) || 1,
            technicalName: f.technical,
            notes: f.notes,
          }),
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const title =
    kind === 'weather'
      ? 'Weather rule'
      : kind === 'cultivation'
        ? 'Cultivation task'
        : kind === 'templates'
          ? 'Recommendation template'
          : kind === 'spray'
            ? 'Spray compatibility'
            : 'Resistance rotation';

  return (
    <Modal title={row ? `Edit ${title}` : `Add ${title}`} onClose={onClose} onSave={save} saving={saving}>
      {err ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {kind === 'weather' ? (
          <>
            <Field label="Rule key">
              <input className={inputClass} value={f.ruleKey} onChange={(e) => setF({ ...f, ruleKey: e.target.value })} />
            </Field>
            <Field label="Crop (blank = all)">
              <input className={inputClass} value={f.cropType} onChange={(e) => setF({ ...f, cropType: e.target.value })} />
            </Field>
            <Field label="Action type">
              <StaticSelect
                className={inputClass}
                value={f.actionType}
                onChange={(value) => setF({ ...f, actionType: value })}
                options={['block_action', 'recommend_task', 'warn'].map((a) => ({ value: a, label: a }))}
              />
            </Field>
            <Field label="Condition JSON">
              <textarea className={inputClass} rows={2} value={f.conditionJson} onChange={(e) => setF({ ...f, conditionJson: e.target.value })} />
            </Field>
            <Field label="Action payload JSON">
              <textarea className={inputClass} rows={2} value={f.actionPayload} onChange={(e) => setF({ ...f, actionPayload: e.target.value })} />
            </Field>
            <Field label="Status">
              <StaticSelect
                className={inputClass}
                value={f.status}
                onChange={(value) => setF({ ...f, status: value })}
                options={['draft', 'approved', 'archived'].map((s) => ({ value: s, label: s }))}
              />
            </Field>
          </>
        ) : null}
        {kind === 'cultivation' ? (
          <>
            <Field label="Crop">
              <input className={inputClass} value={f.cropType} onChange={(e) => setF({ ...f, cropType: e.target.value })} />
            </Field>
            <Field label="Task key">
              <input className={inputClass} value={f.taskKey} onChange={(e) => setF({ ...f, taskKey: e.target.value })} />
            </Field>
            <Field label="Title (EN)">
              <input className={inputClass} value={f.titleEn} onChange={(e) => setF({ ...f, titleEn: e.target.value })} />
            </Field>
            <Field label="Instructions (EN)">
              <textarea className={inputClass} rows={2} value={f.instructionsEn} onChange={(e) => setF({ ...f, instructionsEn: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="DAP min">
                <input className={inputClass} value={f.dapMin} onChange={(e) => setF({ ...f, dapMin: e.target.value })} />
              </Field>
              <Field label="DAP max">
                <input className={inputClass} value={f.dapMax} onChange={(e) => setF({ ...f, dapMax: e.target.value })} />
              </Field>
            </div>
          </>
        ) : null}
        {kind === 'templates' ? (
          <>
            <Field label="Crop">
              <input className={inputClass} value={f.cropType} onChange={(e) => setF({ ...f, cropType: e.target.value })} />
            </Field>
            <Field label="Issue key">
              <input className={inputClass} value={f.issueKey} onChange={(e) => setF({ ...f, issueKey: e.target.value })} />
            </Field>
            <Field label="Issue label">
              <input className={inputClass} value={f.issueLabelEn} onChange={(e) => setF({ ...f, issueLabelEn: e.target.value })} />
            </Field>
            <Field label="Recommendation text">
              <textarea className={inputClass} rows={3} value={f.recText} onChange={(e) => setF({ ...f, recText: e.target.value })} />
            </Field>
            <Field label="Products JSON">
              <textarea className={inputClass} rows={2} value={f.products} onChange={(e) => setF({ ...f, products: e.target.value })} />
            </Field>
            <Field label="Status">
              <StaticSelect
                className={inputClass}
                value={f.status}
                onChange={(value) => setF({ ...f, status: value })}
                options={['draft', 'approved', 'archived'].map((s) => ({ value: s, label: s }))}
              />
            </Field>
          </>
        ) : null}
        {kind === 'spray' ? (
          <>
            <Field label="Product A">
              <input className={inputClass} value={f.productA} onChange={(e) => setF({ ...f, productA: e.target.value })} />
            </Field>
            <Field label="Product B">
              <input className={inputClass} value={f.productB} onChange={(e) => setF({ ...f, productB: e.target.value })} />
            </Field>
            <Field label="Compatible">
              <StaticSelect
                className={inputClass}
                value={f.compatible}
                onChange={(value) => setF({ ...f, compatible: value })}
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
              />
            </Field>
            <Field label="Min interval (hours)">
              <input className={inputClass} value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })} />
            </Field>
          </>
        ) : null}
        {kind === 'rotation' ? (
          <>
            <Field label="Crop">
              <input className={inputClass} value={f.cropType} onChange={(e) => setF({ ...f, cropType: e.target.value })} />
            </Field>
            <Field label="Mode of action">
              <input className={inputClass} value={f.moa} onChange={(e) => setF({ ...f, moa: e.target.value })} />
            </Field>
            <Field label="Rotation order">
              <input className={inputClass} value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} />
            </Field>
            <Field label="Technical name">
              <input className={inputClass} value={f.technical} onChange={(e) => setF({ ...f, technical: e.target.value })} />
            </Field>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function initForm(kind: string, row: Record<string, unknown> | null): Record<string, string> {
  if (!row) {
    return {
      ruleKey: '',
      cropType: 'ginger',
      actionType: 'recommend_task',
      conditionJson: '{"rain_probability_pct":{"gt":70}}',
      actionPayload: '{"task":"drainage_cleaning"}',
      status: 'draft',
      priority: '50',
      notes: '',
      taskKey: '',
      titleEn: '',
      instructionsEn: '',
      dapMin: '',
      dapMax: '',
      issueKey: '',
      issueLabelEn: '',
      recText: '',
      products: '[]',
      productA: '',
      productB: '',
      compatible: 'false',
      interval: '168',
      moa: 'QoI',
      order: '1',
      technical: '',
      active: 'true',
    };
  }
  if (kind === 'weather') {
    return {
      ruleKey: String(row.rule_key ?? ''),
      cropType: String(row.crop_type ?? ''),
      actionType: String(row.action_type ?? ''),
      conditionJson: JSON.stringify(row.condition_json ?? {}, null, 2),
      actionPayload: JSON.stringify(row.action_payload ?? {}, null, 2),
      status: String(row.status ?? 'draft'),
      priority: String(row.priority ?? 50),
      notes: String(row.notes ?? ''),
    };
  }
  if (kind === 'cultivation') {
    return {
      cropType: String(row.crop_type ?? ''),
      taskKey: String(row.task_key ?? ''),
      titleEn: String(row.title_en ?? ''),
      instructionsEn: String(row.instructions_en ?? ''),
      dapMin: row.target_dap_min != null ? String(row.target_dap_min) : '',
      dapMax: row.target_dap_max != null ? String(row.target_dap_max) : '',
      priority: String(row.priority ?? 50),
      active: row.active ? 'true' : 'false',
    };
  }
  if (kind === 'templates') {
    return {
      cropType: String(row.crop_type ?? ''),
      issueKey: String(row.issue_key ?? ''),
      issueLabelEn: String(row.issue_label_en ?? ''),
      recText: String(row.recommendation_text_en ?? ''),
      products: JSON.stringify(row.products ?? [], null, 2),
      status: String(row.status ?? 'draft'),
    };
  }
  if (kind === 'spray') {
    return {
      productA: String(row.product_a ?? ''),
      productB: String(row.product_b ?? ''),
      compatible: row.compatible ? 'true' : 'false',
      interval: row.min_interval_hours != null ? String(row.min_interval_hours) : '',
      notes: String(row.notes ?? ''),
    };
  }
  return {
    cropType: String(row.crop_type ?? ''),
    moa: String(row.mode_of_action ?? ''),
    order: String(row.rotation_order ?? 1),
    technical: String(row.technical_name ?? ''),
    notes: String(row.notes ?? ''),
  };
}
