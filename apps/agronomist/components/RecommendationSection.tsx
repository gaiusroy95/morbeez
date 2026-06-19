import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, tokens, type AgronomistRecommendationRow } from '@morbeez/shared';
import { Btn, ListCard, Panel } from '@morbeez/ui-native';
import { openRecommendationVisit } from '@/lib/open-recommendation-visit';

type Props = {
  farmerId: string;
  farmerName: string;
  leadId?: string | null;
  blockId?: string;
  findingId?: string;
  recommendations: AgronomistRecommendationRow[];
  compact?: boolean;
  showAdd?: boolean;
};

export function RecommendationSection({
  farmerId,
  farmerName,
  leadId,
  blockId,
  findingId,
  recommendations,
  compact = false,
  showAdd = true,
}: Props) {
  const router = useRouter();
  const [openingId, setOpeningId] = useState<string | null>(null);
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

  async function openItem(rec: AgronomistRecommendationRow) {
    if (openingId) return;
    setOpeningId(rec.id);
    try {
      await openRecommendationVisit(rec, { farmerId, farmerName, leadId, router });
    } finally {
      setOpeningId(null);
    }
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
              onPress={() => void openItem(rec)}
            />
          ))}
        </View>
      )}
      {compact && recommendations.length > shown.length ? (
        <Text style={styles.more}>{recommendations.length - shown.length} more in Recommendations tab</Text>
      ) : null}
      {showAdd ? <Btn label="Add recommendation" onPress={openAdd} variant="secondary" /> : null}
      {openingId ? <Text style={styles.opening}>Opening visit…</Text> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, marginBottom: 8 },
  muted: { fontSize: 14, color: tokens.textMuted, marginBottom: 12, lineHeight: 20 },
  more: { fontSize: 12, color: tokens.textMuted, marginBottom: 8 },
  opening: { fontSize: 12, color: tokens.textMuted, textAlign: 'center', marginTop: 4 },
});
