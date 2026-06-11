import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isWarehouseManagerRole, t, tokens, warehouseClient } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, LanguagePicker, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';
import { useWarehouseTabs } from '@/hooks/useWarehouseTabs';

export default function MoreScreen() {
  const router = useRouter();
  const { admin, logout, canWrite } = useStaffAuth();
  const { canSync } = useWarehouseTabs();
  const { locale, setLocale } = useLocale();
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
      setError(e instanceof Error ? e.message : t('syncInventory', locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Panel title={t('profile', locale)}>
        <KeyValueRow label={t('name', locale)} value={admin?.fullName ?? admin?.email ?? '—'} />
        <KeyValueRow label={t('role', locale)} value={admin?.role ?? '—'} />
        <KeyValueRow
          label={t('access', locale)}
          value={manager ? t('manager', locale) : t('floorStaff', locale)}
        />
      </Panel>

      <Panel title={t('language', locale)}>
        <Text style={styles.hint}>{t('languageHint', locale)}</Text>
        <LanguagePicker locale={locale} onChange={setLocale} />
      </Panel>

      <Panel title={t('tools', locale)}>
        {manager ? (
          <Btn
            label={t('assignPrintLabels', locale)}
            onPress={() => router.push('/(app)/more/assign-labels')}
          />
        ) : null}
        {canWrite && canSync ? (
          <Btn
            label={busy ? t('syncing', locale) : t('syncInventory', locale)}
            onPress={syncInventory}
            disabled={busy}
            variant="secondary"
          />
        ) : null}
      </Panel>

      <Btn label={t('signOut', locale)} onPress={() => void logout()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10 },
});
