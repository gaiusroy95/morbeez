import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, KeyValueRow, Loading, Panel, ReadOnlyBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatInr } from '@/lib/format';
import { useEffect, useState } from 'react';

export function ProductWizardPage({
  canWrite,
  productId,
}: {
  canWrite: boolean;
  productId?: string;
}) {
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(productId));

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
    api<{ ok: boolean; product: Record<string, unknown> }>(
      `/morbeez-staff/api/v1/products/${productId}`
    )
      .then((d) => setProduct(d.product))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load product'))
      .finally(() => setLoading(false));
  }, [productId]);

  const title = productId ? 'Edit Product' : 'Add Product';

  return (
    <ConsoleScreenLayout title={title}>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <Loading label="Loading product…" />
      ) : productId && product ? (
        <Panel title={String(product.title ?? 'Product')}>
          <KeyValueRow label="Status" value={String(product.status ?? '—')} />
          <KeyValueRow label="Category" value={String(product.category ?? '—')} />
          <KeyValueRow label="Brand" value={String(product.brand ?? '—')} />
          <KeyValueRow
            label="Price"
            value={product.priceInr != null ? formatInr(Number(product.priceInr)) : '—'}
          />
          <KeyValueRow label="Stock" value={String(product.stockQty ?? '—')} />
        </Panel>
      ) : (
        <Panel title="New product">
          <KeyValueRow label="Status" value="Use web console for full product wizard" />
        </Panel>
      )}
    </ConsoleScreenLayout>
  );
}
