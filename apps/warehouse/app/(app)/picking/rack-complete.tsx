import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';

export default function RackCompleteScreen() {
  const { orderId, rack, nextRack, allDone } = useLocalSearchParams<{
    orderId: string;
    rack: string;
    nextRack?: string;
    allDone?: string;
  }>();
  const router = useRouter();
  const finished = allDone === '1';

  return (
    <View style={styles.root}>
      <Panel title="Rack complete">
        <Text style={styles.success}>Rack {rack} picked successfully.</Text>
        {finished ? (
          <Text style={styles.meta}>All racks complete — order moves to packing.</Text>
        ) : nextRack ? (
          <Text style={styles.meta}>Next rack: {nextRack}</Text>
        ) : (
          <Text style={styles.meta}>Continue picking remaining racks.</Text>
        )}
      </Panel>
      {finished ? (
        <Btn label="Go to packing" onPress={() => router.replace(`/(app)/packing/${orderId}`)} />
      ) : (
        <Btn label="Next rack" onPress={() => router.replace(`/(app)/picking/${orderId}`)} />
      )}
      <Btn label="Back to picking queue" onPress={() => router.replace('/(app)/(tabs)/picking')} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg, padding: 16, gap: 8 },
  success: { fontSize: 18, fontWeight: '700', color: tokens.green700, marginBottom: 8 },
  meta: { fontSize: 14, color: tokens.textMuted },
});
