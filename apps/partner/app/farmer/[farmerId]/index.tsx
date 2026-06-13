import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';
import { PartnerWorkspaceTabs } from '@/components/PartnerWorkspaceTabs';

export default function FarmerWorkspaceScreen() {
  const { farmerId } = useLocalSearchParams<{ farmerId: string }>();
  const id = String(farmerId ?? '');
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      setWorkspace(await partnerClient.getFarmerWorkspace(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load farmer workspace');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) return <AlertBox>Missing farmer ID.</AlertBox>;
  if (loading) return <Loading label="Loading farmer…" />;
  if (!workspace) return <AlertBox>{error || 'Farmer not found.'}</AlertBox>;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <PartnerWorkspaceTabs
        farmerId={id}
        workspace={{
          farmer: workspace.farmer as Record<string, unknown>,
          blocks: (workspace.blocks as Record<string, unknown>[]) ?? [],
          recentVisits: (workspace.recentVisits as Record<string, unknown>[]) ?? [],
          pendingTaskCount: workspace.pendingTaskCount as number | undefined,
          opportunityScore: workspace.opportunityScore as number | null | undefined,
          ownership: workspace.ownership as Record<string, unknown> | null | undefined,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
});
