import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  agronomistClient,
  tokens,
  type ExpertCaseDetail,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel, TextField, MULTILINE_MIN_HEIGHT } from '@morbeez/ui-native';
import { openEscalationVisit } from '@/lib/open-escalation-visit';
import { ExpertCopilotChat } from '@/components/expert-copilot/ExpertCopilotChat';
import { useStaffAuth } from '@/context/StaffAuth';

type ReviewAction = 'approve_ai' | 'correct_ai' | 'partial_match' | 'escalate_urgent';

type CaseDetail = {
  escalation?: Record<string, unknown>;
  farmer?: { name?: string | null; phone?: string | null };
  block?: { name?: string | null; cropType?: string | null };
  images?: Array<{ url?: string }>;
  inquiry?: { farmerQuestion?: string | null; whatsappResponse?: string | null };
  ai?: { probableIssue?: string; summary?: string; confidence?: number };
  location?: { weatherSummary?: string | null };
  context?: {
    soil?: {
      ph?: unknown;
      ec?: unknown;
      organicCarbon?: unknown;
      testedAt?: string | null;
    } | null;
    rainfallNote?: string | null;
  };
  maiosCase?: { route?: string } | null;
  review?: {
    correctDiagnosis?: string | null;
    severity?: string | null;
    recommendationText?: string | null;
    dosage?: string | null;
    notesForLearning?: string | null;
  };
};

function formatSoilLine(
  soil:
    | {
        ph?: unknown;
        ec?: unknown;
        organicCarbon?: unknown;
        testedAt?: string | null;
      }
    | null
    | undefined
): string {
  if (!soil) return 'No soil report on file';
  const parts = [
    soil.ph != null && soil.ph !== '' ? `pH ${soil.ph}` : null,
    soil.ec != null && soil.ec !== '' ? `EC ${soil.ec}` : null,
    soil.organicCarbon != null && soil.organicCarbon !== '' ? `OC ${soil.organicCarbon}` : null,
  ].filter(Boolean);
  const base = parts.length ? parts.join(' · ') : 'Values not recorded';
  return soil.testedAt ? `${base} (${soil.testedAt})` : base;
}

