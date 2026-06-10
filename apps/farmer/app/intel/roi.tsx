import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { fetchRoiDashboard, formatInr, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useRouter } from 'expo-router';
import { t } from '@morbeez/shared';
import { useLocale } from '@/context/LocaleContext';

export default function RoiScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchRoiDashboard>> | null>(null);

  useEffect(() => {
    void fetchRoiDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load ROI'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading ROI…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Btn label={t('addExpense', locale)} onPress={() => router.push('/intel/roi-add')} accessibilityLabel={t('addExpense', locale)} />
      {data ? (
        <>
          <Panel title="Profitability">
            <KeyValueRow label="Investment" value={formatInr(data.investmentInr)} />
            <KeyValueRow label="Projected revenue" value={formatInr(data.projectedRevenueInr)} />
            <KeyValueRow label="Profit" value={formatInr(data.profitInr)} />
            <KeyValueRow label="ROI" value={`${data.roiPercent}%`} />
            {data.yieldForecast ? <KeyValueRow label="Yield forecast" value={data.yieldForecast} /> : null}
            {data.marketNote ? <Text style={styles.note}>{data.marketNote}</Text> : null}
          </Panel>
          {data.recentEntries.length ? (
            <Panel title="Recent entries">
              {data.recentEntries.map((e) => (
                <Text key={e.id} style={styles.line}>
                  {e.dateLabel} · {e.category} · {formatInr(e.amountInr)}
                </Text>
              ))}
            </Panel>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  note: { fontSize: 13, color: tokens.textMuted, marginTop: 8 },
  line: { fontSize: 13, color: tokens.text, marginBottom: 6 },
});
