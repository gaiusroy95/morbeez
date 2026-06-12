import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  formatInr,
  t,
  tokens,
  type AppLocale,
  type BlockFieldFinding,
  type BlockRecommendationItem,
  type CultivationActivity,
  type FieldOverview,
  type PortalSoilReport,
} from '@morbeez/shared';
import { HealthBadge, StageProgressBar } from './farmer-ui';

export function cropEmoji(crop: string): string {
  const c = crop.toLowerCase();
  if (c.includes('ginger')) return '🫚';
  if (c.includes('banana')) return '🍌';
  if (c.includes('paddy') || c.includes('rice')) return '🌾';
  if (c.includes('tomato')) return '🍅';
  if (c.includes('chilli') || c.includes('chili')) return '🌶';
  return '🌱';
}

export function activityIcon(type: string): string {
  if (type.includes('spray')) return '🧴';
  if (type.includes('fert')) return '💧';
  if (type.includes('scout') || type.includes('observation')) return '👁';
  if (type.includes('drench')) return '🚿';
  if (type.includes('irrig')) return '💦';
  if (type.includes('plant')) return '🌱';
  return '📋';
}

export function activityTypeTitle(type: string): string {
  const map: Record<string, string> = {
    spray_applied: 'Spray',
    fertigation: 'Fertigation',
    drench: 'Drenching',
    scouting: 'Observation',
    irrigation: 'Irrigation',
    other: 'Activity',
  };
  return map[type] ?? type.replace(/_/g, ' ');
}

export function activityDap(plantingDate: string | null | undefined, activityDate: string): number | null {
  if (!plantingDate) return null;
  const start = new Date(plantingDate.slice(0, 10));
  const end = new Date(activityDate.slice(0, 10));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

export function ScrollableUnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const on = active === tab.id;
          return (
            <Pressable key={tab.id} style={styles.tabItem} onPress={() => onChange(tab.id)}>
              <Text style={[styles.tabLabel, on && styles.tabLabelActive]}>{tab.label}</Text>
              {on ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function BlockSummaryCard({
  block,
  locale,
  extraRows,
}: {
  block: FieldOverview;
  locale?: AppLocale;
  extraRows?: Array<{ label: string; value: string }>;
}) {
  const loc = locale ?? 'en';
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryIcon}>
          <Text style={styles.summaryEmoji}>{cropEmoji(block.crop)}</Text>
        </View>
        <View style={styles.summaryMain}>
          <View style={styles.summaryTitleRow}>
            <Text style={styles.blockTitle}>{block.name}</Text>
            <HealthBadge status={block.healthStatus} label={t('activeStatus', loc)} />
          </View>
          <View style={styles.summaryGrid}>
            <SummaryCell label="Crop" value={block.crop} />
            {block.acreage != null ? <SummaryCell label="Area" value={`${block.acreage} Acre`} /> : null}
            {block.plantingDateLabel ? (
              <SummaryCell label={t('plantingDateLabel', loc)} value={block.plantingDateLabel} />
            ) : null}
            {block.dap != null ? <SummaryCell label={t('dapLabel', loc)} value={`${block.dap} Days`} /> : null}
            {extraRows?.map((row) => <SummaryCell key={row.label} label={row.label} value={row.value} />)}
          </View>
          {block.stage ? <Text style={styles.stageRow}>🌱 {block.stage}</Text> : null}
        </View>
      </View>
      {block.dap != null ? <StageProgressBar dap={block.dap} stage={block.stage} /> : null}
    </View>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryCellLabel}>{label}</Text>
      <Text style={styles.summaryCellValue}>{value}</Text>
    </View>
  );
}

