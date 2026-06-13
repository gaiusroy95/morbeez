import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, tokens, type AgronomistRecommendationRow } from '@morbeez/shared';
import { ListCard, Panel } from '@morbeez/ui-native';

type Props = {
  recommendations: AgronomistRecommendationRow[];
};

function fieldRecStatus(rec: AgronomistRecommendationRow): string {
  const meta = rec as AgronomistRecommendationRow & { fieldRecStatus?: string };
  if (meta.fieldRecStatus) return meta.fieldRecStatus;
  return rec.status.replace(/_/g, ' ');
}

function reviewMeta(rec: AgronomistRecommendationRow): string | null {
  const meta = rec as AgronomistRecommendationRow & { reviewDate?: string; priority?: string };
  const parts = [meta.priority, meta.reviewDate ? `Review ${formatDate(meta.reviewDate)}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function FarmerRecommendationsPanel({ recommendations }: Props) {
  const router = useRouter();

  const grouped = useMemo(() => {
    const map = new Map<string, AgronomistRecommendationRow[]>();
    for (const rec of recommendations) {
      const key = rec.issueDetected?.trim() || 'General';
      const list = map.get(key) ?? [];
      list.push(rec);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [recommendations]);

  if (!recommendations.length) {
    return <Text style={styles.empty}>No recommendations yet.</Text>;
  }

  return (
    <View style={styles.root}>
      {grouped.map(([issue, rows]) => (
        <Panel key={issue} title={issue}>
          {rows.map((rec) => (
            <ListCard
              key={rec.id}
              title={rec.recommendationText.slice(0, 80)}
              subtitle={reviewMeta(rec) ?? undefined}
              meta={[fieldRecStatus(rec), formatDate(rec.createdAt)].filter(Boolean).join(' · ')}
              onPress={() => {
                if (rec.fieldFindingId) router.push(`/visit/${rec.fieldFindingId}`);
              }}
            />
          ))}
        </Panel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 12, paddingBottom: 32, gap: 4 },
  empty: { padding: 24, color: tokens.textMuted, textAlign: 'center' },
});
