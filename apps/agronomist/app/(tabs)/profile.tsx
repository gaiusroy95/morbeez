import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function ProfileScreen() {
  const { admin, logout } = useStaffAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setProfile(await agronomistClient.getProfileStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !profile) return <Loading label="Loading profile…" />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Account">
        <KeyValueRow label="Name" value={admin?.fullName ?? admin?.email ?? '—'} />
        <KeyValueRow label="Email" value={admin?.email ?? '—'} />
        <KeyValueRow label="Role" value={admin?.role ?? '—'} />
      </Panel>

      <Panel title="Your stats">
        <KeyValueRow label="Visits this month" value={String(profile?.visitsThisMonth ?? '—')} />
        <KeyValueRow label="Farmers assigned" value={String(profile?.assignedFarmers ?? '—')} />
        <KeyValueRow label="Open tasks" value={String(profile?.openTasks ?? '—')} />
        <KeyValueRow label="Reviews completed" value={String(profile?.reviewsCompleted ?? '—')} />
      </Panel>

      {profile?.headline ? (
        <Text style={styles.headline}>{String(profile.headline)}</Text>
      ) : null}

      <Btn label="Sign out" onPress={() => void logout()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  headline: { fontSize: 14, color: tokens.textMuted, marginBottom: 8 },
});
