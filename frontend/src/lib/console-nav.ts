import type { ApiModule } from './api';
import { canAccess } from './api';
import { paths, toPath } from './routes';

export type NavItem = {
  id: string;
  path: string;
  label: string;
  icon: string;
  module: string;
  external?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: string;
  module: string;
  children: NavItem[];
};

export const NAV_GROUPS: Array<{ id: string; items: NavItem[] } | NavGroup> = [
  {
    id: 'main',
    items: [
      { id: 'dashboard', path: toPath(paths.dashboard), label: 'Dashboard', icon: 'dashboard', module: 'dashboard' },
    ],
  },
  {
    id: 'telecaller',
    label: 'Telecaller CRM',
    icon: 'phone',
    module: 'telecaller_crm',
    children: [
      {
        id: 'telecaller',
        path: toPath(paths.telecaller),
        label: 'Workspace',
        icon: 'phone',
        module: 'telecaller_crm',
      },
      {
        id: 'telecaller-qc',
        path: `${toPath(paths.telecaller)}?view=qc`,
        label: 'Call QC',
        icon: 'analytics',
        module: 'telecaller_crm',
      },
    ],
  },
  {
    id: 'crm-ai',
    label: 'CRM & AI',
    icon: 'ai',
    module: 'operations',
    children: [
      {
        id: 'operations',
        path: toPath(paths.operations),
        label: 'Terminology & concepts',
        icon: 'operations',
        module: 'operations',
      },
    ],
  },
  {
    id: 'ops',
    label: 'Communications',
    icon: 'operations',
    module: 'operations',
    children: [
      {
        id: 'broadcasts',
        path: toPath(paths.broadcasts),
        label: 'Broadcasts',
        icon: 'operations',
        module: 'operations',
      },
    ],
  },
  {
    id: 'intel',
    label: 'Intelligence',
    icon: 'ai',
    module: 'intelligence',
    children: [
      {
        id: 'intelligence',
        path: toPath(paths.intelligence),
        label: 'Masters hub',
        icon: 'ai',
        module: 'intelligence',
      },
      {
        id: 'opportunity',
        path: toPath(paths.opportunity),
        label: 'Opportunity',
        icon: 'ai',
        module: 'intelligence',
      },
      {
        id: 'farmer-360-nav',
        path: toPath(paths.opportunity),
        label: 'Farmer 360 (from CRM)',
        icon: 'farmers',
        module: 'intelligence',
      },
      {
        id: 'resistance',
        path: toPath(paths.resistanceDashboard),
        label: 'Resistance',
        icon: 'ai',
        module: 'intelligence',
      },
      {
        id: 'knowledge',
        path: toPath(paths.knowledgeExplorer),
        label: 'Knowledge graph',
        icon: 'ai',
        module: 'intelligence',
      },
      {
        id: 'gaps',
        path: toPath(paths.productGaps),
        label: 'Product gaps',
        icon: 'ai',
        module: 'intelligence',
      },
    ],
  },
  {
    id: 'partners',
    label: 'Partner Program',
    icon: 'farmers',
    module: 'partner_program',
    children: [
      {
        id: 'partner-program',
        path: toPath(paths.partnerProgram),
        label: 'Partners',
        icon: 'farmers',
        module: 'partner_program',
      },
    ],
  },
  {
    id: 'agro',
    label: 'Agronomist',
    icon: 'farmers',
    module: 'agronomist',
    children: [
      {
        id: 'agronomist-visit-command',
        path: toPath(paths.agronomistVisitCommand),
        label: 'Visit command',
        icon: 'farmers',
        module: 'agronomist',
      },
      {
        id: 'agronomist',
        path: toPath(paths.agronomist),
        label: 'Operations',
        icon: 'farmers',
        module: 'agronomist',
      },
      {
        id: 'agronomist-ai',
        path: toPath(paths.agronomistAiReview),
        label: 'AI Review Center',
        icon: 'ai',
        module: 'agronomist',
      },
      {
        id: 'weakness',
        path: toPath(paths.weaknessDashboard),
        label: 'Weakness dashboard',
        icon: 'ai',
        module: 'agronomist',
      },
      {
        id: 'retraining',
        path: toPath(paths.retrainingOps),
        label: 'Retraining ops',
        icon: 'ai',
        module: 'agronomist',
      },
      {
        id: 'similar-cases',
        path: toPath(paths.similarCasesExplorer),
        label: 'Similar cases',
        icon: 'ai',
        module: 'agronomist',
      },
      {
        id: 'approvals',
        path: toPath(paths.approvals),
        label: 'Approvals',
        icon: 'ai',
        module: 'approve_recommendations',
      },
    ],
  },
  {
    id: 'more',
    items: [
      {
        id: 'employees',
        path: toPath(paths.employees),
        label: 'Employees',
        icon: 'users',
        module: 'settings',
      },
      {
        id: 'analytics',
        path: toPath(paths.analytics),
        label: 'Analytics',
        icon: 'analytics',
        module: 'analytics',
      },
      {
        id: 'executive',
        path: toPath(paths.executiveCockpit),
        label: 'Executive cockpit',
        icon: 'analytics',
        module: 'analytics',
      },
      {
        id: 'escalations',
        path: toPath(paths.escalationCommand),
        label: 'Escalations',
        icon: 'analytics',
        module: 'telecaller_crm',
      },
      {
        id: 'commerce',
        path: toPath(paths.commerce),
        label: 'Commerce',
        icon: 'products',
        module: 'commerce',
      },
      {
        id: 'warehouse',
        path: toPath(paths.warehouse),
        label: 'Warehouse',
        icon: 'warehouse',
        module: 'warehouse',
      },
      {
        id: 'seo',
        path: toPath(paths.seo),
        label: 'SEO',
        icon: 'seo',
        module: 'seo',
      },
      {
        id: 'settings',
        path: toPath(paths.settings),
        label: 'Settings',
        icon: 'settings',
        module: 'settings',
      },
    ],
  },
];

