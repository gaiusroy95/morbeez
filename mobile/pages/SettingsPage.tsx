import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, Badge, EmptyState, Loading, Panel, ReadOnlyBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/format';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

type Staff = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
};

export function SettingsPage({ canRead, canWrite }: { canRead: boolean; canWrite?: boolean }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    api<{ ok: boolean; staff: Staff[] }>('/morbeez-staff/api/v1/os/settings/staff')
      .then((d) => setStaff(d.staff ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [canRead]);

  if (!canRead) {
    return (
      <ConsoleScreenLayout>
        <Panel title="Settings">
          <ReadOnlyBanner />
        </Panel>
      </ConsoleScreenLayout>
    );
  }

  return (
    <ConsoleScreenLayout scroll={false}>
      <Text style={styles.hint}>
        Staff accounts and RBAC — same data as the web console Settings page.
      </Text>
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <Loading label="Loading staff…" />
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Panel title="Staff accounts">{null}</Panel>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.email}>{item.email}</Text>
                <Text style={styles.name}>{item.fullName ?? '—'}</Text>
                <View style={styles.badges}>
                  <Badge tone="role">{roleLabel(item.role)}</Badge>
                  <Badge tone={item.active ? 'active' : 'archived'}>
                    {item.active ? 'Active' : 'Inactive'}
                  </Badge>
                </View>
                <Text style={styles.login}>
                  Last login:{' '}
                  {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState>No staff users.</EmptyState>}
        />
      )}
      {!canWrite ? <ReadOnlyBanner /> : null}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  list: { paddingBottom: 24 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2ef',
  },
  rowMain: { gap: 4 },
  email: { fontSize: 15, fontWeight: '700', color: '#111827' },
  name: { fontSize: 14, color: '#374151' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 6 },
  login: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});
