import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';

export default function PartnerBlockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmerId: string; blockId: string }>();
  const farmerId = String(params.farmerId ?? '');
  const blockId = String(params.blockId ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [block, setBlock] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!farmerId) return;
    void partnerClient
      .getFarmerWorkspace(farmerId)
      .then((ws) => {
        const blocks = (ws.blocks as Record<string, unknown>[]) ?? [];
        setBlock(blocks.find((b) => String(b.id) === blockId) ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load block'))
      .finally(() => setLoading(false));
  }, [farmerId, blockId]);

  if (loading) return <Loading label="Loading block…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={String(block?.name ?? block?.block_name ?? 'Block')}>
        <KeyValueRow label="Crop" value={String(block?.crop_type ?? block?.cropType ?? '—')} />
        <KeyValueRow label="Acreage" value={block?.acreage != null ? String(block.acreage) : '—'} />
        <KeyValueRow label="Health" value={String(block?.health_status ?? block?.blockHealth ?? '—')} />
        <Btn
          label="Start visit at this block"
          onPress={() =>
            router.push(
              `/visit?farmerId=${encodeURIComponent(farmerId)}&blockId=${encodeURIComponent(blockId)}`
            )
          }
        />
        <Btn label="Back to farmer" variant="secondary" onPress={() => router.back()} />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16 },
});
