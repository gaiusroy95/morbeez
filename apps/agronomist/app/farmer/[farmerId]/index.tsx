import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { agronomistClient, tokens, type AgronomistWorkspaceSummary } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';
import { FarmerWorkspaceTabs } from '@/components/FarmerWorkspaceTabs';

export default function FarmerWorkspaceScreen() {
  const { farmerId } = useLocalSearchParams<{ farmerId: string }>();
  const id = String(farmerId ?? '');
  const [summary, setSummary] = useState<AgronomistWorkspaceSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setSummary(await agronomistClient.getWorkspaceSummary(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading farmer workspace…" />;
  if (!summary) {
    return (
      <View style={styles.center}>
        {error ? <AlertBox>{error}</AlertBox> : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <FarmerWorkspaceTabs farmerId={id} summary={summary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
});