export function filterNav(modules: ApiModule[]): typeof NAV_GROUPS {
  const filtered: typeof NAV_GROUPS = [];

  for (const group of NAV_GROUPS) {
    if ('items' in group) {
      const items = group.items.filter((i) => canAccess(modules, i.module, 'read'));
      if (items.length) filtered.push({ ...group, items });
      continue;
    }
    const children = group.children.filter((c) => canAccess(modules, c.module, 'read'));
    if (canAccess(modules, group.module, 'read') && children.length) {
      filtered.push({ ...group, children });
    }
  }

  return filtered;
}

export function defaultExpandedGroups(pathname: string): string[] {
  const base = ['telecaller', 'crm-ai', 'ops', 'intel', 'agro'];
  if (pathname.startsWith(toPath(paths.broadcasts))) base.push('ops');
  if (pathname.startsWith(toPath(paths.operations))) base.push('ops');
  if (pathname.startsWith(toPath(paths.commerce))) base.push('commerce');
  if (pathname.startsWith(toPath(paths.warehouse))) base.push('more');
  if (pathname.startsWith(toPath(paths.seo))) base.push('more');
  if (pathname.startsWith(toPath(paths.employees))) base.push('more');
  return base;
}

export function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (itemPath === toPath(paths.employees)) {
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  }
  if (itemPath === toPath(paths.agronomist)) {
    return pathname === itemPath;
  }
  if (itemPath === toPath(paths.agronomistAiReview)) {
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  }
  if (itemPath === toPath(paths.operations)) {
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`) || pathname.startsWith(toPath(paths.broadcasts));
  }
  if (itemPath.startsWith(toPath(paths.telecaller))) {
    return pathname.startsWith(toPath(paths.telecaller));
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath.split('?')[0]}/`);
}
