import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { api } from '../../lib/api';
import { matchesSearch } from '../../lib/search-filter';
import { Field, Modal, inputClass } from '../Modal';
import { Alert, StaticSelect } from '../ui';

const base = '/morbeez-staff/api/v1/os/operations';

type TermSummary = {
  pendingTerms: number;
  approvedTerms: number;
  learnedTerminologies: number;
  totalConcepts: number;
};

type TermTask = {
  id: string;
  term: string;
  unknown_word?: string | null;
  language: string | null;
  crop_type: string | null;
  district: string | null;
  context_text: string | null;
  raw_message?: string | null;
  occurrence_count?: number | null;
  priority_score?: number | null;
  standard_term?: string | null;
  ai_suggested_concept_name?: string | null;
  ai_suggested_concept_id?: string | null;
  confidence_score?: number | null;
  status: string;
  source_channel?: string | null;
  farmers?: { phone: string; name: string | null; district: string | null };
};

type Concept = {
  id: string;
  conceptCode: string | null;
  name: string;
  category: string;
  termCount: number;
};

type LearnedTerm = {
  id: string;
  term: string;
  language: string;
  meaning: string;
  standardTerm: string | null;
  district: string | null;
  state: string | null;
  status: string;
  replyPreferred: boolean;
  usageCount: number;
  conceptId: string | null;
  conceptName: string | null;
  conceptCode: string | null;
  conceptCategory: string | null;
  aliases: Array<{ alias: string; language: string }>;
};

type Section = 'pending' | 'learned';

