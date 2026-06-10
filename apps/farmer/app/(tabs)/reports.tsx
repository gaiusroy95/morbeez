import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { fetchPortalSoilReports, tokens, type PortalSoilReport } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, Loading, Panel } from '@morbeez/ui-native';
import { Badge } from '@/components/PortalHelpers';
import { whatsAppUrl } from '@/lib/config';

export default function ReportsScreen() {
  const [reports, setReports] = useState<PortalSoilReport[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setReports(await fetchPortalSoilReports());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load reports');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading label="Loading soil reports…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {reports.length === 0 ? (
        <>
          <EmptyState>No soil reports on file yet.</EmptyState>
          <Btn
            label="Request report upload via WhatsApp"
            onPress={() => Linking.openURL(whatsAppUrl('I want to upload my soil test report'))}
          />
        </>
      ) : (
        reports.map((r) => (
          <Panel key={r.id} title={r.blockName}>
            <Badge label={r.healthLabel} tone={r.health} />
            <Text style={styles.meta}>{r.dateLabel}</Text>
            {r.highlights.length ? (
              <Text style={styles.body}>{r.highlights.join(' · ')}</Text>
            ) : null}
            {r.pdfUrl ? (
              <Btn label="Download PDF" variant="secondary" onPress={() => Linking.openURL(r.pdfUrl!)} />
            ) : null}
          </Panel>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  meta: { fontSize: 12, color: tokens.textMuted, marginVertical: 6 },
  body: { fontSize: 14, color: tokens.text },
});
