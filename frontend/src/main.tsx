import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/admin.css';
import './styles/console-topbar.css';
import './styles/console-overrides.css';
import './styles/telecaller-crm.css';
import './styles/commerce-products.css';
import './styles/commerce-inventory.css';
import './styles/commerce-promotions.css';
import './styles/warehouse-hub.css';
import './styles/seo-hub.css';
import './styles/commerce-promo-pages.css';
import './styles/commerce-quotes.css';
import './styles/estimate-detail.css';
import './styles/company-settings.css';
import './styles/product-wizard.css';
import './styles/dynamic-master-picker.css';
import App from './App.tsx';
import { initSharedApiConfig } from './lib/init-shared-api';

initSharedApiConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