export function TerminologyLearningPanel({
  canWrite,
  search = '',
  termStatus,
  onTermStatusChange,
}: {
  canWrite: boolean;
  search?: string;
  termStatus: string;
  onTermStatusChange: (s: string) => void;
}) {
  const [summary, setSummary] = useState<TermSummary | null>(null);
  const [tasks, setTasks] = useState<TermTask[]>([]);
  const [learned, setLearned] = useState<LearnedTerm[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>('pending');
  const [langFilter, setLangFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [mapModal, setMapModal] = useState<TermTask | null>(null);
  const [termDrawer, setTermDrawer] = useState<LearnedTerm | null>(null);
  const [mapForm, setMapForm] = useState({
    conceptId: '',
    conceptName: '',
    conceptCategory: 'general',
    meaning: '',
    standardTerm: '',
    replyPreferred: true,
    examples: '',
    aliases: '',
  });
  const [termForm, setTermForm] = useState({
    term: '',
    language: 'ml',
    district: '',
    state: '',
    meaning: '',
    standardTerm: '',
    conceptId: '',
    replyPreferred: true,
    status: 'active' as 'active' | 'inactive',
    aliases: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const learnedQs = new URLSearchParams();
      if (langFilter) learnedQs.set('language', langFilter);
      if (districtFilter) learnedQs.set('district', districtFilter);
      const [sum, taskRes, conceptRes, learnedRes] = await Promise.all([
        api<{ ok: boolean; summary: TermSummary }>(`${base}/terminology/summary`),
        api<{ ok: boolean; tasks: TermTask[] }>(
          `${base}/terminology/tasks?status=${encodeURIComponent(termStatus)}${sourceFilter ? `&source=${encodeURIComponent(sourceFilter)}` : ''}`
        ),
        api<{ ok: boolean; concepts: Concept[] }>(`${base}/terminology/concepts`),
        api<{ ok: boolean; terms: LearnedTerm[] }>(
          `${base}/terminology/learned${learnedQs.toString() ? `?${learnedQs}` : ''}`
        ),
      ]);
      setSummary(sum.summary);
      setTasks(taskRes.tasks ?? []);
      setConcepts(conceptRes.concepts ?? []);
      setLearned(learnedRes.terms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [termStatus, langFilter, districtFilter, sourceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (langFilter && t.language !== langFilter) return false;
        if (districtFilter && t.district !== districtFilter) return false;
        return matchesSearch(
          search,
          t.term,
          t.unknown_word,
          t.language,
          t.district,
          t.context_text,
          t.raw_message,
          t.standard_term,
          t.ai_suggested_concept_name
        );
      }),
    [tasks, search, langFilter, districtFilter]
  );

  const visibleLearned = useMemo(
    () =>
      learned.filter((t) =>
        matchesSearch(
          search,
          t.term,
          t.conceptName,
          t.conceptCode,
          t.standardTerm,
          t.district,
          t.language,
          ...t.aliases.map((a) => a.alias)
        )
      ),
    [learned, search]
  );

  function openMap(task: TermTask) {
    setMapModal(task);
    setMapForm({
      conceptId: task.ai_suggested_concept_id ?? '',
      conceptName: task.ai_suggested_concept_name ?? task.standard_term ?? '',
      conceptCategory: 'general',
      meaning: task.ai_suggested_concept_name ?? task.standard_term ?? '',
      standardTerm: task.ai_suggested_concept_name ?? task.standard_term ?? '',
      replyPreferred: true,
      examples: task.raw_message ?? task.context_text ?? task.term,
      aliases: task.unknown_word ?? task.term,
    });
  }

  function openTermDrawer(term: LearnedTerm) {
    setTermDrawer(term);
    setTermForm({
      term: term.term,
      language: term.language,
      district: term.district ?? '',
      state: term.state ?? '',
      meaning: term.meaning,
      standardTerm: term.standardTerm ?? '',
      conceptId: term.conceptId ?? '',
      replyPreferred: term.replyPreferred,
      status: term.status === 'inactive' ? 'inactive' : 'active',
      aliases: term.aliases.map((a) => a.alias).join('\n'),
    });
  }

  async function approveTask() {
    if (!mapModal) return;
    await api(`${base}/terminology/tasks/${mapModal.id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({
        conceptId: mapForm.conceptId || undefined,
        conceptName: mapForm.conceptName || undefined,
        conceptCategory: mapForm.conceptCategory,
        meaning: mapForm.meaning,
        standardTerm: mapForm.standardTerm,
        replyPreferred: mapForm.replyPreferred,
        examples: mapForm.examples
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        aliases: mapForm.aliases
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setMapModal(null);
    await load();
  }

  async function rejectTask(id: string) {
    await api(`${base}/terminology/tasks/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'Not valid agricultural terminology' }),
    });
    await load();
  }

  async function saveTermDrawer() {
    if (!termDrawer) return;
    await api(`${base}/terminology/terms/${termDrawer.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        term: termForm.term,
        language: termForm.language,
        district: termForm.district || null,
        state: termForm.state || null,
        meaning: termForm.meaning,
        standardTerm: termForm.standardTerm,
        conceptId: termForm.conceptId || null,
        replyPreferred: termForm.replyPreferred,
        status: termForm.status,
        aliases: termForm.aliases
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setTermDrawer(null);
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading terminology center…</p>;

  return (
    <div className="space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="text-sm text-slate-600">
        AI-powered learning engine: detect regional farmer terms, map to agricultural concepts, and localize
        WhatsApp responses by district.
      </p>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Pending terms" value={summary.pendingTerms} tone="amber" />
          <Kpi label="Approved terms" value={summary.approvedTerms} tone="emerald" />
          <Kpi label="Learned terminologies" value={summary.learnedTerminologies} tone="sky" />
          <Kpi label="Total concepts" value={summary.totalConcepts} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Language">
          <StaticSelect
            className="rounded border px-2 py-1.5 text-sm"
            value={langFilter}
            onChange={setLangFilter}
            options={[
              { value: '', label: 'All languages' },
              ...['en', 'hi', 'kn', 'ta', 'ml'].map((l) => ({ value: l, label: l.toUpperCase() })),
            ]}
          />
        </FilterField>
        <FilterField label="Source">
          <StaticSelect
            className="rounded border px-2 py-1.5 text-sm"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: '', label: 'All sources' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'call', label: 'Call' },
              { value: 'field', label: 'Field' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </FilterField>
        <FilterField label="District">
          <input
            className="rounded border px-2 py-1.5 text-sm"
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            placeholder="e.g. Wayanad"
          />
        </FilterField>
        {section === 'pending' ? (
          <FilterField label="Review status">
            <StaticSelect
              className="rounded border px-2 py-1.5 text-sm"
              value={termStatus}
              onChange={onTermStatusChange}
              options={['open', 'in_review', 'resolved', 'rejected', 'dismissed', 'all'].map((s) => ({
                value: s,
                label: s.replace(/_/g, ' '),
              }))}
            />
          </FilterField>
        ) : null}
        <div className="ml-auto flex gap-2">
          <TabButton active={section === 'pending'} onClick={() => setSection('pending')}>
            Pending review
          </TabButton>
          <TabButton active={section === 'learned'} onClick={() => setSection('learned')}>
            Learned terminologies
          </TabButton>
        </div>
      </div>

      {section === 'pending' ? (
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <h2 className="border-b px-4 py-3 font-medium">Pending review queue</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Regional term</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Farmers</th>
                <th className="px-4 py-3">Sample message</th>
                <th className="px-4 py-3">AI suggestion</th>
                <th className="px-4 py-3">Confidence</th>
                {canWrite ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{t.unknown_word ?? t.term}</td>
                  <td className="px-4 py-3 uppercase">{t.language ?? '—'}</td>
                  <td className="px-4 py-3">{t.district ?? '—'}</td>
                  <td className="px-4 py-3">{t.occurrence_count ?? 1}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs">{t.raw_message ?? t.context_text}</td>
                  <td className="px-4 py-3">{t.ai_suggested_concept_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.confidence_score != null ? `${Math.round(t.confidence_score * 100)}%` : '—'}
                  </td>
                  {canWrite ? (
                    <td className="px-4 py-3">
                      {(t.status === 'open' || t.status === 'in_review') && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-xs font-medium text-emerald-700 hover:underline"
                            onClick={() => openMap(t)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="text-xs text-sky-700 hover:underline"
                            onClick={() => openMap(t)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs text-rose-700 hover:underline"
                            onClick={() => void rejectTask(t.id)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {visibleTasks.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No pending terms match your filters.</p>
          ) : null}
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <h2 className="border-b px-4 py-3 font-medium">Learned terminologies</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Concept</th>
                <th className="px-4 py-3">Regional term</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">In AI replies</th>
                <th className="px-4 py-3">Status</th>
                {canWrite ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {visibleLearned.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.conceptName ?? t.standardTerm ?? '—'}</div>
                    {t.conceptCode ? <div className="text-xs text-slate-400">{t.conceptCode}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>{t.term}</div>
                    {t.aliases.length > 0 ? (
                      <div className="text-xs text-slate-400">
                        +{t.aliases.map((a) => a.alias).join(', ')}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 uppercase">{t.language}</td>
                  <td className="px-4 py-3">{t.district ?? '—'}</td>
                  <td className="px-4 py-3">{t.usageCount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">{t.replyPreferred ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 capitalize">{t.status}</td>
                  {canWrite ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-sky-700 hover:underline"
                        onClick={() => openTermDrawer(t)}
                      >
                        Manage
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {visibleLearned.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No learned terms yet.</p>
          ) : null}
        </section>
      )}

      {mapModal ? (
        <Modal
          title="Approve terminology mapping"
          onClose={() => setMapModal(null)}
          onSave={() => void approveTask()}
          saveLabel="Approve mapping"
        >
          <MappingForm
            mapModal={mapModal}
            mapForm={mapForm}
            setMapForm={setMapForm}
            concepts={concepts}
          />
        </Modal>
      ) : null}

      {termDrawer ? (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Term management</h2>
            <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => setTermDrawer(null)}>
              Close
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <Field label="Regional term">
              <input className={inputClass} value={termForm.term} onChange={(e) => setTermForm((f) => ({ ...f, term: e.target.value }))} />
            </Field>
            <Field label="Standard concept">
              <StaticSelect
                className={inputClass}
                value={termForm.conceptId}
                onChange={(v) => setTermForm((f) => ({ ...f, conceptId: v }))}
                options={[
                  { value: '', label: 'Unlinked' },
                  ...concepts.map((c) => ({
                    value: c.id,
                    label: c.conceptCode ? `${c.conceptCode} — ${c.name}` : c.name,
                  })),
                ]}
              />
            </Field>
            <Field label="Meaning">
              <textarea className={inputClass} rows={2} value={termForm.meaning} onChange={(e) => setTermForm((f) => ({ ...f, meaning: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Language">
                <StaticSelect
                  className={inputClass}
                  value={termForm.language}
                  onChange={(v) => setTermForm((f) => ({ ...f, language: v }))}
                  options={['en', 'hi', 'kn', 'ta', 'ml'].map((l) => ({ value: l, label: l.toUpperCase() }))}
                />
              </Field>
              <Field label="Status">
                <StaticSelect
                  className={inputClass}
                  value={termForm.status}
                  onChange={(v) => setTermForm((f) => ({ ...f, status: v as 'active' | 'inactive' }))}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </Field>
            </div>
            <Field label="District">
              <input className={inputClass} value={termForm.district} onChange={(e) => setTermForm((f) => ({ ...f, district: e.target.value }))} />
            </Field>
            <Field label="State">
              <input className={inputClass} value={termForm.state} onChange={(e) => setTermForm((f) => ({ ...f, state: e.target.value }))} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={termForm.replyPreferred}
                onChange={(e) => setTermForm((f) => ({ ...f, replyPreferred: e.target.checked }))}
              />
              Use in AI responses
            </label>
            <Field label="Aliases / synonyms (one per line)">
              <textarea className={inputClass} rows={4} value={termForm.aliases} onChange={(e) => setTermForm((f) => ({ ...f, aliases: e.target.value }))} />
            </Field>
          </div>
          <div className="border-t p-4">
            <button
              type="button"
              className="w-full rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              onClick={() => void saveTermDrawer()}
            >
              Save changes
            </button>
          </div>
        </aside>
      ) : null}
      {termDrawer ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30"
          aria-label="Close drawer"
          onClick={() => setTermDrawer(null)}
        />
      ) : null}
    </div>
  );
}

function MappingForm({
  mapModal,
  mapForm,
  setMapForm,
  concepts,
}: {
  mapModal: TermTask;
  mapForm: {
    conceptId: string;
    conceptName: string;
    conceptCategory: string;
    meaning: string;
    standardTerm: string;
    replyPreferred: boolean;
    examples: string;
    aliases: string;
  };
  setMapForm: Dispatch<SetStateAction<typeof mapForm>>;
  concepts: Concept[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Regional term: <strong>{mapModal.unknown_word ?? mapModal.term}</strong>
      </p>
      {mapModal.ai_suggested_concept_name ? (
        <p className="rounded bg-sky-50 px-3 py-2 text-xs text-sky-900">
          AI suggests: <strong>{mapModal.ai_suggested_concept_name}</strong>
          {mapModal.confidence_score != null
            ? ` (${Math.round(mapModal.confidence_score * 100)}% confidence)`
            : null}
        </p>
      ) : null}
      <Field label="Standard concept">
        <StaticSelect
          className={inputClass}
          value={mapForm.conceptId}
          onChange={(v) => setMapForm((f) => ({ ...f, conceptId: v }))}
          options={[
            { value: '', label: 'Create new…' },
            ...concepts.map((c) => ({
              value: c.id,
              label: c.conceptCode ? `${c.conceptCode} — ${c.name}` : c.name,
            })),
          ]}
        />
      </Field>
      {!mapForm.conceptId ? (
        <>
          <Field label="New concept name">
            <input
              className={inputClass}
              value={mapForm.conceptName}
              onChange={(e) => setMapForm((f) => ({ ...f, conceptName: e.target.value }))}
            />
          </Field>
          <Field label="Category">
            <StaticSelect
              className={inputClass}
              value={mapForm.conceptCategory}
              onChange={(v) => setMapForm((f) => ({ ...f, conceptCategory: v }))}
              options={['general', 'disease', 'pest', 'nutrient_deficiency', 'growth_issue', 'weather_impact'].map(
                (c) => ({ value: c, label: c.replace(/_/g, ' ') })
              )}
            />
          </Field>
        </>
      ) : null}
      <Field label="Meaning / definition">
        <textarea className={inputClass} rows={2} value={mapForm.meaning} onChange={(e) => setMapForm((f) => ({ ...f, meaning: e.target.value }))} />
      </Field>
      <Field label="Standard term label">
        <input className={inputClass} value={mapForm.standardTerm} onChange={(e) => setMapForm((f) => ({ ...f, standardTerm: e.target.value }))} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mapForm.replyPreferred} onChange={(e) => setMapForm((f) => ({ ...f, replyPreferred: e.target.checked }))} />
        Use in AI responses
      </label>
      <Field label="Example messages (one per line)">
        <textarea className={inputClass} rows={3} value={mapForm.examples} onChange={(e) => setMapForm((f) => ({ ...f, examples: e.target.value }))} />
      </Field>
      <Field label="Aliases / synonyms (one per line)">
        <textarea className={inputClass} rows={2} value={mapForm.aliases} onChange={(e) => setMapForm((f) => ({ ...f, aliases: e.target.value }))} />
      </Field>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'amber' | 'emerald' | 'sky';
}) {
  const ring =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50'
        : tone === 'sky'
          ? 'border-sky-200 bg-sky-50'
          : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${ring}`}>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value.toLocaleString('en-IN')}</p>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
