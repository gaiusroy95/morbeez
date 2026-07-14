import type { ApiModule } from './api';
import { canAccess } from './api';
import { buildOpsHubUrl } from './operations-hub-nav';
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
      {
        id: 'telecaller',
        path: toPath(paths.telecaller),
        label: 'Telecaller CRM',
        icon: 'phone',
        module: 'telecaller_crm',
      },
    ],
  },
  {
    id: 'crm-ai',
    label: 'CRM & AI',
    icon: 'sparkles',
    module: 'operations',
    children: [
      {
        id: 'ops-communications',
        path: buildOpsHubUrl('communications'),
        label: 'Communications',
        icon: 'megaphone',
        module: 'operations',
      },
      {
        id: 'ops-knowledge',
        path: buildOpsHubUrl('knowledge'),
        label: 'Knowledge Base',
        icon: 'book',
        module: 'operations',
      },
      {
        id: 'ops-automation',
        path: buildOpsHubUrl('automation'),
        label: 'Automation',
        icon: 'bolt',
        module: 'operations',
      },
      {
        id: 'ops-market',
        path: buildOpsHubUrl('market'),
        label: 'Market Prices',
        icon: 'sales',
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
        icon: 'layers',
        module: 'intelligence',
      },
      {
        id: 'opportunity',
        path: toPath(paths.opportunity),
        label: 'Opportunity',
        icon: 'target',
        module: 'intelligence',
      },
      {
        id: 'resistance',
        path: toPath(paths.resistanceDashboard),
        label: 'Resistance',
        icon: 'shield',
        module: 'intelligence',
      },
      {
        id: 'knowledge',
        path: toPath(paths.knowledgeExplorer),
        label: 'Knowledge graph',
        icon: 'network',
        module: 'intelligence',
      },
      {
        id: 'gaps',
        path: toPath(paths.productGaps),
        label: 'Product gaps',
        icon: 'trend',
        module: 'intelligence',
      },
    ],
  },
  {
    id: 'partners',
    label: 'Partner Program',
    icon: 'partners',
    module: 'partner_program',
    children: [
      {
        id: 'partner-program',
        path: toPath(paths.partnerProgram),
        label: 'Partners',
        icon: 'partners',
        module: 'partner_program',
      },
    ],
  },
  {
    id: 'agro',
    label: 'Agronomist',
    icon: 'plant',
    module: 'agronomist',
    children: [
      {
        id: 'agronomist-visit-command',
        path: toPath(paths.agronomistVisitCommand),
        label: 'Visit command',
        icon: 'field',
        module: 'agronomist',
      },
      {
        id: 'agronomist',
        path: toPath(paths.agronomist),
        label: 'Operations',
        icon: 'calendar',
        module: 'agronomist',
      },
      {
        id: 'agronomist-ai',
        path: toPath(paths.agronomistAiReview),
        label: 'AI Review Center',
        icon: 'sparkles',
        module: 'agronomist',
      },
      {
        id: 'weakness',
        path: toPath(paths.weaknessDashboard),
        label: 'Weakness dashboard',
        icon: 'operations',
        module: 'agronomist',
      },
      {
        id: 'retraining',
        path: toPath(paths.retrainingOps),
        label: 'Retraining ops',
        icon: 'refresh',
        module: 'agronomist',
      },
      {
        id: 'similar-cases',
        path: toPath(paths.similarCasesExplorer),
        label: 'Similar cases',
        icon: 'users',
        module: 'agronomist',
      },
      {
        id: 'approvals',
        path: toPath(paths.approvals),
        label: 'Approvals',
        icon: 'clipboard',
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
        icon: 'briefcase',
        module: 'analytics',
      },
      {
        id: 'escalations',
        path: toPath(paths.escalationCommand),
        label: 'Escalations',
        icon: 'warning',
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
  const base = ['crm-ai', 'intel', 'agro'];
  if (pathname.startsWith(toPath(paths.operations)) || pathname.startsWith(toPath(paths.broadcasts))) {
    base.push('crm-ai');
  }
  if (pathname.startsWith(toPath(paths.commerce))) base.push('commerce');
  if (pathname.startsWith(toPath(paths.warehouse))) base.push('more');
  if (pathname.startsWith(toPath(paths.seo))) base.push('more');
  if (pathname.startsWith(toPath(paths.employees))) base.push('more');
  return base;
}

function pathMatchesLocation(pathname: string, pathOnly: string): boolean {
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

/**
 * Compare pathname (+ optional search) against a nav target that may include `?query`.
 * When `allNavPaths` is provided, a shorter parent (e.g. `/intelligence`) loses to a more
 * specific sibling (e.g. `/intelligence/resistance`) so only one item is active.
 */
export function isNavItemActive(
  pathname: string,
  itemPath: string,
  search = '',
  allNavPaths: string[] = []
): boolean {
  const [pathOnly, query = ''] = itemPath.split('?');
  const currentSearch = search.startsWith('?') ? search.slice(1) : search;

  // Operations hub: match by `section` so CRM & AI children don't all light up together.
  if (pathOnly === toPath(paths.operations)) {
    const itemSection = new URLSearchParams(query).get('section') || 'communications';
    if (pathname.startsWith(toPath(paths.broadcasts))) {
      return itemSection === 'communications';
    }
    if (pathname !== pathOnly) return false;
    const currentSection = new URLSearchParams(currentSearch).get('section') || 'communications';
    return itemSection === currentSection;
  }

  if (!pathMatchesLocation(pathname, pathOnly)) return false;

  // Prefer the most specific nav target when several prefix-match the location.
  if (allNavPaths.length > 0) {
    const hasMoreSpecificSibling = allNavPaths.some((other) => {
      if (other === itemPath) return false;
      const otherPath = other.split('?')[0];
      if (otherPath === pathOnly || otherPath.length <= pathOnly.length) return false;
      // other is under this item's path and also matches the current location
      return otherPath.startsWith(`${pathOnly}/`) && pathMatchesLocation(pathname, otherPath);
    });
    if (hasMoreSpecificSibling) return false;
  }

  return true;
}

/** Collect every navigable path from filtered nav groups (for longest-match active state). */
export function collectNavPaths(groups: typeof NAV_GROUPS): string[] {
  const pathsOut: string[] = [];
  for (const group of groups) {
    if ('items' in group) {
      for (const item of group.items) pathsOut.push(item.path);
    } else {
      for (const child of group.children) pathsOut.push(child.path);
    }
  }
  return pathsOut;
}