export default function CaseReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = String(id ?? '');
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const [expertDetail, setExpertDetail] = useState<ExpertCaseDetail | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingVisit, setOpeningVisit] = useState(false);
  const [action, setAction] = useState<ReviewAction>('approve_ai');
  const [correctDiagnosis, setCorrectDiagnosis] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [recommendationText, setRecommendationText] = useState('');
  const [dosage, setDosage] = useState('');
  const [notesForLearning, setNotesForLearning] = useState('');

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      try {
        const expert = await agronomistClient.getExpertCase(caseId);
        if (expert.enabled) {
          setExpertDetail(expert);
          setDetail(null);
          return;
        }
      } catch {
        // Progressive enhancement: old escalation/AI case IDs continue to legacy detail.
      }
      const r = await agronomistClient.getAiCase(caseId);
      const d = r as CaseDetail & { ok: boolean };
      setExpertDetail(null);
      setDetail(d);
      setCorrectDiagnosis(d.review?.correctDiagnosis ?? d.ai?.probableIssue ?? '');
      setRecommendationText(
        d.review?.recommendationText ?? d.inquiry?.whatsappResponse ?? d.ai?.summary ?? ''
      );
      setSeverity((d.review?.severity as typeof severity) ?? 'moderate');
      setDosage(d.review?.dosage ?? '');
      setNotesForLearning(d.review?.notesForLearning ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load case');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startSiteVisit() {
    if (!caseId || openingVisit) return;
    setOpeningVisit(true);
    setError('');
    try {
      await openEscalationVisit(caseId, { router });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open site visit');
    } finally {
      setOpeningVisit(false);
    }
  }

  async function submitReview() {
    if (!canWrite || !caseId) return;
    setSaving(true);
    setError('');
    try {
      await agronomistClient.reviewAiCase(caseId, {
        action,
        correctDiagnosis: correctDiagnosis.trim() || undefined,
        severity,
        recommendationText: recommendationText.trim() || undefined,
        dosage: dosage.trim() || undefined,
        notesForLearning: notesForLearning.trim() || undefined,
        submitForApproval: action === 'approve_ai' || action === 'correct_ai',
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading AI case…" />;
  if (expertDetail) {
    return <ExpertCopilotChat detail={expertDetail} canWrite={canWrite} onReload={load} />;
  }
  if (!detail) {
    return (
      <View style={styles.center}>
        {error ? <AlertBox>{error}</AlertBox> : <Text style={styles.muted}>Case not found.</Text>}
      </View>
    );
  }

  const actions: Array<{ id: ReviewAction; label: string }> = [
    { id: 'approve_ai', label: 'Approve' },
    { id: 'correct_ai', label: 'Modify' },
    { id: 'partial_match', label: 'Partial' },
    { id: 'escalate_urgent', label: 'Reject' },
  ];

  const soilLine = formatSoilLine(detail.context?.soil ?? null);
  const weatherLine =
    detail.location?.weatherSummary?.trim() ||
    detail.context?.rainfallNote?.trim() ||
    'Weather not available';
  const maiosRoute = detail.maiosCase?.route;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Site visit">
        <Text style={styles.body}>
          Field cases should use the full site visit form (soil, weather, issues, recommendations).
        </Text>
        <Btn
          label={openingVisit ? 'Opening visit…' : 'Start site visit'}
          onPress={startSiteVisit}
          disabled={openingVisit}
        />
      </Panel>

      <Panel title="Case detail">
        <KeyValueRow label="Farmer" value={detail.farmer?.name ?? detail.farmer?.phone ?? '—'} />
        <KeyValueRow label="Block" value={detail.block?.name ?? '—'} />
        <KeyValueRow label="Crop" value={detail.block?.cropType ?? '—'} />
        {detail.ai?.probableIssue ? <KeyValueRow label="AI issue" value={detail.ai.probableIssue} /> : null}
        {detail.ai?.confidence != null ? (
          <KeyValueRow label="Confidence" value={`${Math.round(detail.ai.confidence * 100)}%`} />
        ) : null}
        {maiosRoute ? <KeyValueRow label="MAIOS route" value={maiosRoute} /> : null}
        {detail.inquiry?.farmerQuestion ? (
          <Text style={styles.body}>Question: {detail.inquiry.farmerQuestion}</Text>
        ) : null}
      </Panel>

      <Panel title="Soil & weather used by AI">
        <KeyValueRow label="Soil test" value={soilLine} />
        <Text style={styles.weather}>{weatherLine}</Text>
      </Panel>

      {detail.images && detail.images.length > 0 ? (
        <Panel title="Images">
          <View style={styles.photoRow}>
            {detail.images
              .filter((img) => img.url?.startsWith('http'))
              .map((img, i) => (
                <Image key={`${img.url}-${i}`} source={{ uri: img.url! }} style={styles.photo} />
              ))}
          </View>
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title="Desk review (optional)">
          <View style={styles.actionRow}>
            {actions.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAction(a.id)}
                style={[styles.chip, action === a.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, action === a.id && styles.chipTextActive]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label="Diagnosis" value={correctDiagnosis} onChangeText={setCorrectDiagnosis} />
          <Text style={styles.fieldLabel}>Recommendation</Text>
          <TextInput
            style={[styles.textArea, styles.input]}
            value={recommendationText}
            onChangeText={setRecommendationText}
            multiline
            placeholderTextColor={tokens.textMuted}
          />
          <TextField label="Dosage" value={dosage} onChangeText={setDosage} />
          <TextField label="Notes for learning" value={notesForLearning} onChangeText={setNotesForLearning} />
          <View style={styles.severityRow}>
            {(['mild', 'moderate', 'severe'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSeverity(s)}
                style={[styles.chip, severity === s && styles.chipActive]}
              >
                <Text style={[styles.chipText, severity === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Btn label={saving ? 'Submitting…' : 'Submit review'} onPress={submitReview} disabled={saving} />
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
  body: { fontSize: 14, color: tokens.text, marginTop: 8, marginBottom: 12, lineHeight: 20 },
  weather: { fontSize: 14, color: tokens.text, marginTop: 8, lineHeight: 20 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 88, height: 88, borderRadius: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  chipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  chipText: { fontSize: 13, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '600' },
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
  textArea: { minHeight: MULTILINE_MIN_HEIGHT, textAlignVertical: 'top', marginBottom: 12 },
});
