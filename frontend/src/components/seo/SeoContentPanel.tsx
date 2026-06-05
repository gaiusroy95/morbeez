import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  Loading,
  Panel,
  TableWrap,
  inputClass,
} from '../ui';
import { SEO_API } from './seo-api';

type ContentPage = {
  id: string;
  page_type: string;
  slug: string;
  title: string;
  crop: string | null;
  problem: string | null;
  status: string;
  ai_generated: boolean;
};

export function SeoContentPanel({ canWrite }: { canWrite: boolean }) {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState({ crop: 'Ginger', problem: 'Yellowing', stage: '60 DAP', region: 'Karnataka' });
  const [article, setArticle] = useState({ topic: '', crop: '', region: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; pages: ContentPage[] }>(`${SEO_API}/pages`);
      setPages(d.pages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateCropProblem() {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${SEO_API}/pages/generate-crop-problem`, {
        method: 'POST',
        body: JSON.stringify({ ...gen, useAi: true }),
      });
      setMsg(`Created AI crop-problem page for ${gen.crop} / ${gen.problem}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function generateArticle() {
    if (!canWrite || !article.topic.trim()) return;
    setBusy(true);
    try {
      await api(`${SEO_API}/ai/article`, { method: 'POST', body: JSON.stringify(article) });
      setMsg('Article draft created');
      setArticle({ topic: '', crop: '', region: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Article generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function publish(id: string) {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; storefrontUrl?: string }>(`${SEO_API}/pages/${id}/publish`, {
        method: 'POST',
      });
      setMsg(r.storefrontUrl ? `Published → ${r.storefrontUrl}` : 'Published to Shopify');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seo-content">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {msg ? <Alert tone="success">{msg}</Alert> : null}

      {canWrite ? (
        <Panel title="Dynamic content SEO engine" description="Crop + problem + stage → URL, meta, FAQ, recommendations">
          <div className="seo-form-row">
            <label>
              Crop
              <input className={inputClass} value={gen.crop} onChange={(e) => setGen((s) => ({ ...s, crop: e.target.value }))} />
            </label>
            <label>
              Problem
              <input className={inputClass} value={gen.problem} onChange={(e) => setGen((s) => ({ ...s, problem: e.target.value }))} />
            </label>
            <label>
              Stage
              <input className={inputClass} value={gen.stage} onChange={(e) => setGen((s) => ({ ...s, stage: e.target.value }))} />
            </label>
            <label>
              Region
              <input className={inputClass} value={gen.region} onChange={(e) => setGen((s) => ({ ...s, region: e.target.value }))} />
            </label>
            <Btn size="sm" onClick={() => void generateCropProblem()} disabled={busy}>
              {busy ? 'Generating…' : 'Generate page (AI)'}
            </Btn>
          </div>
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title="AI agronomy article" className="mt-4">
          <div className="seo-form-row">
            <input
              className={inputClass}
              placeholder="Article topic e.g. High soil pH correction"
              value={article.topic}
              onChange={(e) => setArticle((s) => ({ ...s, topic: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Crop (optional)"
              value={article.crop}
              onChange={(e) => setArticle((s) => ({ ...s, crop: e.target.value }))}
            />
            <Btn size="sm" onClick={() => void generateArticle()} disabled={busy}>
              Generate article
            </Btn>
          </div>
        </Panel>
      ) : null}

      <Panel title="SEO content pages" className="mt-4">
        {loading ? <Loading /> : null}
        {!loading && pages.length === 0 ? <EmptyState>No content pages yet.</EmptyState> : null}
        {!loading && pages.length > 0 ? (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>URL</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.title}
                      {p.ai_generated ? <span className="seo-status-pill seo-status-pill--draft ml-2">AI</span> : null}
                    </td>
                    <td>{p.page_type}</td>
                    <td className="mono">/pages/{p.slug}</td>
                    <td>
                      <span
                        className={`seo-status-pill ${p.status === 'published' ? 'seo-status-pill--ok' : 'seo-status-pill--draft'}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>
                      {canWrite && p.status !== 'published' ? (
                        <Btn size="sm" variant="secondary" onClick={() => void publish(p.id)}>
                          Publish
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        ) : null}
      </Panel>
    </div>
  );
}
