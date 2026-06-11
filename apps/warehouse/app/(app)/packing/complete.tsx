import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';

export default function PackingCompleteScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Panel title="Packing complete">
        <Text style={styles.success}>Order packed and documents checked.</Text>
        <Text style={styles.meta}>Move the parcel to dispatch staging.</Text>
      </Panel>
      <Btn label="Move to dispatch" onPress={() => router.replace('/(app)/(tabs)/dispatch')} />
      <Btn label="Back to packing queue" onPress={() => router.replace('/(app)/(tabs)/packing')} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg, padding: 16, gap: 8 },
  success: { fontSize: 18, fontWeight: '700', color: tokens.green700, marginBottom: 8 },
  meta: { fontSize: 14, color: tokens.textMuted },
});