export function ActivityTimeline({
  activities,
  plantingDate,
  locale,
  onPressActivity,
  emptyLabel,
}: {
  activities: CultivationActivity[];
  plantingDate?: string | null;
  locale?: AppLocale;
  onPressActivity?: (activity: CultivationActivity) => void;
  emptyLabel?: string;
}) {
  const loc = locale ?? 'en';
  if (!activities.length) {
    return <Text style={styles.muted}>{emptyLabel ?? t('noActivitiesYet', loc)}</Text>;
  }

  return (
    <View style={styles.timeline}>
      {activities.map((a, index) => {
        const dap = activityDap(plantingDate ?? null, a.activityDate);
        const title = activityTypeTitle(a.activityType);
        const productLine =
          a.activityLabel && a.activityLabel.toLowerCase() !== title.toLowerCase() ? a.activityLabel : null;
        const description = [productLine, a.notes].filter(Boolean).join(' · ');

        return (
          <View key={a.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot} />
              {index < activities.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <Pressable
              style={styles.timelineCard}
              onPress={() => onPressActivity?.(a)}
              disabled={!onPressActivity}
            >
              <Text style={styles.timelineDate}>
                {dap != null ? `DAP ${dap}, ${a.dateLabel}` : a.dateLabel}
              </Text>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineIcon}>{activityIcon(a.activityType)}</Text>
                <View style={styles.timelineMeta}>
                  <Text style={styles.timelineTitle}>{title}</Text>
                  {description ? <Text style={styles.timelineNotes}>{description}</Text> : null}
                  {a.costInr ? <Text style={styles.timelineCost}>{formatInr(a.costInr)}</Text> : null}
                </View>
                <View style={styles.timelineRight}>
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedText}>{t('completedStatus', loc)}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function SoilTestsPanel({
  reports,
  locale,
  onNewTest,
  showAddButton = true,
}: {
  reports: PortalSoilReport[];
  locale?: AppLocale;
  onNewTest?: () => void;
  showAddButton?: boolean;
}) {
  const loc = locale ?? 'en';
  const latest = reports[0] ?? null;

  return (
    <>
      {latest ? (
        <View style={styles.soilCard}>
          <Text style={styles.soilCardTitle}>
            {t('latestSoilTest', loc)} · {latest.dateLabel}
          </Text>
          {latest.metrics?.length ? (
            <View style={styles.metricsGrid}>
              {latest.metrics.map((m) => (
                <View key={m.label} style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <Text style={styles.metricValue}>{m.value}</Text>
                </View>
              ))}
            </View>
          ) : latest.highlights.length ? (
            <View style={styles.metricsGrid}>
              {latest.highlights.map((h, idx) => (
                <View key={`${h}-${idx}`} style={styles.metricCell}>
                  <Text style={styles.metricValue}>{h}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>{t('soilReportOnFile', loc)}</Text>
          )}
          {latest.pdfUrl ? (
            <Pressable style={styles.reportBtn} onPress={() => void Linking.openURL(latest.pdfUrl!)}>
              <Text style={styles.reportBtnText}>📄 {t('viewFullReport', loc)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={styles.muted}>{t('noSoilTestsYet', loc)}</Text>
      )}

      {reports.length ? (
        <View style={styles.soilHistory}>
          <Text style={styles.soilHistoryTitle}>{t('allSoilTests', loc)}</Text>
          {reports.map((r) => (
            <Pressable
              key={r.id}
              style={styles.soilRow}
              onPress={() => r.pdfUrl && void Linking.openURL(r.pdfUrl)}
            >
              <View>
                <Text style={styles.soilDate}>{r.dateLabel}</Text>
                {r.dapLabel ? <Text style={styles.soilDap}>{r.dapLabel}</Text> : null}
              </View>
              <Text style={styles.soilMeta}>{r.healthLabel}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showAddButton && onNewTest ? (
        <Pressable style={styles.addSoilBtn} onPress={onNewTest} accessibilityRole="button">
          <Text style={styles.addSoilBtnText}>+ {t('newSoilTest', loc)}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

export function FieldFindingsPanel({
  findings,
  locale,
  onPressFinding,
  emptyLabel = 'No field findings for this block yet.',
}: {
  findings: BlockFieldFinding[];
  locale?: AppLocale;
  onPressFinding?: (finding: BlockFieldFinding) => void;
  emptyLabel?: string;
}) {
  if (!findings.length) {
    return <Text style={styles.muted}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.findingsList}>
      {findings.map((f) => (
        <Pressable
          key={f.id}
          style={[styles.findingCard, f.cropHealthStatus === 'alert' && styles.findingCardAlert]}
          onPress={() => onPressFinding?.(f)}
          disabled={!onPressFinding}
        >
          <View style={styles.findingHeader}>
            <Text style={styles.findingDate}>{f.visitedLabel}</Text>
            <HealthBadge status={f.cropHealthStatus} label={f.cropHealthLabel} />
          </View>
          {f.diseasePest ? <Text style={styles.findingIssue}>{f.diseasePest}</Text> : null}
          {f.observations ? <Text style={styles.findingObs}>{f.observations}</Text> : null}
          {f.agronomistName ? <Text style={styles.findingMeta}>By {f.agronomistName}</Text> : null}
          {f.actionTaken ? <Text style={styles.findingMeta}>Action: {f.actionTaken}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

export function BlockRecommendationsPanel({
  items,
  locale,
  emptyLabel = 'No recommendations for this block yet.',
}: {
  items: BlockRecommendationItem[];
  locale?: AppLocale;
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <Text style={styles.muted}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.findingsList}>
      {items.map((r) => (
        <View key={`${r.source}-${r.id}`} style={styles.recCard}>
          <View style={styles.findingHeader}>
            <Text style={styles.findingDate}>{r.dateLabel}</Text>
            <HealthBadge
              status={r.status === 'applied' || r.status === 'communicated' ? 'stable' : 'monitor'}
              label={r.status.replace(/_/g, ' ')}
            />
          </View>
          <Text style={styles.findingIssue}>{r.title}</Text>
          {r.body ? <Text style={styles.findingObs}>{r.body}</Text> : null}
          {r.dosage ? <Text style={styles.findingMeta}>Dosage: {r.dosage}</Text> : null}
          {r.recommendedBy ? <Text style={styles.findingMeta}>By {r.recommendedBy}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabScroll: { marginBottom: 12, flexGrow: 0 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: tokens.border },
  tabItem: { paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', minWidth: 92 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: tokens.textMuted },
  tabLabelActive: { color: tokens.green800 },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 3, backgroundColor: tokens.green700, borderRadius: 2 },
  summaryCard: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 12,
  },
  summaryTop: { flexDirection: 'row', gap: 12 },
  summaryIcon: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: tokens.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryEmoji: { fontSize: 36 },
  summaryMain: { flex: 1 },
  summaryTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  blockTitle: { fontSize: 20, fontWeight: '800', color: tokens.text, flex: 1 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCell: { width: '47%' },
  summaryCellLabel: { fontSize: 11, color: tokens.textMuted, fontWeight: '600' },
  summaryCellValue: { fontSize: 14, fontWeight: '700', color: tokens.text, marginTop: 2 },
  stageRow: { fontSize: 13, color: tokens.green800, fontWeight: '600', marginTop: 8 },
  muted: { fontSize: 13, color: tokens.textMuted, marginVertical: 8, lineHeight: 18 },
  timeline: { marginTop: 4 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.green700, marginTop: 22 },
  timelineLine: { flex: 1, width: 2, backgroundColor: tokens.border, marginTop: 4 },
  timelineCard: {
    flex: 1,
    backgroundColor: tokens.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 12,
  },
  timelineDate: { fontSize: 11, color: tokens.textMuted, fontWeight: '700', marginBottom: 6 },
  timelineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timelineIcon: { fontSize: 22, marginTop: 2 },
  timelineMeta: { flex: 1 },
  timelineTitle: { fontSize: 16, fontWeight: '800', color: tokens.text },
  timelineRight: { alignItems: 'flex-end', gap: 6 },
  completedBadge: { backgroundColor: tokens.green100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  completedText: { fontSize: 10, fontWeight: '700', color: tokens.green800 },
  timelineNotes: { fontSize: 13, color: tokens.textMuted, marginTop: 4, lineHeight: 18 },
  timelineCost: { fontSize: 13, fontWeight: '700', color: tokens.green800, marginTop: 6 },
  soilCard: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 12,
  },
  soilCardTitle: { fontSize: 15, fontWeight: '700', color: tokens.text, marginBottom: 10 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCell: { width: '47%', backgroundColor: tokens.green100, borderRadius: 8, padding: 10 },
  metricLabel: { fontSize: 11, color: tokens.textMuted, fontWeight: '600' },
  metricValue: { fontSize: 14, fontWeight: '800', color: tokens.text, marginTop: 2 },
  reportBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.bg,
  },
  reportBtnText: { fontSize: 13, fontWeight: '700', color: tokens.green800 },
  soilHistory: { marginBottom: 12 },
  soilHistoryTitle: { fontSize: 15, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  soilRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  soilDate: { fontSize: 14, fontWeight: '700', color: tokens.text },
  soilDap: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  soilMeta: { fontSize: 13, color: tokens.textMuted },
  addSoilBtn: {
    marginTop: 8,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 2,
    borderColor: tokens.green700,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  addSoilBtnText: { fontSize: 15, fontWeight: '600', color: tokens.green800 },
  findingsList: { gap: 10 },
  findingCard: {
    backgroundColor: tokens.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  findingCardAlert: { borderColor: tokens.danger, backgroundColor: '#FFF8F8' },
  recCard: {
    backgroundColor: tokens.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  findingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  findingDate: { fontSize: 12, fontWeight: '700', color: tokens.textMuted },
  findingIssue: { fontSize: 15, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  findingObs: { fontSize: 13, color: tokens.text, lineHeight: 18 },
  findingMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
});
