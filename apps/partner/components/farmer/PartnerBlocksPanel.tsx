import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { ListCard } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
  blocks: Record<string, unknown>[];
};

export function PartnerBlocksPanel({ farmerId, blocks }: Props) {
  const router = useRouter();
  return (
    <View style={styles.root}>
      {blocks.map((block) => {
        const name = String(block.name ?? block.plotLabel ?? 'Block');
        const crop = String(block.cropType ?? block.crop_type ?? '');
        const acreage = block.acreage ?? block.acreage_decimal;
        const dap = block.dap;
        const health = String(block.healthStatus ?? block.health_status ?? '');
        return (
          <ListCard
            key={String(block.id)}
            title={name}
            subtitle={[crop, dap != null ? `DAP ${dap}` : null, health].filter(Boolean).join(' · ')}
            meta={acreage != null ? `${acreage} ac` : undefined}
            onPress={() => router.push(`/farmer/${farmerId}/block/${String(block.id)}`)}
          />
        );
      })}
      {!blocks.length ? <Text style={styles.empty}>No blocks registered.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
