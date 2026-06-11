import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { agronomistClient, formatDate, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel, TextField } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

type QueueItem = {
  finding: {
    id: string;
    farmerId: string;
    blockId: string | null;
    blockName: string;
    cropType: string;
    observations: string | null;
    diseasePest: string | null;
    diseaseTone: string;
    visitedAt: string;
    photoUrls?: string[];
  };
  farmer: { name: string | null; phone: string | null; preferredLanguage: string } | null;
  block: { id: string; name: string; cropType: string; plotLabel: string | null } | null;
  existingRecommendation: { id: string; status: string } | null;
};

type AiSuggestion = {
  sessionId: string;
  escalated: boolean;
  suggested: {
    issueDetected: string;
    recommendationText: string;
    dosage?: string;
    weatherWarning?: string;
    language: string;
  };
  existingRecommendationId: string | null;
  advisory: { confidence: number; probableIssue: string };
};

export default function FindingReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const [item, setItem] = useState<QueueItem | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ sessionId?: string; confidence?: number } | null>(null);
  const [form, setForm] = useState({
    recommendationId: '',
    findingId: '',
    farmerId: '',
    blockId: '',
    issueDetected: '',
    recommendationText: '',
    dosage: '',
    weatherWarning: '',
    language: 'en',
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const q = await agronomistClient.getReviewQueue(80);
      const match = q.find((i) => i.finding.id === id);
      if (match) {
        const queueItem = match as unknown as QueueItem;
        setItem(queueItem);
        setForm({
          recommendationId: queueItem.existingRecommendation?.id ?? '',
          findingId: queueItem.finding.id,
          farmerId: queueItem.finding.farmerId,
          blockId: queueItem.block?.id ?? queueItem.finding.blockId ?? '',
          issueDetected: queueItem.finding.diseasePest ?? '',
          recommendationText: '',
          dosage: '',
          weatherWarning: '',
          language: queueItem.farmer?.preferredLanguage?.slice(0, 2) ?? 'en',
        });
      } else {
        const d = await agronomistClient.getFinding(id);
        const f = d.finding as Record<string, unknown>;
        setItem({
          finding: {
            id: String(f.id),
            farmerId: String(f.farmer_id ?? ''),
            blockId: f.block_id ? String(f.block_id) : null,
            blockName: String(f.block_name ?? ''),
            cropType: String(f.crop_type ?? ''),
            observations: f.observations ? String(f.observations) : null,
            diseasePest: f.disease_pest ? String(f.disease_pest) : null,
            diseaseTone: String(f.disease_tone ?? 'warning'),
            visitedAt: String(f.visited_at ?? ''),
            photoUrls: Array.isArray(f.photo_urls) ? (f.photo_urls as string[]) : [],
          },
          farmer: null,
          block: null,
          existingRecommendation: d.recommendation
            ? { id: String((d.recommendation as { id: string }).id), status: 'draft' }
            : null,
        });
        setForm((prev) => ({
          ...prev,
          recommendationId: d.recommendation ? String((d.recommendation as { id: string }).id) : '',
          findingId: String(f.id),
          farmerId: String(f.farmer_id ?? ''),
          blockId: f.block_id ? String(f.block_id) : '',
          issueDetected: f.disease_pest ? String(f.disease_pest) : '',
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load finding');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAiSuggest() {
    if (!id || !canWrite) return;
    setAiLoading(true);
    setError('');
    try {
      const d = (await agronomistClient.aiSuggestFinding(id)) as AiSuggestion & { ok: boolean };
      setAiMeta({ sessionId: d.sessionId, confidence: d.advisory.confidence });
      setForm((f) => ({
        ...f,
        recommendationId: d.existingRecommendationId ?? f.recommendationId,
        issueDetected: d.suggested.issueDetected,
        recommendationText: d.suggested.recommendationText,
        dosage: d.suggested.dosage ?? '',
        weatherWarning: d.suggested.weatherWarning ?? '',
        language: d.suggested.language,
      }));
      if (d.escalated) {
        setError('AI flagged for escalation — review carefully before submitting.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  }

  async function saveDraft() {
    if (!canWrite || !form.findingId) return;
    setSaving(true);
    setError('');
    try {
      const d = (await agronomistClient.saveDraft({
        findingId: form.findingId,
        farmerId: form.farmerId,
        blockId: form.blockId || undefined,
        recommendationId: form.recommendationId || undefined,
        aiSessionId: aiMeta?.sessionId,
        issueDetected: form.issueDetected || undefined,
        recommendationText: form.recommendationText,
        dosage: form.dosage || undefined,
        weatherWarning: form.weatherWarning || undefined,
        language: form.language,
      })) as { ok: boolean; recommendation: { id: string } };
      setForm((f) => ({ ...f, recommendationId: d.recommendation.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval() {
    if (!canWrite || !form.recommendationId) {
      setError('Save draft first');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await agronomistClient.submitRecommendation(form.recommendationId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading finding…" />;
  if (!item) {
    return (
      <View style={styles.center}>
        {error ? <AlertBox>{error}</AlertBox> : <Text style={styles.muted}>Finding not found.</Text>}
      </View>
    );
  }

  const finding = item.finding;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Finding detail">
        <KeyValueRow label="Farmer" value={item.farmer?.name ?? item.farmer?.phone ?? '—'} />
        <KeyValueRow label="Block" value={item.block?.plotLabel ?? finding.blockName} />
        <KeyValueRow label="Crop" value={finding.cropType} />
        <KeyValueRow label="Visited" value={formatDate(finding.visitedAt)} />
        {finding.diseasePest ? <KeyValueRow label="Issue" value={finding.diseasePest} /> : null}
        <Text style={styles.obs}>{finding.observations ?? 'No observations recorded.'}</Text>
      </Panel>

      {Array.isArray(finding.photoUrls) && finding.photoUrls.length > 0 ? (
        <Panel title="Visit photos">
          <View style={styles.photoRow}>
            {finding.photoUrls
              .filter((url) => typeof url === 'string' && url.startsWith('http'))
              .map((url, i) => (
                <Image key={`${url}-${i}`} source={{ uri: url }} style={styles.photo} />
              ))}
          </View>
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title="Recommendation">
          {aiMeta?.confidence != null ? (
            <Text style={styles.confidence}>AI confidence: {Math.round(aiMeta.confidence * 100)}%</Text>
          ) : null}
          <Btn
            label={aiLoading ? 'Running AI…' : 'Generate AI suggestion'}
            onPress={runAiSuggest}
            disabled={aiLoading}
            variant="secondary"
          />
          <TextField
            label="Issue detected"
            value={form.issueDetected}
            onChangeText={(v) => setForm((f) => ({ ...f, issueDetected: v }))}
          />
          <Text style={styles.fieldLabel}>Recommendation</Text>
          <TextInput
            style={[styles.textArea, styles.input]}
            value={form.recommendationText}
            onChangeText={(v) => setForm((f) => ({ ...f, recommendationText: v }))}
            multiline
            placeholderTextColor={tokens.textMuted}
          />
          <TextField label="Dosage" value={form.dosage} onChangeText={(v) => setForm((f) => ({ ...f, dosage: v }))} />
          <TextField
            label="Weather warning"
            value={form.weatherWarning}
            onChangeText={(v) => setForm((f) => ({ ...f, weatherWarning: v }))}
          />
          <Btn label={saving ? 'Saving…' : 'Save draft'} onPress={saveDraft} disabled={saving} variant="secondary" />
          <Btn
            label={saving ? 'Submitting…' : 'Submit for approval'}
            onPress={submitForApproval}
            disabled={saving || !form.recommendationId}
          />
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  muted: { color: tokens.textMuted, textAlign: 'center' },
  obs: { fontSize: 14, color: tokens.text, marginTop: 8, lineHeight: 20 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 88, height: 88, borderRadius: 8 },
  confidence: { fontSize: 12, color: tokens.textMuted, marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6 },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    fontSize: 15,
    color: tokens.text,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
});
