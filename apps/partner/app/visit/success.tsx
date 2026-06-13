import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';

export default function VisitSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmerId?: string; findingId?: string }>();
  const farmerId = params.farmerId ? String(params.farmerId) : '';

  return (
    <View style={styles.root}>
      <Panel title="Visit submitted">
        <Text style={styles.body}>
          Field findings were saved and sent for expert review. The telecaller and partner team will
          see updates on the shared timeline.
        </Text>
        {params.findingId ? (
          <Text style={styles.meta}>Finding ID: {String(params.findingId).slice(0, 8)}…</Text>
        ) : null}
        <Btn
          label="Back to farmer workspace"
          onPress={() => (farmerId ? router.replace(`/farmer/${farmerId}`) : router.back())}
        />
        <Btn label="Go to visits" variant="secondary" onPress={() => router.replace('/(tabs)/visits')} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg, padding: 16 },
  body: { fontSize: 15, color: tokens.text, lineHeight: 22, marginBottom: 12 },
  meta: { fontSize: 12, color: tokens.textMuted, marginBottom: 12 },
});
