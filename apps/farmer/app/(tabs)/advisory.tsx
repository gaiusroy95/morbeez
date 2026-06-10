import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { fetchPortalAdvisory, tokens, type PortalAdvisory } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading, Panel } from '@morbeez/ui-native';
import { BulletList, WhatsAppBtn } from '@/components/PortalHelpers';
import { whatsAppUrl } from '@/lib/config';

export default function AdvisoryScreen() {
  const [data, setData] = useState<PortalAdvisory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setData(await fetchPortalAdvisory());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load advisory');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading label="Loading advisory…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {data?.crop ? (
        <Panel title={data.crop.name}>
          <Text style={styles.meta}>
            {data.crop.stage}
            {data.crop.daysAfterPlanting != null ? ` · Day ${data.crop.daysAfterPlanting}` : ''}
            {data.crop.fieldSize ? ` · ${data.crop.fieldSize}` : ''}
          </Text>
        </Panel>
      ) : null}
      {data?.schedule?.length ? (
        <Panel title="Upcoming schedule">
          {data.schedule.map((s) => (
            <Text key={s.id} style={styles.body}>
              {s.dueLabel} — {s.notes ?? s.type}
            </Text>
          ))}
        </Panel>
      ) : null}
      {data?.alerts?.length ? (
        <Panel title="Spray alerts">
          {data.alerts.map((a, i) => (
            <Text key={i} style={styles.body}>{a.dueLabel}: {a.message}</Text>
          ))}
        </Panel>
      ) : null}
      {!data?.recommendations?.length ? (
        <EmptyState>No advisory yet. Use Crop Doctor on the website or WhatsApp.</EmptyState>
      ) : (
        data.recommendations.map((r) => (
          <Panel key={r.id} title={r.title}>
            <Text style={styles.meta}>
              {r.dateLabel} · {r.cropName}
              {r.blockName ? ` · ${r.blockName}` : ''}
            </Text>
            <BulletList items={r.bullets} />
            {r.applicationMethod ? (
              <Text style={styles.body}>How to apply: {r.applicationMethod}</Text>
            ) : null}
            {r.followUpLabel ? <Text style={styles.meta}>Follow-up: {r.followUpLabel}</Text> : null}
          </Panel>
        ))
      )}
      <WhatsAppBtn label="WhatsApp agronomist" message="I need crop advice" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20, marginBottom: 4 },
  meta: { fontSize: 12, color: tokens.textMuted, marginBottom: 6 },
});
