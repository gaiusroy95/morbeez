import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, tokens, type AgronomistRecommendationRow } from '@morbeez/shared';
import { Btn, ListCard, Panel } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
  leadId?: string | null;
  blockId?: string;
  findingId?: string;
  recommendations: AgronomistRecommendationRow[];
  compact?: boolean;
  showAdd?: boolean;
};

export function RecommendationSection({
  farmerId,
  leadId,
  blockId,
  findingId,
  recommendations,
  compact = false,
  showAdd = true,
}: Props) {
  const router = useRouter();
  const shown = compact ? recommendations.slice(0, 3) : recommendations;

  function openAdd() {
    router.push({
      pathname: '/recommendation/add',
      params: {
        farmerId,
        leadId: leadId ?? '',
        blockId: blockId ?? '',
        findingId: findingId ?? '',
      },
    });
  }

  function openItem(rec: AgronomistRecommendationRow) {
    if (rec.fieldFindingId) {
      router.push(`/finding/${rec.fieldFindingId}`);
      return;
    }
    router.push({
      pathname: '/recommendation/add',
      params: {
        farmerId,
        leadId: leadId ?? '',
        blockId: rec.blockId ?? blockId ?? '',
        recommendationId: rec.id,
      },
    });
  }

  return (
    <Panel title="Recommendations">
      {shown.length === 0 ? (
        <Text style={styles.muted}>No recommendations yet. Add one for this farmer.</Text>
      ) : (
        <View style={styles.list}>
          {shown.map((rec) => (
            <ListCard
              key={rec.id}
              title={rec.issueDetected?.trim() || 'Recommendation'}
              subtitle={rec.recommendationText}
              meta={[rec.status.replace(/_/g, ' '), formatDate(rec.createdAt)].filter(Boolean).join(' · ')}
              onPress={() => openItem(rec)}
            />
          ))}
        </View>
      )}
      {compact && recommendations.length > shown.length ? (
        <Text style={styles.more}>{recommendations.length - shown.length} more in Recommendations tab</Text>
      ) : null}
      {showAdd ? <Btn label="Add recommendation" onPress={openAdd} variant="secondary" /> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, marginBottom: 8 },
  muted: { fontSize: 14, color: tokens.textMuted, marginBottom: 12, lineHeight: 20 },
  more: { fontSize: 12, color: tokens.textMuted, marginBottom: 8 },
});
