import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert } from '../ui';

type ShopifyConnection = {
  connected: boolean;
  storeDomain: string;
  storefrontUrl: string;
  productCount: number;
  storeMismatch: boolean;
  message: string;
};

type Props = {
  /** Reserved for future tab-specific messaging. */
  label?: string;
};

/** Shows live Shopify connection status on promotion tabs (replaces outdated registry warnings). */
export function CommerceShopifySyncBanner(_props: Props = {}) {
  const [status, setStatus] = useState<ShopifyConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ ok: boolean } & ShopifyConnection>('/morbeez-staff/api/v1/products/shopify-connection')
      .then((d) => {
        if (!cancelled) setStatus(d);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            connected: false,
            storeDomain: '',
            storefrontUrl: '',
            productCount: 0,
            storeMismatch: false,
            message: 'Could not verify Shopify connection.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  if (!status.connected || status.storeMismatch) {
    return (
      <Alert tone="error" className="commerce-registry-banner">
        <strong>Shopify storefront issue:</strong> {status.message}
        {status.storefrontUrl ? (
          <>
            {' '}
            <a href={status.storefrontUrl} target="_blank" rel="noreferrer">
              Open storefront
            </a>
          </>
        ) : null}
      </Alert>
    );
  }

  return (
    <div className="commerce-products__shopify-ok commerce-registry-banner">
      <span>
        Shopify: {status.storeDomain} · Connected
        {status.productCount > 0
          ? ` · ${status.productCount} product${status.productCount === 1 ? '' : 's'} on storefront`
          : ''}
      </span>
      <a href={status.storefrontUrl} target="_blank" rel="noreferrer">
        Open storefront
      </a>
    </div>
  );
}
