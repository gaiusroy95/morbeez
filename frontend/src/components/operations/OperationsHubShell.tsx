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
  onSectionChange,
  onSubTabChange,
  canWrite,
  visibility,
  children,
}: {
  section: OpsSection;
  subTab: OpsSubTab;
  onSectionChange: (s: OpsSection) => void;
  onSubTabChange: (t: OpsSubTab) => void;
  canWrite: boolean;
  visibility: OpsHubVisibility;
  children: ReactNode;
}) {
  const subTabs = visibleSubTabs(section, visibility);
  const showSubTabs = subTabs.length > 1;

  return (
    <div className="operations-hub">
      <p className="muted" style={{ marginBottom: 12 }}>
        {SECTION_DESCRIPTIONS[section]}
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      <HubTabs tabs={OPS_SECTIONS} active={section} onChange={onSectionChange} />
      {showSubTabs ? (
        <div className="mt-4">
          <HubTabs
            tabs={subTabs.map((t) => ({ id: t.id, label: t.label }))}
            active={subTab}
            onChange={(id) => onSubTabChange(id as OpsSubTab)}
          />
        </div>
      ) : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}
