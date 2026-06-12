import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { toPath, paths } from '../../lib/routes';
import { TerminologyLearningPanel } from './TerminologyLearningPanel';
import { StaticSelect } from '../ui';
import { api } from '../../lib/api';

const base = '/morbeez-staff/api/v1/os/operations';

type Concept = {
  id: string;
  conceptCode: string | null;
  name: string;
  category: string;
  termCount: number;
};

export function OperationsKnowledgeSection({
  subTab,
  canWrite,
  search,
  termStatus,
  onTermStatusChange,
  terminologyRefreshKey,
  termForm,
  setTermForm,
  onCreateTermTask,
}: {
  subTab: 'terminology' | 'concepts';
  canWrite: boolean;
  search: string;
  termStatus: string;
  onTermStatusChange: (s: string) => void;
  terminologyRefreshKey: number;
  termForm: {
    term: string;
    rawMessage: string;
    farmerPhone: string;
    language: string;
    cropType: string;
    district: string;
  };
  setTermForm: Dispatch<
    SetStateAction<{
      term: string;
      rawMessage: string;
      farmerPhone: string;
      language: string;
      cropType: string;
      district: string;
    }>
  >;
  onCreateTermTask: (e: FormEvent) => void;
}) {
  if (subTab === 'concepts') {
    return <ConceptsPanel search={search} />;
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
        Farmer-facing regional language and concepts. AI training masters (spray rules, resistance rotation) are in{' '}
        <Link to={toPath(paths.intelligence)} className="font-medium text-emerald-700 underline">
          Intelligence hub
        </Link>
        .
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Unknown words from WhatsApp are queued automatically. You can also add a term manually for review.
      </p>
      {canWrite ? (
        <form
          onSubmit={onCreateTermTask}
          className="mb-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Add term for review</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs text-slate-600">
              Unknown word / phrase *
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={termForm.term}
                onChange={(e) => setTermForm((f) => ({ ...f, term: e.target.value }))}
                placeholder="e.g. moola vattam"
                required
              />
            </label>
            <label className="block text-xs text-slate-600">
              Full farmer message
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={termForm.rawMessage}
                onChange={(e) => setTermForm((f) => ({ ...f, rawMessage: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-slate-600">
              Farmer phone (optional)
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={termForm.farmerPhone}
                onChange={(e) => setTermForm((f) => ({ ...f, farmerPhone: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-slate-600">
              Language
              <StaticSelect
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={termForm.language}
                onChange={(value) => setTermForm((f) => ({ ...f, language: value }))}
                options={['ml', 'en', 'ta', 'kn', 'hi'].map((l) => ({ value: l, label: l }))}
              />
            </label>
            <label className="block text-xs text-slate-600">
              Crop
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={termForm.cropType}
                onChange={(e) => setTermForm((f) => ({ ...f, cropType: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-slate-600">
              District
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={termForm.district}
                onChange={(e) => setTermForm((f) => ({ ...f, district: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="submit"
            className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Add to queue
          </button>
        </form>
      ) : null}
      <TerminologyLearningPanel
        key={terminologyRefreshKey}
        canWrite={canWrite}
        search={search}
        termStatus={termStatus}
        onTermStatusChange={onTermStatusChange}
      />
    </div>
  );
}

function ConceptsPanel({ search }: { search: string }) {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<{ ok: boolean; concepts: Concept[] }>(`${base}/terminology/concepts`)
      .then((d) => setConcepts(d.concepts ?? []))
      .catch(() => setConcepts([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = search.trim()
    ? concepts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.conceptCode ?? '').toLowerCase().includes(search.toLowerCase()) ||
          c.category.toLowerCase().includes(search.toLowerCase())
      )
    : concepts;

  if (loading) return <p className="text-sm text-slate-500">Loading concepts…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Standardized agricultural concepts linked to regional farmer terms. Map new terms from the Terminology tab.
      </p>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Concept</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Regional terms</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{c.conceptCode ?? '—'}</td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 capitalize">{c.category.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">{c.termCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No concepts match your search.</p>
        ) : null}
      </section>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Coming soon</p>
        <p className="mt-1">Disease library and crop knowledge modules will appear here as the knowledge base grows.</p>
      </div>
    </div>
  );
}
