import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate, telecallerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

type Props = {
  leadId: string;
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'completed', label: 'Done' },
  { value: 'escalated', label: 'Escalated' },
] as const;

function recBucket(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('escalat')) return 'escalated';
  if (s.includes('complete') || s.includes('applied') || s.includes('resolved')) return 'completed';
  if (s.includes('monitor')) return 'monitoring';
  return 'open';
}

export function LeadRecommendationsPanel({ leadId }: Props) {
  const [recs, setRecs] = useState<Record<string, unknown>[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRecs(await telecallerClient.listLeadRecommendations(leadId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load recommendations');
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return recs;
    return recs.filter((r) => recBucket(String(r.status ?? r.fieldRecStatus ?? '')) === filter);
  }, [recs, filter]);

  const createFollowUp = async () => {
    if (!followUpTitle.trim()) return;
    setSaving(true);
    try {
      await telecallerClient.createLeadTask(leadId, {
        title: followUpTitle.trim(),
        taskCategory: 'recommendation',
      });
      setFollowUpTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create follow-up');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading recommendations…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Recommendations">
        <Text style={styles.hint}>
          WhatsApp follow-up automation is handled by the system. Create a telecaller follow-up when the farmer declines.
        </Text>
      </Panel>
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[styles.chip, filter === f.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      {filtered.map((rec) => {
        const status = String(rec.status ?? rec.fieldRecStatus ?? 'open');
        const escalated = status.toLowerCase().includes('escalat');
        return (
          <ListCard
            key={String(rec.id)}
            title={String(rec.issue ?? rec.title ?? 'Recommendation')}
            subtitle={String(rec.recommendation ?? rec.summary ?? '—')}
            meta={[
              status,
              rec.reviewDate ? formatDate(String(rec.reviewDate)) : null,
              escalated ? 'Escalated' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        );
      })}
      {!filtered.length ? <Text style={styles.empty}>No recommendations in this filter.</Text> : null}
      <Panel title="Create follow-up">
        <TextField
          label="Follow-up title"
          value={followUpTitle}
          onChangeText={setFollowUpTitle}
          placeholder="e.g. Farmer said product unavailable"
        />
        <Btn label={saving ? 'Saving…' : 'Create follow-up'} onPress={() => void createFollowUp()} disabled={saving} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 24 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  chipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  chipText: { fontSize: 13, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '600' },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
