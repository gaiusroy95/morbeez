import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, tokens, type AgronomistRecommendationRow } from '@morbeez/shared';
import { ListCard, Panel } from '@morbeez/ui-native';
import { openRecommendationVisit } from '@/lib/open-recommendation-visit';

type Props = {
  farmerId: string;
  farmerName: string;
  leadId?: string | null;
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

export function FarmerRecommendationsPanel({ farmerId, farmerName, leadId, recommendations }: Props) {
  const router = useRouter();
  const [openingId, setOpeningId] = useState<string | null>(null);

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
    <View style={styles.root}>
      {grouped.map(([issue, rows]) => (
        <Panel key={issue} title={issue}>
          {rows.map((rec) => (
            <ListCard
              key={rec.id}
              title={rec.recommendationText.slice(0, 80)}
              subtitle={reviewMeta(rec) ?? undefined}
              meta={[fieldRecStatus(rec), formatDate(rec.createdAt)].filter(Boolean).join(' · ')}
              onPress={() => void openItem(rec)}
            />
          ))}
        </Panel>
      ))}
      {openingId ? <Text style={styles.opening}>Opening visit…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 12, paddingBottom: 32, gap: 4 },
  empty: { padding: 24, color: tokens.textMuted, textAlign: 'center' },
  opening: { fontSize: 12, color: tokens.textMuted, textAlign: 'center', marginTop: 8 },
});
