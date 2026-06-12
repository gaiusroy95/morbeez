import { useState } from 'react';
import { useSyncConsoleSearch } from '../../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../../lib/console-page-search';
import { BroadcastAutomationPanel } from '../../components/broadcasts/BroadcastAutomationPanel';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { ReadOnlyBanner } from '../../components/ui';

export function BroadcastAutomationPage({ canWrite }: { canWrite: boolean }) {
  const [search, setSearch] = useState('');
  const searchDefaults = defaultsForPage('broadcasts-automation');
  useSyncConsoleSearch(search, setSearch, searchDefaults.placeholder ?? 'Search rules…');

  return (
    <div>
      <p className="muted" style={{ marginBottom: 8 }}>
        DAP/weekday automation rules and manual dry-run trigger
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      <BroadcastSubNav />
      <BroadcastAutomationPanel canWrite={canWrite} search={search} />
    </div>
  );
}
