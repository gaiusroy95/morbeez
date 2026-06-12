import { toPath, paths } from './routes';

export type OpsSection = 'communications' | 'knowledge' | 'automation' | 'market';

export type CommunicationsTab = 'broadcasts' | 'whatsappTemplates' | 'quickReplies';
export type KnowledgeTab = 'terminology' | 'concepts';
export type AutomationTab = 'campaignRules' | 'weatherAdvisory' | 'jobMonitor';
export type MarketTab = 'prices';

export type OpsSubTab = CommunicationsTab | KnowledgeTab | AutomationTab | MarketTab;

export const OPS_SECTIONS: Array<{ id: OpsSection; label: string }> = [
  { id: 'communications', label: 'Communications' },
  { id: 'knowledge', label: 'Knowledge Base' },
  { id: 'automation', label: 'Automation' },
  { id: 'market', label: 'Market Prices' },
];

export const SECTION_SUB_TABS: Record<
  OpsSection,
  Array<{ id: OpsSubTab; label: string; adminOnly?: boolean }>
> = {
  communications: [
    { id: 'broadcasts', label: 'Broadcasts' },
    { id: 'whatsappTemplates', label: 'WhatsApp templates' },
    { id: 'quickReplies', label: 'Quick replies' },
  ],
  knowledge: [
    { id: 'terminology', label: 'Terminology' },
    { id: 'concepts', label: 'Concepts' },
  ],
  automation: [
    { id: 'campaignRules', label: 'Campaign rules' },
    { id: 'weatherAdvisory', label: 'Weather & advisory' },
    { id: 'jobMonitor', label: 'Job monitor', adminOnly: true },
  ],
  market: [{ id: 'prices', label: 'Daily prices' }],
};

export const SECTION_DESCRIPTIONS: Record<OpsSection, string> = {
  communications:
    'WhatsApp broadcasts, system message templates, and telecaller quick replies — everything farmers receive from Morbeez.',
  knowledge:
    'Regional farmer language, agricultural concepts, and localized terminology for accurate AI replies.',
  automation:
    'Scheduled campaign rules, weather-driven advisory actions, and background job monitoring.',
  market: 'Daily mandi prices, farmer market preferences, and field GPS for price personalization.',
};

export const DEFAULT_TAB: Record<OpsSection, OpsSubTab> = {
  communications: 'broadcasts',
  knowledge: 'terminology',
  automation: 'campaignRules',
  market: 'prices',
};

export function isOpsSection(value: string | null): value is OpsSection {
  return value === 'communications' || value === 'knowledge' || value === 'automation' || value === 'market';
}

export function isSubTabForSection(section: OpsSection, tab: string | null): tab is OpsSubTab {
  if (!tab) return false;
  return SECTION_SUB_TABS[section].some((t) => t.id === tab);
}

export function defaultSectionForRole(role: string | undefined | null): OpsSection {
  switch (role) {
    case 'telecaller':
    case 'manager':
      return 'communications';
    case 'agronomist':
      return 'knowledge';
    case 'operations':
      return 'market';
    case 'admin':
    case 'super_admin':
      return 'communications';
    default:
      return 'communications';
  }
}

export function defaultTabForRole(role: string | undefined | null, section: OpsSection): OpsSubTab {
  if (section === 'communications' && (role === 'telecaller' || role === 'manager')) {
    return 'quickReplies';
  }
  return DEFAULT_TAB[section];
}

export function parseOpsHubParams(searchParams: URLSearchParams): {
  section: OpsSection;
  tab: OpsSubTab;
} {
  const sectionParam = searchParams.get('section');
  const section = isOpsSection(sectionParam) ? sectionParam : 'communications';
  const tabParam = searchParams.get('tab');
  const tab = isSubTabForSection(section, tabParam) ? tabParam : DEFAULT_TAB[section];
  return { section, tab };
}

export function buildOpsHubUrl(section: OpsSection, tab?: OpsSubTab): string {
  const resolvedTab = tab ?? DEFAULT_TAB[section];
  const base = toPath(paths.operations);
  if (section === 'communications' && resolvedTab === 'broadcasts') {
    return base;
  }
  const params = new URLSearchParams();
  params.set('section', section);
  params.set('tab', resolvedTab);
  return `${base}?${params.toString()}`;
}

export function operationsHomePath(role: string | undefined | null): string {
  const section = defaultSectionForRole(role);
  const tab = defaultTabForRole(role, section);
  return buildOpsHubUrl(section, tab);
}

export type OpsHubVisibility = {
  canIntelligence: boolean;
  canSettings: boolean;
  isAdminRole: boolean;
};

export function visibleSubTabs(
  section: OpsSection,
  vis: OpsHubVisibility
): Array<{ id: OpsSubTab; label: string }> {
  return SECTION_SUB_TABS[section].filter((t) => {
    if (t.adminOnly && !vis.isAdminRole && !vis.canSettings) return false;
    return true;
  });
}

export function resolveOperationsPageTitle(section: OpsSection, tab: OpsSubTab): string {
  const sectionLabel = OPS_SECTIONS.find((s) => s.id === section)?.label ?? 'Operations';
  const tabLabel =
    SECTION_SUB_TABS[section].find((t) => t.id === tab)?.label ?? tab;
  return `${sectionLabel} — ${tabLabel}`;
}

export function opsSearchMode(section: OpsSection, tab: OpsSubTab): 'none' | 'local' {
  if (section === 'communications' && tab === 'broadcasts') return 'none';
  if (section === 'knowledge' && tab === 'concepts') return 'none';
  if (section === 'automation' && (tab === 'campaignRules' || tab === 'weatherAdvisory')) return 'none';
  return 'local';
}
