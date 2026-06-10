import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { fetchPortalRoi, fetchPortalSummary, formatInr, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { WhatsAppBtn } from '@/components/PortalHelpers';
import { WHATSAPP_PHONE, whatsAppUrl } from '@/lib/config';

export default function SupportScreen() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; atLabel: string }>>([]);
  const [roi, setRoi] = useState<Awaited<ReturnType<typeof fetchPortalRoi>> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [summary, roiData] = await Promise.all([fetchPortalSummary(), fetchPortalRoi()]);
        setNotifications(summary.notifications ?? []);
        setRoi(roiData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load support data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading label="Loading support…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      {notifications.length ? (
        <Panel title="Notifications">
          {notifications.map((n) => (
            <Text key={n.id} style={styles.body}>• {n.message} ({n.atLabel})</Text>
          ))}
        </Panel>
      ) : null}

      {roi ? (
        <Panel title="ROI summary">
          <KeyValueRow label="Input cost" value={formatInr(roi.summary.inputCostInr)} />
          <KeyValueRow label="Est. income" value={formatInr(roi.summary.estimatedYieldIncomeInr)} />
          <KeyValueRow label="Est. profit" value={formatInr(roi.summary.estimatedProfitInr)} />
          {roi.summary.acreage ? (
            <KeyValueRow label="Acreage" value={String(roi.summary.acreage)} />
          ) : null}
          <Text style={styles.meta}>{roi.summary.marketNote}</Text>
          {roi.recentEntries.slice(0, 6).map((e) => (
            <Text key={e.id} style={styles.body}>
              {e.dateLabel} · {e.category} · {formatInr(e.amountInr)} ({e.type})
              {e.note ? ` — ${e.note}` : ''}
            </Text>
          ))}
        </Panel>
      ) : null}

      <WhatsAppBtn label="WhatsApp support" />
      <Btn
        label="Call agronomist"
        variant="secondary"
        onPress={() => Linking.openURL(`tel:${WHATSAPP_PHONE.replace(/\D/g, '')}`)}
      />
      <WhatsAppBtn label="Request field visit" message="I would like to request a field visit" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  body: { fontSize: 14, color: tokens.text, marginBottom: 6 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 8 },
});
