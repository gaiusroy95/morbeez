import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  agronomistClient,
  tokens,
  type ExpertCaseDetail,
  type ExpertCaseDraft,
  type ExpertCaseSafetyDecision,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel, TextField, MULTILINE_MIN_HEIGHT } from '@morbeez/ui-native';
import { openEscalationVisit } from '@/lib/open-escalation-visit';
import { canCommitExpertDraft } from '@/lib/expert-copilot';
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

function ExpertCopilotCase({
  detail: initialDetail,
  canWrite,
  onReload,
}: {
  detail: ExpertCaseDetail;
  canWrite: boolean;
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const caseId = initialDetail.expertCase.id;
  const [detail, setDetail] = useState(initialDetail);
  const [draft, setDraft] = useState<ExpertCaseDraft>(
    initialDetail.draft?.draft_json ?? {
      diagnosis: initialDetail.expertCase.primary_issue_label ?? '',
      recommendationText: '',
      dosage: '',
      notes: '',
    }
  );
  const [message, setMessage] = useState('');
  const [applicationType, setApplicationType] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [safety, setSafety] = useState<{
    decision: ExpertCaseSafetyDecision['decision'];
    decisionId: string;
    blockers: Array<{ code?: string; message?: string }>;
    warnings: Array<{ code?: string; message?: string }>;
  } | null>(
    initialDetail.safety
      ? {
          decision: initialDetail.safety.decision,
          decisionId: initialDetail.safety.id,
          blockers: initialDetail.safety.blockers ?? [],
          warnings: initialDetail.safety.warnings ?? [],
        }
      : null
  );
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);

  const leaseToken = detail.expertCase.lease_token ?? undefined;

  useEffect(() => {
    if (!leaseToken) return;
    const timer = setInterval(() => {
      void agronomistClient.heartbeatExpertCase(caseId, leaseToken).catch(() => undefined);
    }, 5 * 60_000);
    return () => clearInterval(timer);
  }, [caseId, leaseToken]);

  function updateDraft<K extends keyof ExpertCaseDraft>(key: K, value: ExpertCaseDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSafety(null);
    setSafetyConfirmed(false);
  }

  async function claim() {
    if (!canWrite || busy) return;
    setBusy('claim');
    setError('');
    try {
      await agronomistClient.claimExpertCase(caseId, 'mobile_case_detail');
      const next = await agronomistClient.getExpertCase(caseId);
      setDetail(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim case');
    } finally {
      setBusy('');
    }
  }

  async function sendMessage() {
    const content = message.trim();
    if (!content || !leaseToken || busy) return;
    setBusy('chat');
    setError('');
    try {
      const result = await agronomistClient.postExpertCaseChat(caseId, content, leaseToken);
      setDetail((current) => ({
        ...current,
        turns: [...current.turns, result.agronomistTurn, result.assistantTurn],
        draft: {
          id: current.draft?.id ?? `pending:${caseId}`,
          case_id: caseId,
          base_revision: result.baseRevision,
          draft_revision: result.baseRevision + 1,
          status: 'pending',
          draft_json: result.draft,
          created_at: current.draft?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }));
      setDraft(result.draft);
      setMessage('');
      setSafety(null);
      setSafetyConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setBusy('');
    }
  }

  async function runSafetyCheck() {
    if (!leaseToken || busy) return;
    setBusy('safety');
    setError('');
    try {
      const result = await agronomistClient.evaluateExpertCaseSafety(caseId, {
        recommendationRevision: String(detail.expertCase.current_revision),
        validation: {
          farmerId: detail.expertCase.farmer_id,
          blockId: detail.expertCase.block_id ?? '',
          cropType: detail.expertCase.crop_type ?? undefined,
          recommendationGroups: [],
        },
        unstructured: {
          recommendationText: draft.recommendationText,
          dosage: draft.dosage,
          cropType: detail.expertCase.crop_type,
          applicationType,
        },
      });
      setSafety(result.result);
      setSafetyConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Safety check failed');
    } finally {
      setBusy('');
    }
  }

  async function commit() {
    if (!leaseToken || !safety || !canCommitExpertDraft(safety.decision, safetyConfirmed) || busy) return;
    setBusy('commit');
    setError('');
    try {
      if (detail.draft?.status === 'pending') {
        await agronomistClient.approveExpertCaseDraft(caseId, {
          leaseToken,
          expectedBaseRevision: detail.draft.base_revision,
          draftPatch: draft,
        });
      }
      await agronomistClient.commitExpertCase(caseId, {
        idempotencyKey: `mobile:${caseId}:${detail.expertCase.current_revision}:${Date.now()}`,
        leaseToken,
        expectedRevision: detail.expertCase.current_revision,
        draft,
        safetyDecisionId: safety.decisionId,
        closeCase: true,
      });
      await onReload();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not commit review');
    } finally {
      setBusy('');
    }
  }

  const safetyIssues = [...(safety?.blockers ?? []), ...(safety?.warnings ?? [])];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Expert Copilot">
        <KeyValueRow label="Issue" value={detail.expertCase.primary_issue_label ?? 'Expert review'} />
        <KeyValueRow label="Crop" value={detail.expertCase.crop_type ?? '—'} />
        <KeyValueRow label="Priority" value={detail.expertCase.priority_tier.replaceAll('_', ' ')} />
        <KeyValueRow label="Status" value={detail.expertCase.assignment_status.replaceAll('_', ' ')} />
        {!leaseToken && canWrite ? (
          <Btn label={busy === 'claim' ? 'Claiming…' : 'Claim case'} onPress={claim} disabled={Boolean(busy)} />
        ) : null}
      </Panel>

      <Panel title="Conversation">
        {detail.turns.length === 0 ? (
          <Text style={styles.muted}>Tell Copilot what you observed and what should change.</Text>
        ) : (
          detail.turns.map((turn) => (
            <View
              key={turn.id}
              style={[styles.chatBubble, turn.role === 'agronomist' ? styles.chatMine : styles.chatAssistant]}
            >
              <Text style={styles.chatRole}>
                {turn.role === 'agronomist' ? 'You' : turn.role === 'assistant' ? 'Copilot' : turn.role}
              </Text>
              <Text style={styles.chatText}>{turn.content}</Text>
            </View>
          ))
        )}
        {leaseToken && canWrite ? (
          <>
            <TextInput
              style={[styles.input, styles.chatInput]}
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Describe findings or ask Copilot to update the draft"
              placeholderTextColor={tokens.textMuted}
            />
            <Btn
              label={busy === 'chat' ? 'Sending…' : 'Send'}
              onPress={sendMessage}
              disabled={Boolean(busy) || !message.trim()}
            />
          </>
        ) : null}
      </Panel>

      <Panel title="Editable draft">
        <TextField label="Diagnosis" value={draft.diagnosis ?? ''} onChangeText={(v) => updateDraft('diagnosis', v)} />
        <Text style={styles.fieldLabel}>Recommendation</Text>
        <TextInput
          style={[styles.textArea, styles.input]}
          value={draft.recommendationText ?? ''}
          onChangeText={(v) => updateDraft('recommendationText', v)}
          multiline
          placeholder="Treatment and application instructions"
          placeholderTextColor={tokens.textMuted}
        />
        <TextField label="Dosage" value={draft.dosage ?? ''} onChangeText={(v) => updateDraft('dosage', v)} />
        <TextField
          label="Application mode"
          value={applicationType}
          onChangeText={(value) => {
            setApplicationType(value);
            setSafety(null);
            setSafetyConfirmed(false);
          }}
        />
        <TextField label="Severity" value={draft.severity ?? ''} onChangeText={(v) => updateDraft('severity', v)} />
        <TextField
          label="Follow-up days"
          value={draft.followUpDays == null ? '' : String(draft.followUpDays)}
          onChangeText={(v) => updateDraft('followUpDays', v ? Number(v.replace(/\D/g, '')) : null)}
          keyboardType="number-pad"
        />
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.textArea, styles.input]}
          value={draft.notes ?? ''}
          onChangeText={(v) => updateDraft('notes', v)}
          multiline
          placeholderTextColor={tokens.textMuted}
        />
      </Panel>

      {leaseToken && canWrite ? (
        <Panel title="Safety confirmation">
          <Btn
            label={busy === 'safety' ? 'Checking…' : 'Run safety check'}
            onPress={runSafetyCheck}
            disabled={Boolean(busy) || !draft.recommendationText?.trim()}
            variant="secondary"
          />
          {safety ? (
            <View style={[styles.safetyBox, safety.decision === 'PASS' ? styles.safetyPass : styles.safetyStop]}>
              <Text style={styles.safetyTitle}>Safety result: {safety.decision}</Text>
              {safetyIssues.map((issue, index) => (
                <Text key={`${issue.code}-${index}`} style={styles.safetyText}>
                  • {issue.message ?? issue.code ?? 'Review required'}
                </Text>
              ))}
            </View>
          ) : null}
          {safety?.decision === 'PASS' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: safetyConfirmed }}
              onPress={() => setSafetyConfirmed((value) => !value)}
              style={styles.confirmRow}
            >
              <View style={[styles.checkbox, safetyConfirmed && styles.checkboxChecked]}>
                <Text style={styles.checkmark}>{safetyConfirmed ? '✓' : ''}</Text>
              </View>
              <Text style={styles.confirmText}>
                I reviewed the diagnosis, dosage, compatibility, and farmer instructions.
              </Text>
            </Pressable>
          ) : null}
          <Btn
            label={busy === 'commit' ? 'Committing…' : 'Confirm and close case'}
            onPress={commit}
            disabled={Boolean(busy) || !canCommitExpertDraft(safety?.decision, safetyConfirmed)}
          />
        </Panel>
      ) : null}

      {detail.expertCase.queue_route === 'field' &&
      detail.links.some((link) => link.link_type === 'escalation' && link.entity_id) ? (
        <Panel title="Field workflow">
          <Text style={styles.body}>This case is routed for field verification.</Text>
          <Btn
            label="Open legacy site visit"
            onPress={() => {
              const link = detail.links.find(
                (item) => item.link_type === 'escalation' && item.entity_id
              );
              if (link?.entity_id) {
                void openEscalationVisit(String(link.entity_id), { router }).catch((e) =>
                  setError(e instanceof Error ? e.message : 'Could not open site visit')
                );
              }
            }}
            variant="secondary"
          />
        </Panel>
      ) : null}
    </ScrollView>
  );
}

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
    return <ExpertCopilotCase detail={expertDetail} canWrite={canWrite} onReload={load} />;
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
  chatBubble: { borderRadius: tokens.radiusSm, padding: 10, marginBottom: 8, maxWidth: '92%' },
  chatMine: { backgroundColor: tokens.green100, alignSelf: 'flex-end' },
  chatAssistant: { backgroundColor: tokens.cardMuted, alignSelf: 'flex-start' },
  chatRole: { color: tokens.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  chatText: { color: tokens.text, fontSize: 14, lineHeight: 20 },
  chatInput: { minHeight: 74, textAlignVertical: 'top', marginTop: 10, marginBottom: 10 },
  safetyBox: { borderWidth: 1, borderRadius: tokens.radiusSm, padding: 12, marginTop: 12 },
  safetyPass: { borderColor: tokens.success, backgroundColor: tokens.successBg },
  safetyStop: { borderColor: tokens.warning, backgroundColor: tokens.warningBg },
  safetyTitle: { color: tokens.text, fontWeight: '700', marginBottom: 4 },
  safetyText: { color: tokens.textSecondary, fontSize: 13, lineHeight: 19 },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginVertical: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: tokens.green700, borderColor: tokens.green700 },
  checkmark: { color: tokens.textOnPrimary, fontWeight: '700' },
  confirmText: { flex: 1, color: tokens.text, fontSize: 13, lineHeight: 19 },
});
