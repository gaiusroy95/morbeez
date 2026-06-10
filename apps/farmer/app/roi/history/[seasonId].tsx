import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { fetchSeasonDetail, formatInr, t, tokens, type CropSeasonDetail } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function SeasonDetailScreen() {
  const { seasonId } = useLocalSearchParams<{ seasonId: string }>();
  const { locale } = useLocale();
  const [detail, setDetail] = useState<CropSeasonDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) return;
    void fetchSeasonDetail(String(seasonId))
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'))
      .finally(() => setLoading(false));
  }, [seasonId]);

  if (loading) return <Loading label={t('loading', locale)} />;
  if (!detail) return <AlertBox>{error || 'Not found'}</AlertBox>;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.title}>{detail.seasonLabel}</Text>
      <Panel title="Summary">
        <KeyValueRow label="Crop" value={detail.crop} />
        {detail.blockName ? <KeyValueRow label="Field" value={detail.blockName} /> : null}
        {detail.acreage != null ? <KeyValueRow label="Acreage" value={String(detail.acreage)} /> : null}
        {detail.dapDuration ? <KeyValueRow label="DAP" value={detail.dapDuration} /> : null}
        <KeyValueRow label={t('spent', locale)} value={formatInr(detail.totalExpenseInr)} />
        <KeyValueRow label={t('totalIncome', locale)} value={formatInr(detail.totalIncomeInr)} />
        <KeyValueRow label={t('profit', locale)} value={formatInr(detail.netProfitInr)} />
        <KeyValueRow label="ROI" value={`${detail.roiPercent}%`} />
      </Panel>

      {detail.harvest ? (
        <Panel title={t('harvest', locale)}>
          <KeyValueRow label={t('yieldKg', locale)} value={String(detail.harvest.yieldKg)} />
          <KeyValueRow label={t('sellingPrice', locale)} value={formatInr(detail.harvest.sellingPricePerKg)} />
          <KeyValueRow label={t('totalIncome', locale)} value={formatInr(detail.harvest.totalIncomeInr)} />
        </Panel>
      ) : null}

      {detail.entries.length ? (
        <Panel title={t('recentExpenses', locale)}>
          {detail.entries.slice(0, 20).map((e) => (
            <Text key={e.id} style={styles.line}>
              {e.dateLabel} · {e.label} · {formatInr(e.amountInr)}
            </Text>
          ))}
        </Panel>
      ) : null}

      {detail.activities.length ? (
        <Panel title={t('activities', locale)}>
          {detail.activities.map((a) => (
            <Text key={a.id} style={styles.line}>
              {a.dateLabel} · {a.label}
              {a.costInr ? ` · ${formatInr(a.costInr)}` : ''}
            </Text>
          ))}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 12 },
  line: { fontSize: 13, color: tokens.text, marginBottom: 6 },
});
