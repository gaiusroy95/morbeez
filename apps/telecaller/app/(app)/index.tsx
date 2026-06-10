import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { STAFF_API_V1, staffApi, tokens } from '@morbeez/shared';
import {
  AlertBox,
  Btn,
  EmptyState,
  HubTabs,
  ListCard,
  Loading,
  StatCard,
} from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

const BASE = `${STAFF_API_V1}/os/telecaller`;

type Overview = {
  callsToday: number;
  pendingFollowUps: number;
  interestedFarmers: number;
  myLeadsCount: number;
  allLeadsCount: number;
};

type LeadRow = {
  id: string;
  farmerName: string;
  phone: string | null;
  stageLabel: string;
  district: string | null;
  followUpLabel?: string | null;
  opportunityScore?: number | null;
};

type CrmView = 'workspace' | 'escalations';

export default function TelecallerHomeScreen() {
  const router = useRouter();
  const { canWrite, logout } = useStaffAuth();
  const [crmView, setCrmView] = useState<CrmView>('workspace');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [escalations, setEscalations] = useState<Array<Record<string, unknown>>>([]);
  const [pendingEscalations, setPendingEscalations] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      if (crmView === 'escalations') {
        const esc = await staffApi<{ ok: boolean; escalations: Array<Record<string, unknown>> }>(
          `${BASE}/escalations?status=open&limit=50`
        );
        setEscalations(esc.escalations ?? []);
      } else {
        const params = new URLSearchParams({
          scope,
          page: '1',
          limit: '50',
          ...(search.trim() ? { search: search.trim() } : {}),
        });
        const [ov, leadRes, badges] = await Promise.all([
          staffApi<{ ok: boolean; overview: Overview }>(`${BASE}/overview`),
          staffApi<{ ok: boolean; leads: LeadRow[] }>(`${BASE}/leads/operational?${params}`).catch(() =>
            staffApi<{ ok: boolean; leads: LeadRow[] }>(`${BASE}/leads?${params}`)
          ),
          staffApi<{ ok: boolean; pendingEscalations?: number }>(`${BASE}/nav-badges`).catch(() => ({
            ok: true,
            pendingEscalations: 0,
          })),
        ]);
        setOverview(ov.overview);
        setLeads(leadRes.leads ?? []);
        setPendingEscalations(badges.pendingEscalations ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CRM');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, search, crmView]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading CRM workspace…" />;

  const listData = crmView === 'escalations' ? escalations : leads;

  return (
    <View style={styles.root}>
      <FlatList
        data={listData as LeadRow[]}
        keyExtractor={(l) => String((l as LeadRow).id ?? (l as Record<string, unknown>).id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <HubTabs
              tabs={[
                { id: 'workspace' as CrmView, label: 'Workspace' },
                { id: 'escalations' as CrmView, label: `Escalations (${pendingEscalations})` },
              ]}
              active={crmView}
              onChange={setCrmView}
            />
            {crmView === 'workspace' ? (
              <>
                <View style={styles.statsRow}>
                  <StatCard label="Calls today" value={overview?.callsToday ?? 0} />
                  <StatCard label="Follow-ups" value={overview?.pendingFollowUps ?? 0} />
                  <StatCard label="Interested" value={overview?.interestedFarmers ?? 0} />
                  <StatCard label="My leads" value={overview?.myLeadsCount ?? 0} />
                </View>
                <HubTabs
                  tabs={[
                    { id: 'mine' as const, label: 'My leads' },
                    { id: 'all' as const, label: 'All leads' },
                  ]}
                  active={scope}
                  onChange={setScope}
                />
                <TextInput
                  style={styles.search}
                  placeholder="Search farmer, phone, district…"
                  placeholderTextColor={tokens.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={() => void load()}
                  returnKeyType="search"
                />
                {!canWrite ? <Text style={styles.readOnly}>Read-only access</Text> : null}
              </>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          if (crmView === 'escalations') {
            const e = item as Record<string, unknown>;
            return (
              <ListCard
                title={String(e.farmerName ?? e.subject ?? 'Escalation')}
                subtitle={String(e.summary ?? e.status ?? '')}
                meta={String(e.status ?? '')}
                onPress={() => e.leadId && router.push(`/(app)/lead/${e.leadId}`)}
              />
            );
          }
          const lead = item as LeadRow;
          return (
            <ListCard
              title={lead.farmerName}
              subtitle={[lead.phone, lead.district, lead.followUpLabel].filter(Boolean).join(' · ') || '—'}
              meta={lead.stageLabel}
              onPress={() => router.push(`/(app)/lead/${lead.id}`)}
            />
          );
        }}
        ListEmptyComponent={<EmptyState>{crmView === 'escalations' ? 'No open escalations.' : 'No leads in queue.'}</EmptyState>}
        ListFooterComponent={<Btn label="Sign out" onPress={() => void logout()} variant="secondary" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  search: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  readOnly: { fontSize: 12, color: tokens.warning, marginBottom: 8 },
});
