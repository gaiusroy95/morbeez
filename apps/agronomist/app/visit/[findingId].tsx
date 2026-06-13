import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { agronomistClient, formatDate, tokens } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';

type IssueRow = {
  id: string;
  issue_name?: string;
  issue_category?: string;
  severity?: string;
  observation?: string;
  status?: string;
  issue_photos?: Array<{ public_url?: string; storage_path?: string }>;
};

type RecRow = {
  id: string;
  visit_issue_id?: string | null;
  issue_detected?: string | null;
  recommendation_text?: string | null;
  status?: string | null;
  outcome?: string | null;
  outcome_notes?: string | null;
  outcome_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function recReviewDate(rec: RecRow): string | null {
  const meta = rec.metadata ?? {};
  const reviewDate = meta.reviewDate ?? meta.review_date;
  if (typeof reviewDate === 'string' && reviewDate) {
    return formatDate(reviewDate);
  }
  const fieldRecStatus = meta.fieldRecStatus;
  if (typeof fieldRecStatus === 'string' && fieldRecStatus.includes('review')) {
    return fieldRecStatus.replace(/_/g, ' ');
  }
  return null;
}

function recFieldStatus(rec: RecRow): string | null {
  const meta = rec.metadata ?? {};
  const status = meta.fieldRecStatus ?? meta.field_rec_status;
  return typeof status === 'string' ? status.replace(/_/g, ' ') : null;
}

export default function VisitDetailScreen() {
  const { findingId } = useLocalSearchParams<{ findingId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finding, setFinding] = useState<Record<string, unknown> | null>(null);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [measurements, setMeasurements] = useState<Array<Record<string, unknown>>>([]);
  const [recommendations, setRecommendations] = useState<RecRow[]>([]);

  const load = useCallback(async () => {
    if (!findingId) return;
    setLoading(true);
    setError('');
    try {
      const detail = await agronomistClient.getVisitDetail(findingId);
      setFinding(detail.finding as Record<string, unknown>);
      setIssues((detail.issues ?? []) as IssueRow[]);
      setMeasurements((detail.measurements ?? []) as Array<Record<string, unknown>>);
      setRecommendations((detail.recommendations ?? []) as RecRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load visit');
    } finally {
      setLoading(false);
    }
  }, [findingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const recsByIssue = useMemo(() => {
    const map = new Map<string, RecRow[]>();
    for (const rec of recommendations) {
      const key = rec.visit_issue_id ? String(rec.visit_issue_id) : '_unlinked';
      const list = map.get(key) ?? [];
      list.push(rec);
      map.set(key, list);
    }
    return map;
  }, [recommendations]);

  const outcomeRows = useMemo(
    () =>
      recommendations.filter(
        (r) => r.outcome || r.outcome_notes || r.outcome_at || r.metadata?.outcomeReview
      ),
    [recommendations]
  );

  if (loading) return <Loading label="Loading visit…" />;
  if (!finding) {
    return (
      <View style={styles.center}>
        {error ? <AlertBox>{error}</AlertBox> : <Text style={styles.muted}>Visit not found.</Text>}
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Visit summary">
        <KeyValueRow label="Block" value={String(finding.block_name ?? '—')} />
        <KeyValueRow label="Crop" value={String(finding.crop_type ?? '—')} />
        <KeyValueRow
          label="Visited"
          value={finding.visited_at ? formatDate(String(finding.visited_at)) : '—'}
        />
        {finding.dap_at_visit != null ? (
          <KeyValueRow label="DAP" value={String(finding.dap_at_visit)} />
        ) : null}
        {finding.block_health ? (
          <KeyValueRow label="Block health" value={String(finding.block_health).replace(/_/g, ' ')} />
        ) : null}
        {finding.crop_performance ? (
          <KeyValueRow label="Crop performance" value={String(finding.crop_performance).replace(/_/g, ' ')} />
        ) : null}
        {finding.soil_moisture ? (
          <KeyValueRow label="Soil moisture" value={String(finding.soil_moisture).replace(/_/g, ' ')} />
        ) : null}
        {finding.observations ? (
          <Text style={styles.body}>{String(finding.observations)}</Text>
        ) : null}
      </Panel>

      {issues.map((issue) => {
        const issueRecs = recsByIssue.get(issue.id) ?? [];
        return (
          <Panel key={issue.id} title={String(issue.issue_name ?? 'Issue')}>
            <KeyValueRow label="Category" value={String(issue.issue_category ?? '—').replace(/_/g, ' ')} />
            <KeyValueRow label="Severity" value={String(issue.severity ?? '—')} />
            <KeyValueRow label="Status" value={String(issue.status ?? '—')} />
            {issue.observation ? <Text style={styles.body}>{issue.observation}</Text> : null}
            {(issue.issue_photos ?? []).length ? (
              <View style={styles.photoRow}>
                {(issue.issue_photos ?? []).map((p, i) => {
                  const uri = p.public_url ?? p.storage_path;
                  if (!uri) return null;
                  return <Image key={`${issue.id}-${i}`} source={{ uri }} style={styles.photo} />;
                })}
              </View>
            ) : null}

            {issueRecs.length ? (
              <View style={styles.issueRecBlock}>
                <Text style={styles.sectionLabel}>Recommendations for this issue</Text>
                {issueRecs.map((rec) => (
                  <View key={rec.id} style={styles.recRow}>
                    <Text style={styles.body}>{String(rec.recommendation_text ?? '')}</Text>
                    <Text style={styles.meta}>
                      {[
                        recFieldStatus(rec) ?? rec.status,
                        recReviewDate(rec) ? `Review ${recReviewDate(rec)}` : null,
                        rec.outcome ? `Outcome: ${rec.outcome}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Panel>
        );
      })}

      {(recsByIssue.get('_unlinked') ?? []).length ? (
        <Panel title="Other recommendations">
          {(recsByIssue.get('_unlinked') ?? []).map((rec) => (
            <View key={rec.id} style={styles.recRow}>
              <Text style={styles.recIssue}>{String(rec.issue_detected ?? 'Recommendation')}</Text>
              <Text style={styles.body}>{String(rec.recommendation_text ?? '')}</Text>
              <Text style={styles.meta}>
                {[recFieldStatus(rec) ?? rec.status, recReviewDate(rec)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </Panel>
      ) : null}

      {measurements.length ? (
        <Panel title="Measurements">
          {measurements.map((m) => (
            <KeyValueRow
              key={String(m.id ?? m.measurement_key)}
              label={String(m.label_en ?? m.measurement_key ?? 'Measurement')}
              value={[m.value, m.unit].filter(Boolean).join(' ')}
            />
          ))}
        </Panel>
      ) : null}

      {outcomeRows.length ? (
        <Panel title="Follow-up outcomes">
          {outcomeRows.map((rec) => (
            <View key={`outcome-${rec.id}`} style={styles.recRow}>
              <Text style={styles.recIssue}>{String(rec.issue_detected ?? 'Recommendation')}</Text>
              <Text style={styles.body}>
                {rec.outcome_notes?.trim()
                  ? String(rec.outcome_notes)
                  : `Outcome recorded: ${rec.outcome ?? 'unknown'}`}
              </Text>
              <Text style={styles.meta}>
                {[rec.outcome, rec.outcome_at ? formatDate(String(rec.outcome_at)) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ))}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  muted: { color: tokens.textMuted, textAlign: 'center' },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20, marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: tokens.textMuted, marginTop: 12 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photo: { width: 88, height: 88, borderRadius: 8 },
  issueRecBlock: { marginTop: 4 },
  recRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: tokens.border },
  recIssue: { fontSize: 14, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
});
