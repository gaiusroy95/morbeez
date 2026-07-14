import type { ReactNode } from 'react';
import { HubTabs, ReadOnlyBanner } from '../ui';
import {
  OPS_SECTIONS,
  SECTION_DESCRIPTIONS,
  type OpsSection,
  type OpsSubTab,
  visibleSubTabs,
  type OpsHubVisibility,
} from '../../lib/operations-hub-nav';

export function OperationsHubShell({
  section,
  subTab,
  onSubTabChange,
  canWrite,
  visibility,
  children,
}: {
  section: OpsSection;
  subTab: OpsSubTab;
  /** @deprecated Section is chosen from the CRM & AI sidebar — kept optional for callers. */
  onSectionChange?: (s: OpsSection) => void;
  onSubTabChange: (t: OpsSubTab) => void;
  canWrite: boolean;
  visibility: OpsHubVisibility;
  children: ReactNode;
}) {
  const subTabs = visibleSubTabs(section, visibility);
  const showSubTabs = subTabs.length > 1;
  const sectionLabel = OPS_SECTIONS.find((s) => s.id === section)?.label ?? 'Operations';

  return (
    <div className="operations-hub">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{sectionLabel}</h2>
        <p className="mt-1 text-sm text-ink-muted">{SECTION_DESCRIPTIONS[section]}</p>
      </header>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {showSubTabs ? (
        <HubTabs
          tabs={subTabs.map((t) => ({ id: t.id, label: t.label }))}
          active={subTab}
          onChange={(id) => onSubTabChange(id as OpsSubTab)}
        />
      ) : null}
      <div className={showSubTabs ? 'mt-6' : 'mt-2'}>{children}</div>
    </div>
  );
}
