import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { agronomistClient, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, LanguagePicker, Loading, Panel, useAppError, useOnReconnect } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';

export default function ProfileScreen() {
  const router = useRouter();
  const { admin, logout } = useStaffAuth();
  const { locale, setLocale } = useLocale();
  const formatError = useAppError();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setProfile(await agronomistClient.getProfileStats());
    } catch (e) {
      setError(formatError(e, t('loadingProfile', locale)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formatError, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useOnReconnect(() => {
    void load();
  });

  if (loading && !profile) return <Loading label={t('loadingProfile', locale)} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title={t('account', locale)}>
        <KeyValueRow label={t('name', locale)} value={admin?.fullName ?? admin?.email ?? '—'} />
        <KeyValueRow label={t('email', locale)} value={admin?.email ?? '—'} />
        <KeyValueRow label={t('role', locale)} value={admin?.role ?? '—'} />
      </Panel>

      <Panel title={t('yourStats', locale)}>
        <KeyValueRow label={t('visitsThisMonth', locale)} value={String(profile?.visitsThisMonth ?? '—')} />
        <KeyValueRow label={t('farmersAssigned', locale)} value={String(profile?.assignedFarmers ?? '—')} />
        <KeyValueRow label={t('openTasks', locale)} value={String(profile?.openTasks ?? '—')} />
        <KeyValueRow label={t('reviewsCompleted', locale)} value={String(profile?.reviewsCompleted ?? '—')} />
      </Panel>

      <Panel title={t('language', locale)}>
        <Text style={styles.hint}>{t('languageHint', locale)}</Text>
        <LanguagePicker locale={locale} onChange={setLocale} />
      </Panel>

      <Btn
        label={admin?.hasPassword ? t('changePassword', locale) : t('setPassword', locale)}
        onPress={() => router.push('/change-password')}
        variant="secondary"
      />

      {profile?.headline ? (
        <Text style={styles.headline}>{String(profile.headline)}</Text>
      ) : null}

      <Btn label={t('signOut', locale)} onPress={() => void logout()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  headline: { fontSize: 14, color: tokens.textMuted, marginBottom: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10 },
});
