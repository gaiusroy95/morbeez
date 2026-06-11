import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isWarehouseManagerRole, tokens, warehouseClient } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';
import { useWarehouseTabs } from '@/hooks/useWarehouseTabs';

export default function MoreScreen() {
  const router = useRouter();
  const { admin, logout, canWrite } = useStaffAuth();
  const { canSync } = useWarehouseTabs();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const manager = isWarehouseManagerRole(admin?.role);

  async function syncInventory() {
    if (!canWrite || !canSync) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await warehouseClient.syncInventory();
      const parts: string[] = [];
      if (r.syncedQty) parts.push(`${r.syncedQty} units synced`);
      if (r.repaired) parts.push(`${r.repaired} pick lists rebuilt`);
      if (r.failed) parts.push(`${r.failed} still blocked`);
      setMessage(parts.length ? parts.join(' · ') : 'Sync finished');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Panel title="Profile">
        <KeyValueRow label="Name" value={admin?.fullName ?? admin?.email ?? '—'} />
        <KeyValueRow label="Role" value={admin?.role ?? '—'} />
        <KeyValueRow label="Access" value={manager ? 'Manager' : 'Floor staff'} />
      </Panel>

      <Panel title="Tools">
        {manager ? (
          <Btn label="Assign & print labels" onPress={() => router.push('/(app)/more/assign-labels')} />
        ) : null}
        {canWrite && canSync ? (
          <Btn
            label={busy ? 'Syncing…' : 'Sync inventory & repair pick lists'}
            onPress={syncInventory}
            disabled={busy}
            variant="secondary"
          />
        ) : null}
      </Panel>

      <Btn label="Sign out" onPress={() => void logout()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
});
