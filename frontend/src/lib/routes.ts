/** App routes are relative to React Router basename (default `/` on Vercel). */

export const paths = {
  login: 'login',
  acceptInvite: 'accept-invite',
  forgotPassword: 'forgot-password',
  resetPassword: 'reset-password',
  dashboard: 'dashboard',
  telecaller: 'telecaller',
  operations: 'operations',
  operationsLanguageTemplate: 'operations/language-templates/:templateKey',
  broadcasts: 'broadcasts',
  broadcastsNew: 'broadcasts/new',
  broadcastsScheduled: 'broadcasts/scheduled',
  broadcastsSent: 'broadcasts/sent',
  broadcastsTemplates: 'broadcasts/templates',
  broadcastsAutomation: 'broadcasts/automation',
  broadcastsAnalytics: 'broadcasts/analytics',
  broadcastsAdmin: 'broadcasts/admin',
  intelligence: 'intelligence',
  opportunity: 'opportunity',
  partnerProgram: 'partners',
  productGaps: 'product-gaps',
  farmer360: 'farmers/:farmerId/360',
  communicationHub: 'communication',
  communicationHubFarmer: 'communication/:farmerId',
  plotIntelligence: 'plot-intelligence/:farmerId/:blockId',
  weaknessDashboard: 'ai-ops/weakness',
  retrainingOps: 'ai-ops/retraining',
  resistanceDashboard: 'intelligence/resistance',
  executiveCockpit: 'executive',
  escalationCommand: 'escalations',
  economicDashboard: 'analytics/economics',
  similarCasesExplorer: 'copilot/similar-cases',
  knowledgeExplorer: 'copilot/knowledge',
  agronomist: 'agronomist',
  agronomistFarmers: 'agronomist/farmers',
  agronomistVisitCommand: 'agronomist/visit-command',
  agronomistAiReview: 'agronomist/ai-review',
  agronomistVisit: 'agronomist/visit',
  agronomistVisitSuccess: 'agronomist/visit/success',
  agronomistVisitDetail: 'agronomist/visits/:findingId',
  agronomistOutcomeIntelligence: 'agronomist/outcome-intelligence',
  agronomistRoutes: 'agronomist/routes',
  agronomistRouteDetail: 'agronomist/routes/:routeId',
  agronomistMap: 'agronomist/map',
  approvals: 'approvals',
  analytics: 'analytics',
  regionalThreatRadar: 'operations/regional-threat-radar',
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
    title: 'Telecaller CRM',
    module: 'telecaller_crm',
    pageKey: 'telecaller',
  },
  [toPath(paths.operations)]: {
    title: 'Operations Hub',
    module: 'operations',
    pageKey: 'operations',
  },
  [toPath(paths.operationsLanguageTemplate)]: {
    title: 'Language Template Editor',
    module: 'operations',
    pageKey: 'operations',
  },
  [toPath(paths.broadcasts)]: {
    title: 'Broadcast Hub',
    module: 'operations',
    pageKey: 'broadcasts',
  },
  [toPath(paths.broadcastsNew)]: {
    title: 'Create Broadcast',
    module: 'operations',
    pageKey: 'broadcasts-new',
  },
  [toPath(paths.broadcastsScheduled)]: {
    title: 'Scheduled Broadcasts',
    module: 'operations',
    pageKey: 'broadcasts-scheduled',
  },
  [toPath(paths.broadcastsSent)]: {
    title: 'Sent Broadcasts',
    module: 'operations',
    pageKey: 'broadcasts-sent',
  },
  [toPath(paths.broadcastsTemplates)]: {
    title: 'Broadcast Templates',
    module: 'operations',
    pageKey: 'broadcasts-templates',
  },
  [toPath(paths.broadcastsAutomation)]: {
    title: 'Broadcast Automation',
    module: 'operations',
    pageKey: 'broadcasts-automation',
  },
  [toPath(paths.broadcastsAnalytics)]: {
    title: 'Broadcast Analytics',
    module: 'operations',
    pageKey: 'broadcasts-analytics',
  },
  [toPath(paths.broadcastsAdmin)]: {
    title: 'Broadcast Admin',
    module: 'operations',
    pageKey: 'broadcasts-admin',
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
  [toPath(paths.partnerProgram)]: {
    title: 'Partner Program',
    module: 'partner_program',
    pageKey: 'partners',
  },
  [toPath(paths.productGaps)]: {
    title: 'Product Gaps',
    module: 'intelligence',
    pageKey: 'gaps',
  },
  [toPath(paths.agronomist)]: { title: 'Agronomist Operations', module: 'agronomist', pageKey: 'agronomist' },
  [toPath(paths.agronomistVisitCommand)]: {
    title: 'Visit Command Center',
    module: 'agronomist',
    pageKey: 'agronomist-visit-command',
  },
  [toPath(paths.agronomistAiReview)]: {
    title: 'AI Review Center',
    module: 'agronomist',
    pageKey: 'agronomist-ai',
  },
  [toPath(paths.agronomistVisit)]: {
    title: 'Field Visit',
    module: 'agronomist',
    pageKey: 'agronomist-visit',
  },
  [toPath(paths.agronomistVisitSuccess)]: {
    title: 'Visit Submitted',
    module: 'agronomist',
    pageKey: 'agronomist-visit',
  },
  [toPath(paths.agronomistRoutes)]: {
    title: 'Route Planner',
    module: 'agronomist',
    pageKey: 'agronomist-routes',
  },
  [toPath(paths.agronomistMap)]: {
    title: 'Farmer Map',
    module: 'agronomist',
    pageKey: 'agronomist-map',
  },
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
  if (key.startsWith('/operations/language-templates/')) {
    return ROUTE_META[toPath(paths.operationsLanguageTemplate)] ?? {
      title: 'Language Template Editor',
      module: 'operations',
      pageKey: 'operations',
    };
  }
  if (key.startsWith('/agronomist/visits/')) {
    return { title: 'Visit Detail', module: 'agronomist', pageKey: 'agronomist-visit' };
  }
  if (key.startsWith('/agronomist/routes/') && key !== '/agronomist/routes') {
    return { title: 'Route Detail', module: 'agronomist', pageKey: 'agronomist-routes' };
  }
  if (key.startsWith('/agronomist/visit')) {
    return ROUTE_META[toPath(paths.agronomistVisit)] ?? {
      title: 'Field Visit',
      module: 'agronomist',
      pageKey: 'agronomist-visit',
    };
  }
  if (key.startsWith('/broadcasts')) {
    return ROUTE_META[key] ?? { title: 'Broadcast Hub', module: 'operations', pageKey: 'broadcasts' };
  }
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
