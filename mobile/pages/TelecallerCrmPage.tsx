import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import {
  Alert,
  Btn,
  EmptyState,
  HubTabs,
  ListCard,
  Loading,
  Panel,
  ReadOnlyBanner,
  StatCard,
} from '@/components/ui';
import { api } from '@/lib/api';
import { theme } from '@/lib/theme';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

type Overview = {
  callsToday: number;
  pendingFollowUps: number;
  followUpsDueToday?: number;
  interestedFarmers: number;
  myLeadsCount: number;
  allLeadsCount: number;
};

type LeadRow = {
  id: string;
  farmerName: string;
  phone: string | null;
  stageLabel: string;
  stage: string;
  district: string | null;
  lastInteractionLabel: string | null;
  followUpLabel?: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  dueLabel?: string;
  farmerName?: string;
};

type CrmView = 'workspace' | 'escalations';

const STAGE_TONE: Record<string, 'default' | 'active' | 'archived' | 'role'> = {
  new_lead: 'role',
  interested: 'active',
  follow_up: 'default',
  order_placed: 'active',
};

export function TelecallerCrmPage({ canWrite }: { canWrite: boolean }) {
  const base = '/morbeez-staff/api/v1/os/telecaller';
  const [crmView, setCrmView] = useState<CrmView>('workspace');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [pendingEscalations, setPendingEscalations] = useState(0);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        scope,
        page: '1',
        limit: '40',
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const [ov, leadRes, taskRes, badges] = await Promise.all([
        api<{ ok: boolean; overview: Overview }>(`${base}/overview`),
        api<{ ok: boolean; leads: LeadRow[] }>(`${base}/leads?${params}`),
        api<{ ok: boolean; tasks: TaskRow[] }>(`${base}/tasks?status=pending`),
        api<{ ok: boolean; badges: { pendingEscalations?: number } }>(`${base}/nav-badges`).catch(
          () => ({ ok: true, badges: { pendingEscalations: 0 } })
        ),
      ]);
      setOverview(ov.overview);
      setLeads(leadRes.leads ?? []);
      setTasks(taskRes.tasks ?? []);
      setPendingEscalations(badges.badges.pendingEscalations ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CRM');
    } finally {
      setLoading(false);
    }
  }, [scope, search]);

  useEffect(() => {
    void load();
  }, [scope]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const compare = 'yesterday';

  return (
    <ConsoleScreenLayout scroll={false}>
      <HubTabs
        tabs={[
          { id: 'workspace' as CrmView, label: 'Workspace' },
          { id: 'escalations' as CrmView, label: `Escalations${pendingEscalations ? ` (${pendingEscalations})` : ''}` },
        ]}
        active={crmView}
        onChange={setCrmView}
      />

      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}

      {crmView === 'escalations' ? (
        <Panel title="Escalations">
          <Text style={styles.muted}>
            {pendingEscalations
              ? `${pendingEscalations} pending escalation(s). Full escalation workflow is available on web console.`
              : 'No pending escalations.'}
          </Text>
        </Panel>
      ) : loading && !overview ? (
        <Loading label="Loading CRM…" />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {overview ? (
                <View style={styles.statGrid}>
                  <StatCard label="Calls today" value={String(overview.callsToday)} trendPct={0} compare={compare} />
                  <StatCard
                    label="Follow-ups due"
                    value={String(overview.followUpsDueToday ?? overview.pendingFollowUps)}
                    trendPct={0}
                    compare={compare}
                  />
                  <StatCard
                    label="Interested"
                    value={String(overview.interestedFarmers)}
                    trendPct={0}
                    compare={compare}
                  />
                  <StatCard label="My leads" value={String(overview.myLeadsCount)} trendPct={0} compare={compare} />
                </View>
              ) : null}

              {tasks.length > 0 ? (
                <Panel title="Pending tasks">
                  {tasks.slice(0, 5).map((t) => (
                    <ListCard
                      key={t.id}
                      title={t.title}
                      subtitle={t.farmerName}
                      meta={t.dueLabel ?? undefined}
                    />
                  ))}
                </Panel>
              ) : null}

              <View style={styles.scopeRow}>
                <Btn size="sm" variant={scope === 'mine' ? 'primary' : 'secondary'} onPress={() => setScope('mine')}>
                  My leads
                </Btn>
                <Btn size="sm" variant={scope === 'all' ? 'primary' : 'secondary'} onPress={() => setScope('all')}>
                  All leads
                </Btn>
              </View>

              <TextInput
                style={styles.search}
                placeholder="Search farmers, phone, district…"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />

              {selectedLead ? (
                <Panel title={selectedLead.farmerName}>
                  <Text style={styles.detailLine}>Phone: {selectedLead.phone ?? '—'}</Text>
                  <Text style={styles.detailLine}>District: {selectedLead.district ?? '—'}</Text>
                  <Text style={styles.detailLine}>Stage: {selectedLead.stageLabel}</Text>
                  <Text style={styles.detailLine}>
                    Last interaction: {selectedLead.lastInteractionLabel ?? '—'}
                  </Text>
                  {selectedLead.followUpLabel ? (
                    <Text style={styles.detailLine}>Follow-up: {selectedLead.followUpLabel}</Text>
                  ) : null}
                  <Btn size="sm" variant="secondary" onPress={() => setSelectedLead(null)}>
                    Close detail
                  </Btn>
                </Panel>
              ) : null}

              <Text style={styles.sectionTitle}>Leads ({leads.length})</Text>
            </>
          }
          renderItem={({ item }) => (
            <ListCard
              title={item.farmerName}
              subtitle={[item.stageLabel, item.phone, item.district].filter(Boolean).join(' · ') || '—'}
              meta={item.followUpLabel ?? item.lastInteractionLabel ?? undefined}
              onPress={() => setSelectedLead(item)}
            />
          )}
          ListEmptyComponent={<EmptyState>No leads match your filters.</EmptyState>}
        />
      )}
    </ConsoleScreenLayout>
  );
}

// Patch ListCard usage to show badge - I'll add badge in renderItem via custom view instead

const styles = StyleSheet.create({
  listContent: { paddingBottom: 24 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  scopeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    marginBottom: 12,
    fontSize: 15,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 8 },
  detailLine: { fontSize: 14, color: theme.text, marginBottom: 6 },
  muted: { color: theme.muted, fontSize: 14 },
});
