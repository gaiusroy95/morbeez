import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';

export default function VisitSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmerName?: string;
    blockName?: string;
    findingId?: string;
    recommendationAdded?: string;
  }>();

  const farmerName = String(params.farmerName ?? 'Farmer');
  const blockName = String(params.blockName ?? 'Block');
  const findingId = params.findingId ? String(params.findingId) : '';
  const recommendationAdded = params.recommendationAdded === '1';

  return (
    <View style={styles.root}>
      <Panel title="Visit saved">
        <Text style={styles.message}>
          Visit for {farmerName} at {blockName} was recorded successfully.
        </Text>
        {recommendationAdded ? (
          <Text style={styles.hint}>Recommendation draft saved with this visit.</Text>
        ) : (
          <Text style={styles.hint}>Check-out completed. You can review findings from the task hub.</Text>
        )}
      </Panel>
      <View style={styles.actions}>
        {findingId ? (
          <Btn label="Review finding & recommendation" onPress={() => router.replace(`/finding/${findingId}`)} />
        ) : null}
        <Btn label="Back to dashboard" onPress={() => router.replace('/(tabs)/dashboard')} variant="secondary" />
        <Btn label="Start another visit" onPress={() => router.replace('/(tabs)/visits')} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg, padding: 16 },
  message: { fontSize: 16, color: tokens.text, lineHeight: 22, marginBottom: 8 },
  hint: { fontSize: 14, color: tokens.textMuted, lineHeight: 20 },
  actions: { marginTop: 16, gap: 8 },
});
