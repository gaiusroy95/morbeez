import { useState } from 'react';
import { HubTabs, ReadOnlyBanner } from '../components/ui';
import { SeoDashboardPanel } from '../components/seo/SeoDashboardPanel';
import { SeoProductsPanel } from '../components/seo/SeoProductsPanel';
import { SeoContentPanel } from '../components/seo/SeoContentPanel';
import { SeoFaqPanel } from '../components/seo/SeoFaqPanel';
import { SeoLinksPanel } from '../components/seo/SeoLinksPanel';
import { SeoSchemaPanel } from '../components/seo/SeoSchemaPanel';
import { SeoHealthPanel } from '../components/seo/SeoHealthPanel';
import { SeoKeywordsPanel } from '../components/seo/SeoKeywordsPanel';
import { SeoGscPanel } from '../components/seo/SeoGscPanel';
import { SeoSitemapPanel } from '../components/seo/SeoSitemapPanel';
import { SeoRegionalPanel } from '../components/seo/SeoRegionalPanel';
import '../styles/seo-hub.css';

type Tab =
  | 'dashboard'
  | 'products'
  | 'content'
  | 'faq'
  | 'links'
  | 'schema'
  | 'keywords'
  | 'health'
  | 'gsc'
  | 'sitemap'
  | 'regional';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'content', label: 'Content & crop pages' },
  { id: 'faq', label: 'FAQ' },
  { id: 'links', label: 'Internal links' },
  { id: 'schema', label: 'Schema' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'health', label: 'Health scan' },
  { id: 'gsc', label: 'Search Console' },
  { id: 'sitemap', label: 'Sitemaps' },
  { id: 'regional', label: 'Regional' },
];

export function SeoHubPage({ canWrite = false }: { canWrite?: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="seo-hub">
      <p className="seo-hub-intro muted">
        Google Visibility Management — product SEO, crop problem pages, internal linking, schema, GSC, and AI content.
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'dashboard' ? <SeoDashboardPanel /> : null}
      {tab === 'products' ? <SeoProductsPanel canWrite={canWrite} /> : null}
      {tab === 'content' ? <SeoContentPanel canWrite={canWrite} /> : null}
      {tab === 'faq' ? <SeoFaqPanel canWrite={canWrite} /> : null}
      {tab === 'links' ? <SeoLinksPanel canWrite={canWrite} /> : null}
      {tab === 'schema' ? <SeoSchemaPanel /> : null}
      {tab === 'keywords' ? <SeoKeywordsPanel canWrite={canWrite} /> : null}
      {tab === 'health' ? <SeoHealthPanel canWrite={canWrite} /> : null}
      {tab === 'gsc' ? <SeoGscPanel canWrite={canWrite} /> : null}
      {tab === 'sitemap' ? <SeoSitemapPanel canWrite={canWrite} /> : null}
      {tab === 'regional' ? <SeoRegionalPanel canWrite={canWrite} /> : null}
    </div>
  );
}
