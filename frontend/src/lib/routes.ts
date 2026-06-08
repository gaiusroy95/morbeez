/** App routes are relative to React Router basename (default `/` on Vercel). */

export const paths = {
  login: 'login',
  acceptInvite: 'accept-invite',
  forgotPassword: 'forgot-password',
  resetPassword: 'reset-password',
  dashboard: 'dashboard',
  telecaller: 'telecaller',
  operations: 'operations',
  intelligence: 'intelligence',
  opportunity: 'opportunity',
  productGaps: 'product-gaps',
  agronomist: 'agronomist',
  approvals: 'approvals',
  analytics: 'analytics',
  commerce: 'commerce',
  commerceQuoteView: 'commerce/quotes/:quoteId',
  commerceQuoteCheckout: 'commerce/quotes/:quoteId/checkout',
  warehouse: 'warehouse',
  warehousePrint: 'warehouse/print/:docType/:entityId',
  seo: 'seo',
  commerceProductNew: 'commerce/products/new',
  commerceProductEdit: 'commerce/products/:productId/edit',
  employees: 'employees',
  employeeDetail: 'employees/:employeeId',
  settings: 'settings',
} as const;

/** Absolute in-app path (relative to router basename). */
export function toPath(segment: string): string {
  return segment.startsWith('/') ? segment : `/${segment}`;
}

export type AppPath = (typeof paths)[keyof typeof paths];

export const ROUTE_META: Record<
  string,
  { title: string; module: string; pageKey: string }
> = {
  [toPath(paths.dashboard)]: { title: 'Dashboard', module: 'dashboard', pageKey: 'dashboard' },
  [toPath(paths.telecaller)]: {
    title: 'Telecaller CRM Workspace',
    module: 'telecaller_crm',
    pageKey: 'telecaller',
  },
  [toPath(paths.operations)]: {
    title: 'Operations Center',
    module: 'operations',
    pageKey: 'operations',
  },
  [toPath(paths.intelligence)]: {
    title: 'Agriculture Intelligence',
    module: 'intelligence',
    pageKey: 'intelligence',
  },
  [toPath(paths.opportunity)]: {
    title: 'Opportunity intelligence',
    module: 'intelligence',
    pageKey: 'opportunity',
  },
  [toPath(paths.productGaps)]: {
    title: 'Product Gaps',
    module: 'intelligence',
    pageKey: 'gaps',
  },
  [toPath(paths.agronomist)]: { title: 'Agronomist Hub', module: 'agronomist', pageKey: 'agronomist' },
  [toPath(paths.approvals)]: {
    title: 'Recommendation Approvals',
    module: 'approve_recommendations',
    pageKey: 'approvals',
  },
  [toPath(paths.analytics)]: { title: 'Analytics', module: 'analytics', pageKey: 'analytics' },
  [toPath(paths.commerce)]: { title: 'Commerce', module: 'commerce', pageKey: 'commerce' },
  [toPath(paths.warehouse)]: { title: 'Warehouse & OMS', module: 'warehouse', pageKey: 'warehouse' },
  [toPath(paths.seo)]: { title: 'SEO Control Panel', module: 'seo', pageKey: 'seo' },
  [toPath(paths.commerceProductNew)]: {
    title: 'Add Product',
    module: 'commerce',
    pageKey: 'commerce',
  },
  [toPath(paths.employees)]: { title: 'Employee Workspace', module: 'settings', pageKey: 'employees' },
  [toPath(paths.settings)]: { title: 'Settings', module: 'settings', pageKey: 'settings' },
};

export function matchRouteMeta(pathname: string): { title: string; module: string; pageKey: string } {
  const key = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (key.startsWith('/employees/') && key !== '/employees') {
    return { title: 'Employee Details', module: 'settings', pageKey: 'employees' };
  }
  if (key.includes('/commerce/products/') && key.endsWith('/edit')) {
    return { title: 'Edit Product', module: 'commerce', pageKey: 'commerce' };
  }
  if (key.endsWith('/commerce/products/new')) {
    return { title: 'Add Product', module: 'commerce', pageKey: 'commerce' };
  }
  if (key.includes('/commerce/quotes/') && key.endsWith('/checkout')) {
    return { title: 'Quote Checkout', module: 'commerce', pageKey: 'commerce' };
  }
  if (key.includes('/commerce/quotes/') && !key.endsWith('/checkout')) {
    return { title: 'View Quotation', module: 'commerce', pageKey: 'commerce' };
  }
  return (
    ROUTE_META[key] ?? {
      title: 'Console',
      module: 'dashboard',
      pageKey: 'dashboard',
    }
  );
}
