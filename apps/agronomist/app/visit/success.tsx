import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';

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
  const recommendationAdded = params.recommendationAdded;

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={88} color={tokens.green700} />
      </View>
      <Text style={styles.title}>Visit submitted successfully!</Text>
      <Text style={styles.message}>
        Thank you for visiting {farmerName} at {blockName}. Your data helps improve advisory for farmers.
      </Text>
      {recommendationAdded ? (
        <Text style={styles.hint}>{recommendationAdded} recommendation(s) saved with this visit.</Text>
      ) : null}
      {findingId ? (
        <View style={styles.metaRow}>
          <Ionicons name="cloud-done-outline" size={18} color={tokens.green700} />
          <Text style={styles.metaText}>Visit ID: {findingId.slice(0, 8)}… · Synced</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Btn label="Done" onPress={() => router.replace('/(tabs)/dashboard')} />
        {findingId ? (
          <Btn label="Review finding" variant="secondary" onPress={() => router.replace(`/finding/${findingId}`)} />
        ) : null}
        <Btn label="Start another visit" variant="secondary" onPress={() => router.replace('/(tabs)/visits')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.bg,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: tokens.text, textAlign: 'center', marginBottom: 12 },
  message: { fontSize: 15, color: tokens.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  hint: { fontSize: 14, color: tokens.green800, textAlign: 'center', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 24 },
  metaText: { fontSize: 13, color: tokens.green700, fontWeight: '600' },
  actions: { width: '100%', maxWidth: 360, gap: 10, marginTop: 8 },
});
