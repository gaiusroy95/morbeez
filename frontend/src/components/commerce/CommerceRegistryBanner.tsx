import { Alert } from '../ui';

/** Promotions stored in Morbeez DB are not yet wired to Shopify checkout. */
export function CommerceRegistryBanner() {
  return (
    <Alert tone="info" className="commerce-registry-banner">
      Campaigns created here are stored in the Morbeez console registry. They are{' '}
      <strong>not yet applied</strong> on the Shopify storefront or checkout automatically.
    </Alert>
  );
}
