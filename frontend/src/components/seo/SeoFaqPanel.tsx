import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { SEO_API } from './seo-api';

type Faq = {
  id: string;
  question: string;
  answer: string;
  shopify_product_id: string | null;
  page_id: string | null;
  schema_enabled: boolean;
  ai_generated: boolean;
};

export function SeoFaqPanel({ canWrite }: { canWrite: boolean }) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ question: '', answer: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; faqs: Faq[] }>(`${SEO_API}/faqs`);
      setFaqs(d.faqs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!canWrite || !draft.question.trim()) return;
    await api(`${SEO_API}/faqs`, { method: 'POST', body: JSON.stringify(draft) });
    setDraft({ question: '', answer: '' });
    await load();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    await api(`${SEO_API}/faqs/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <Panel title="FAQ SEO builder" description="FAQ schema improves featured snippets and AI search visibility">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Loading /> : null}
      {canWrite ? (
        <div className="seo-form-row mb-4">
          <input
            className={inputClass}
            placeholder="Question e.g. Why are ginger leaves yellow?"
            value={draft.question}
            onChange={(e) => setDraft((s) => ({ ...s, question: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Answer"
            value={draft.answer}
            onChange={(e) => setDraft((s) => ({ ...s, answer: e.target.value }))}
          />
          <Btn size="sm" onClick={() => void add()}>
            Add FAQ
          </Btn>
        </div>
      ) : null}
      {faqs.length === 0 && !loading ? <EmptyState>No FAQs yet.</EmptyState> : null}
      {faqs.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Question</th>
                <th>Answer</th>
                <th>Schema</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {faqs.map((f) => (
                <tr key={f.id}>
                  <td>{f.question}</td>
                  <td className="text-sm">{f.answer.slice(0, 120)}{f.answer.length > 120 ? '…' : ''}</td>
                  <td>{f.schema_enabled ? '✓' : '—'}</td>
                  <td>
                    {canWrite ? (
                      <Btn size="sm" variant="secondary" onClick={() => void remove(f.id)}>
                        Delete
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
  );
}
