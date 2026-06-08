import { useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, Panel, StaticSelect } from '../ui';
import { SEO_API } from './seo-api';

export function SeoSchemaPanel() {
  const [type, setType] = useState<'product' | 'faq' | 'breadcrumb' | 'article'>('product');
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  async function runPreview() {
    setError('');
    try {
      const payload = json.trim() ? JSON.parse(json) : samplePayload(type);
      const d = await api<{ ok: boolean; schema: Record<string, unknown> }>(`${SEO_API}/schema/preview`, {
        method: 'POST',
        body: JSON.stringify({ type, payload }),
      });
      setPreview(JSON.stringify(d.schema, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    }
  }

  return (
    <Panel title="Schema markup manager" description="Product, FAQ, Breadcrumb, Article, Review JSON-LD">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="seo-form-row mb-4">
        <StaticSelect
          value={type}
          onChange={(value) => setType(value as typeof type)}
          options={[
            { value: 'product', label: 'Product' },
            { value: 'faq', label: 'FAQ' },
            { value: 'breadcrumb', label: 'Breadcrumb' },
            { value: 'article', label: 'Article' },
          ]}
        />
        <Btn size="sm" onClick={() => void runPreview()}>
          Preview schema
        </Btn>
      </div>
      <label className="block mb-3 text-sm font-semibold">
        Input JSON (optional)
        <textarea className="w-full mt-1 font-mono text-sm" rows={6} value={json} onChange={(e) => setJson(e.target.value)} placeholder="Leave empty for sample payload" />
      </label>
      {preview ? (
        <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-96">{preview}</pre>
      ) : null}
    </Panel>
  );
}

function samplePayload(type: string): Record<string, unknown> {
  if (type === 'faq') {
    return {
      faqs: [
        { question: 'Why are ginger leaves yellow?', answer: 'Often nitrogen or zinc deficiency, or waterlogging.' },
      ],
    };
  }
  if (type === 'breadcrumb') {
    return {
      items: [
        { name: 'Home', url: 'https://morbeez.in' },
        { name: 'Ginger', url: 'https://morbeez.in/collections/ginger' },
      ],
    };
  }
  if (type === 'article') {
    return { title: 'Ginger Heat Stress Treatment', description: 'Guide for Indian farmers', url: '/ginger-heat-stress' };
  }
  return {
    name: 'Potassium Humate',
    description: 'Organic humic acid for root growth',
    sku: 'KH-500ML',
    price: 499,
    url: 'https://morbeez.in/products/potassium-humate',
  };
}
