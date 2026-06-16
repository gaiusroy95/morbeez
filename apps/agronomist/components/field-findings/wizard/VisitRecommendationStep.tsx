import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { agronomistClient, tokens, type RecommendationPriority, type VisitAiClient } from '@morbeez/shared';
import { AlertBox, MULTILINE_MIN_HEIGHT, Panel } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

const REVIEW_DAY_OPTIONS = [3, 7, 15, 30] as const;

type Props = {
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
  visitAiClient?: VisitAiClient;
};

function parseCustomDays(raw: string): number | null {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 1 || n > 365) return null;
  return Math.round(n);
}

export function VisitRecommendationStep({ issues, onChange, visitAiClient }: Props) {
  const client = visitAiClient ?? agronomistClient;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customDays, setCustomDays] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRecommendations() {
    setLoading(true);
    setError('');
    try {
      const next = [...issues];
      for (let i = 0; i < next.length; i++) {
        const issue = next[i]!;
        if (!issue.aiCaseId || issue.finalRecommendation?.trim()) continue;
        const rec = await client.recommendVisitAiCase(
          issue.aiCaseId,
          issue.finalDiagnosis ?? issue.selectedHypothesisLabel
        );
        next[i] = {
          ...issue,
          finalRecommendation: rec.text,
          aiDosage: rec.dosage ?? undefined,
          aiPriority: rec.priority as RecommendationPriority,
          reviewAfterDays: rec.reviewAfterDays,
        };
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate recommendation');
    } finally {
      setLoading(false);
    }
  }

  function patchIssue(index: number, patch: Partial<IssueDraft>) {
    const next = [...issues];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  }

  function applyCustomDays(index: number, localId: string) {
    const days = parseCustomDays(customDays[localId] ?? '');
    if (days == null) {
      setError('Custom review days must be between 1 and 365.');
      return;
    }
    setError('');
    patchIssue(index, { reviewAfterDays: days });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
        <Text style={styles.loadingText}>Drafting AI recommendation…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {issues.map((issue, index) => {
        const presetActive = (REVIEW_DAY_OPTIONS as readonly number[]).includes(issue.reviewAfterDays ?? 7);
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            <Text style={styles.label}>Recommendation (editable draft)</Text>
            <TextInput
              style={[styles.input, { minHeight: MULTILINE_MIN_HEIGHT }]}
              multiline
              value={issue.finalRecommendation ?? ''}
              onChangeText={(text) => patchIssue(index, { finalRecommendation: text })}
              placeholder="AI recommendation draft"
            />
            {issue.aiDosage ? (
              <Text style={styles.dosage}>Dosage: {issue.aiDosage}</Text>
            ) : null}
            <Text style={styles.label}>Review after (days)</Text>
            <View style={styles.chipRow}>
              {REVIEW_DAY_OPTIONS.map((days) => {
                const active = (issue.reviewAfterDays ?? 7) === days;
                return (
                  <Pressable
                    key={days}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => patchIssue(index, { reviewAfterDays: days })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{days}d</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                keyboardType="number-pad"
                placeholder="Custom days"
                value={customDays[issue.localId] ?? (!presetActive ? String(issue.reviewAfterDays ?? '') : '')}
                onChangeText={(text) => setCustomDays((prev) => ({ ...prev, [issue.localId]: text }))}
              />
              <Pressable style={styles.customBtn} onPress={() => applyCustomDays(index, issue.localId)}>
                <Text style={styles.customBtnText}>Set</Text>
              </Pressable>
            </View>
          </Panel>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: tokens.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    fontSize: 14,
    color: tokens.text,
    backgroundColor: tokens.bg,
    textAlignVertical: 'top',
  },
  dosage: { fontSize: 13, color: tokens.textMuted, marginTop: 8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  chipActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  chipText: { fontSize: 13, color: tokens.textMuted, fontWeight: '600' },
  chipTextActive: { color: tokens.green800 },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.text,
    backgroundColor: tokens.bg,
  },
  customBtn: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  customBtnText: { color: '#fff', fontWeight: '700' },
});
