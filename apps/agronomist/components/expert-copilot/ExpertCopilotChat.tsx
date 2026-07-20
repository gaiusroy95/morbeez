import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  agronomistClient,
  draftValidationChecklist,
  formatDate,
  shadow,
  tokens,
  type ExpertCaseBriefing,
  type ExpertCaseDetail,
  type ExpertCaseDraft,
  type ExpertCaseSafetyDecision,
} from '@morbeez/shared';
import { AlertBox } from '@morbeez/ui-native';
import { openEscalationVisit } from '@/lib/open-escalation-visit';
import { canCommitExpertDraft } from '@/lib/expert-copilot';

type ChatListItem =
  | { kind: 'assigned'; id: string }
  | { kind: 'summary'; id: string }
  | { kind: 'image_analysis'; id: string }
  | { kind: 'turn'; id: string; turnId: string }
  | { kind: 'preview'; id: string }
  | { kind: 'validations'; id: string }
  | { kind: 'missing'; id: string }
  | { kind: 'safety'; id: string }
  | { kind: 'approved'; id: string };

function priorityColor(priority: string): string {
  if (priority === 'urgent' || priority === 'high') return tokens.danger;
  if (priority === 'low') return tokens.textMuted;
  return tokens.warning;
}

function priorityLabel(priority: string): string {
  if (priority === 'urgent' || priority === 'high') return `🔴 ${priority}`;
  return priority;
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function confidencePct(value?: number | null): string | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
}

function CheckLine({ text, ok = true }: { text: string; ok?: boolean }) {
  return (
    <Text style={styles.checkLine}>
      {ok ? '✓' : '•'} {text}
    </Text>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function PreviewRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.previewCell, wide && styles.previewCellWide]}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

export function ExpertCopilotChat({
  detail: initialDetail,
  canWrite,
  onReload,
}: {
  detail: ExpertCaseDetail;
  canWrite: boolean;
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const listRef = useRef<FlatList<ChatListItem>>(null);
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
  const [briefing, setBriefing] = useState<ExpertCaseBriefing | null>(
    initialDetail.briefing ?? null
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [approvedActions, setApprovedActions] = useState<string[] | null>(null);
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
  const turns = detail.turns;

  useEffect(() => {
    setDetail(initialDetail);
    if (initialDetail.draft?.draft_json) setDraft(initialDetail.draft.draft_json);
    if (initialDetail.briefing) setBriefing(initialDetail.briefing);
  }, [initialDetail]);

  useEffect(() => {
    if (!leaseToken) return;
    const timer = setInterval(() => {
      void agronomistClient.heartbeatExpertCase(caseId, leaseToken).catch(() => undefined);
    }, 5 * 60_000);
    return () => clearInterval(timer);
  }, [caseId, leaseToken]);

  useEffect(() => {
    if (briefing) return;
    let cancelled = false;
    void (async () => {
      const next: ExpertCaseBriefing = {
        farmerName: null,
        cropType: detail.expertCase.crop_type,
        images: [],
        imageCount: 0,
        previousActivities: [],
        primaryDiagnosis: detail.expertCase.primary_issue_label,
        soil: { ph: 'Pending', ec: 'Pending', status: 'pending' },
      };
      try {
        const profile = await agronomistClient.getFarmer360(detail.expertCase.farmer_id);
        next.farmerName =
          (typeof profile.name === 'string' && profile.name) ||
          (typeof profile.farmerName === 'string' && profile.farmerName) ||
          (typeof profile.phone === 'string' && profile.phone) ||
          null;
      } catch {
        /* optional */
      }
      const escalationId = detail.links.find(
        (link) => String(link.link_type ?? '') === 'escalation' && link.entity_id
      )?.entity_id;
      const aiCaseId = detail.links.find(
        (link) =>
          ['ai_case', 'advisory_session', 'case', 'visit_ai_case'].includes(
            String(link.link_type ?? '')
          ) && link.entity_id
      )?.entity_id;
      for (const id of [aiCaseId, escalationId].filter(Boolean) as string[]) {
        try {
          const caseRow = await agronomistClient.getAiCase(id);
          const images = Array.isArray(caseRow.images)
            ? (caseRow.images as Array<{ url?: string; photoType?: string }>)
                .map((img, index) =>
                  img.url?.startsWith('http')
                    ? { url: img.url, label: img.photoType || `Photo ${index + 1}` }
                    : null
                )
                .filter((img): img is { url: string; label: string } => Boolean(img))
            : [];
          const soil = (caseRow.context as { soil?: Record<string, unknown> } | undefined)?.soil;
          if (images.length) {
            next.images = images;
            next.imageCount = images.length;
          }
          if (soil) {
            next.soil = {
              ph: soil.ph != null && soil.ph !== '' ? String(soil.ph) : 'Pending',
              ec: soil.ec != null && soil.ec !== '' ? String(soil.ec) : 'Pending',
              status:
                soil.ph != null && soil.ph !== '' && soil.ec != null && soil.ec !== ''
                  ? 'available'
                  : 'pending',
            };
          }
          if (images.length) break;
        } catch {
          /* try next */
        }
      }
      if (!cancelled) setBriefing(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [briefing, detail.expertCase.crop_type, detail.expertCase.farmer_id, detail.expertCase.primary_issue_label, detail.links]);

  const hasPreview = Boolean(
    draft.diagnosis ||
      draft.treatmentProduct ||
      draft.recommendationText ||
      draft.dosage ||
      (draft.evidence?.length ?? 0) > 0
  );
  const hasValidations = Boolean(draft.validations);
  const hasMissingQs =
    (draft.farmerQuestions?.length ?? 0) > 0 &&
    (!draft.farmerQuestionsSent || !draft.farmerAnswers);

  const listItems = useMemo<ChatListItem[]>(() => {
    const items: ChatListItem[] = [
      { kind: 'assigned', id: 'assigned' },
      { kind: 'summary', id: 'summary' },
    ];
    if (draft.imageAnalysis?.findings?.length) {
      items.push({ kind: 'image_analysis', id: 'image_analysis' });
    }
    for (const turn of turns) {
      items.push({ kind: 'turn', id: `turn:${turn.id}`, turnId: turn.id });
    }
    if (hasPreview) items.push({ kind: 'preview', id: 'preview' });
    if (hasValidations) items.push({ kind: 'validations', id: 'validations' });
    if (hasMissingQs) items.push({ kind: 'missing', id: 'missing' });
    if (safety) items.push({ kind: 'safety', id: 'safety' });
    if (approvedActions) items.push({ kind: 'approved', id: 'approved' });
    return items;
  }, [
    approvedActions,
    draft.imageAnalysis?.findings?.length,
    hasMissingQs,
    hasPreview,
    hasValidations,
    safety,
    turns,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [listItems.length, busy]);

  async function claim() {
    if (!canWrite || busy) return;
    setBusy('claim');
    setError('');
    try {
      await agronomistClient.claimExpertCase(caseId, 'mobile_case_detail');
      const next = await agronomistClient.getExpertCase(caseId);
      setDetail(next);
      if (next.draft?.draft_json) setDraft(next.draft.draft_json);
      if (next.briefing) setBriefing(next.briefing);
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
          recommendationText:
            draft.recommendationText ||
            [draft.treatmentProduct, draft.nutritionProduct].filter(Boolean).join(' · '),
          dosage: draft.dosage || draft.nutritionDose,
          cropType: detail.expertCase.crop_type,
          applicationType: draft.applicationMethod || 'foliar',
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

  async function openNextCase(preferredId?: string | null) {
    try {
      if (preferredId) {
        router.replace(`/case/${preferredId}`);
        return;
      }
      const queue = await agronomistClient.getExpertCaseQueue();
      const next =
        queue.buckets.my_work.find((row) => row.id !== caseId) ??
        queue.buckets.available.find((row) => row.id !== caseId) ??
        null;
      if (next) {
        router.replace(`/case/${next.id}`);
        return;
      }
      router.back();
    } catch {
      router.back();
    }
  }

  async function commit() {
    if (!leaseToken || !safety || !canCommitExpertDraft(safety.decision, safetyConfirmed) || busy) {
      return;
    }
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
      const commitResult = await agronomistClient.commitExpertCase(caseId, {
        idempotencyKey: `mobile:${caseId}:${detail.expertCase.current_revision}:${Date.now()}`,
        leaseToken,
        expectedRevision: detail.expertCase.current_revision,
        draft,
        safetyDecisionId: safety.decisionId,
        closeCase: true,
        summary: {
          diagnosis: draft.diagnosis,
          treatmentProduct: draft.treatmentProduct,
          followUpDays: draft.followUpDays ?? 7,
          knowledgeCandidate: draft.knowledgeCandidate ?? true,
        },
      });
      setApprovedActions([
        'Farmer recommendation queued in local language (WhatsApp).',
        `Follow-up reminder scheduled for Day ${draft.followUpDays ?? 7}.`,
        'Compatibility & weather advisory attached.',
        'Safety validation recorded.',
        commitResult.result.knowledgeCandidateId
          ? 'Knowledge candidate submitted for expert review.'
          : 'Learning candidate queued.',
        'Case analytics updated.',
        'Opening next pending case…',
      ]);
      await onReload();
      setTimeout(() => {
        void openNextCase(detail.nextCaseId);
      }, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not commit review');
    } finally {
      setBusy('');
    }
  }

  const approve = async () => {
    if (!leaseToken || busy) return;
    if (!safety || safety.decision !== 'PASS') {
      await runSafetyCheck();
      return;
    }
    if (!safetyConfirmed) {
      setSafetyConfirmed(true);
      return;
    }
    await commit();
  };

  function renderItem({ item }: { item: ChatListItem }) {
    if (item.kind === 'assigned') {
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <Text style={styles.assistantLabel}>AI Copilot</Text>
          <Text style={styles.cardTitle}>📥 New Case Assigned</Text>
          <Text style={styles.contextLine}>
            Case ID: {(briefing?.caseCode || caseId.slice(0, 8)).toUpperCase()}
          </Text>
          <Text style={styles.contextLine}>
            Priority: {priorityLabel(detail.expertCase.priority)}
          </Text>
          <Text style={styles.contextLine}>
            Farmer: {briefing?.farmerName || 'Farmer'}
          </Text>
          <Text style={styles.contextLine}>
            Crop: {briefing?.cropType || detail.expertCase.crop_type || '—'}
          </Text>
          {briefing?.growthStage ? (
            <Text style={styles.contextLine}>Growth Stage: {briefing.growthStage}</Text>
          ) : null}
          <Text style={styles.timestamp}>{formatTime(detail.expertCase.opened_at)}</Text>
        </View>
      );
    }

    if (item.kind === 'summary') {
      const images = briefing?.images ?? [];
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <SectionTitle>Case Summary</SectionTitle>
          <Text style={styles.contextLine}>
            📷 Images · {briefing?.imageCount || images.length || 0} uploaded
          </Text>
          {images.length ? (
            <View style={styles.mediaRow}>
              {images.slice(0, 6).map((img) => (
                <View key={img.url} style={styles.mediaThumbWrap}>
                  <Image source={{ uri: img.url }} style={styles.mediaThumb} />
                  {img.label ? <Text style={styles.mediaLabel}>{img.label}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          <SectionTitle>🌦 Weather</SectionTitle>
          {briefing?.weather?.rainfall7dMm != null ? (
            <Text style={styles.contextLine}>
              Rainfall (7 Days): {briefing.weather.rainfall7dMm} mm
            </Text>
          ) : null}
          {briefing?.weather?.humidityPct != null ? (
            <Text style={styles.contextLine}>Humidity: {briefing.weather.humidityPct}%</Text>
          ) : null}
          {briefing?.weather?.temperatureC != null ? (
            <Text style={styles.contextLine}>
              Temperature: {briefing.weather.temperatureC}°C
            </Text>
          ) : null}
          {briefing?.weather?.summary ? (
            <Text style={styles.contextLine}>{briefing.weather.summary}</Text>
          ) : !briefing?.weather ? (
            <Text style={styles.contextLine}>Weather context pending</Text>
          ) : null}

          <SectionTitle>🧪 Soil Report</SectionTitle>
          <Text style={styles.contextLine}>pH: {briefing?.soil?.ph ?? 'Pending'}</Text>
          <Text style={styles.contextLine}>EC: {briefing?.soil?.ec ?? 'Pending'}</Text>

          {(briefing?.previousActivities?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>Previous Activities</SectionTitle>
              {briefing!.previousActivities!.map((act) => (
                <Text key={act} style={styles.contextLine}>
                  • {act}
                </Text>
              ))}
            </>
          ) : null}

          <SectionTitle>AI Initial Diagnosis</SectionTitle>
          <View style={styles.diagRow}>
            <Text style={styles.diagPrimary}>
              {briefing?.primaryDiagnosis || detail.expertCase.primary_issue_label || 'Pending'}
            </Text>
            {confidencePct(briefing?.primaryConfidence) ? (
              <View style={styles.confidencePill}>
                <Text style={styles.confidenceText}>
                  {confidencePct(briefing?.primaryConfidence)}
                </Text>
              </View>
            ) : null}
          </View>
          {briefing?.alternativeDiagnosis ? (
            <Text style={styles.cardMeta}>
              Alternative · {briefing.alternativeDiagnosis}
              {confidencePct(briefing.alternativeConfidence)
                ? ` (${confidencePct(briefing.alternativeConfidence)})`
                : ''}
            </Text>
          ) : null}
          {briefing?.confidenceBand ? (
            <Text style={styles.cardMeta}>Confidence · {briefing.confidenceBand}</Text>
          ) : null}
          <Text style={styles.cardHint}>Reply in chat — e.g. “Open all images”.</Text>
        </View>
      );
    }

    if (item.kind === 'image_analysis' && draft.imageAnalysis) {
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <SectionTitle>AI Image Analysis</SectionTitle>
          <Text style={styles.contextLine}>Detected</Text>
          {(draft.imageAnalysis.findings ?? []).map((f) => (
            <CheckLine key={f} text={f} />
          ))}
          {draft.imageAnalysis.annotated ? (
            <Text style={styles.cardMeta}>AI Overlay Enabled — disease regions highlighted.</Text>
          ) : draft.imageAnalysis.offerAnnotate ? (
            <Text style={styles.cardHint}>Would you like AI annotated images?</Text>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'turn') {
      const turn = turns.find((t) => t.id === item.turnId);
      if (!turn) return null;
      const mine = turn.role === 'agronomist';
      return (
        <View style={[styles.bubble, mine ? styles.mineBubble : styles.assistantBubble]}>
          {!mine ? (
            <Text style={styles.assistantLabel}>
              {turn.role === 'assistant'
                ? 'AI Copilot'
                : turn.role === 'farmer'
                  ? 'Farmer'
                  : turn.role}
            </Text>
          ) : null}
          <Text style={[styles.bubbleText, mine && styles.mineText]}>{turn.content}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.timestamp, mine && styles.mineMeta]}>
              {formatTime(turn.created_at)}
            </Text>
            {mine ? <Text style={styles.readReceipt}>✓✓</Text> : null}
          </View>
        </View>
      );
    }

    if (item.kind === 'preview') {
      const checklist = draftValidationChecklist(draft);
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <Text style={styles.cardTitle}>📋 Structured Preview</Text>

          <SectionTitle>Diagnosis</SectionTitle>
          <PreviewRow
            label="Primary"
            value={`${draft.diagnosis || '—'} ${confidencePct(draft.confidence) ?? ''}`.trim()}
          />
          {draft.secondaryDiagnosis ? (
            <PreviewRow
              label="Secondary"
              value={`${draft.secondaryDiagnosis} ${confidencePct(draft.secondaryConfidence) ?? ''}`.trim()}
            />
          ) : null}
          {draft.severity ? <PreviewRow label="Severity" value={draft.severity} /> : null}

          {(draft.evidence?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>Evidence</SectionTitle>
              {draft.evidence!.map((e) => (
                <CheckLine key={e} text={e} />
              ))}
            </>
          ) : null}

          {(draft.rootCauses?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>Root Cause</SectionTitle>
              {draft.rootCauses!.map((r) => (
                <Text key={r} style={styles.contextLine}>
                  • {r}
                </Text>
              ))}
            </>
          ) : null}

          <SectionTitle>Treatment</SectionTitle>
          <PreviewRow
            label="Product"
            value={draft.treatmentProduct || draft.recommendationText || '—'}
            wide
          />
          <PreviewRow
            label="Dose"
            value={
              draft.dosageSource === 'label'
                ? `Registered · ${draft.dosage || 'label dose'}`
                : draft.dosage || '⚠ Label dose pending'
            }
          />
          <PreviewRow label="Method" value={draft.applicationMethod || '—'} />
          <PreviewRow label="Timing" value={draft.applicationTiming || '—'} />

          {draft.nutritionProduct ? (
            <>
              <SectionTitle>Nutrition</SectionTitle>
              <PreviewRow label="Product" value={draft.nutritionProduct} />
              <PreviewRow label="Dose" value={draft.nutritionDose || '—'} />
              <PreviewRow label="Timing" value={draft.nutritionTiming || '—'} />
            </>
          ) : null}

          {(draft.culturalPractices?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>Cultural Practice</SectionTitle>
              {draft.culturalPractices!.map((c) => (
                <Text key={c} style={styles.contextLine}>
                  • {c}
                </Text>
              ))}
            </>
          ) : null}

          <SectionTitle>Follow-up</SectionTitle>
          <PreviewRow
            label="Days"
            value={draft.followUpDays != null ? `${draft.followUpDays} days` : '—'}
          />
          {(draft.farmerTasks?.length ?? 0) > 0 ? (
            <>
              {draft.farmerTasks!.map((t) => (
                <Text key={t} style={styles.contextLine}>
                  • {t}
                </Text>
              ))}
            </>
          ) : null}

          {(draft.precautions?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>Precaution</SectionTitle>
              {draft.precautions!.map((p) => (
                <Text key={p} style={styles.contextLine}>
                  • {p}
                </Text>
              ))}
            </>
          ) : null}

          {draft.knowledgeCandidate ? (
            <>
              <SectionTitle>Knowledge Candidate</SectionTitle>
              <Text style={styles.contextLine}>YES</Text>
              {draft.knowledgeCandidateReason ? (
                <Text style={styles.cardMeta}>{draft.knowledgeCandidateReason}</Text>
              ) : null}
            </>
          ) : null}

          {checklist.length ? (
            <>
              <SectionTitle>AI Validation</SectionTitle>
              {checklist.map((c) => (
                <CheckLine key={c} text={c} />
              ))}
            </>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'validations' && draft.validations) {
      const v = draft.validations;
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <Text style={styles.cardTitle}>Running automatic validations…</Text>

          {(v.compatibility?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>Compatibility Check</SectionTitle>
              {v.compatibility!.map((row) => (
                <Text key={row.product} style={styles.contextLine}>
                  {row.status === 'fail' ? '❌' : row.status === 'separate' ? '↔' : '✓'}{' '}
                  {row.product}
                  {row.note ? ` · ${row.note}` : ''}
                </Text>
              ))}
            </>
          ) : null}

          {v.weather ? (
            <>
              <SectionTitle>Weather Validation</SectionTitle>
              {v.weather.forecast ? (
                <Text style={styles.contextLine}>Forecast · {v.weather.forecast}</Text>
              ) : null}
              {v.weather.recommendation ? (
                <Text style={styles.contextLine}>
                  Recommendation · {v.weather.recommendation}
                </Text>
              ) : null}
              {v.weather.wind ? (
                <Text style={styles.contextLine}>Wind · {v.weather.wind}</Text>
              ) : null}
              {v.weather.humidity ? (
                <Text style={styles.contextLine}>Humidity · {v.weather.humidity}</Text>
              ) : null}
            </>
          ) : null}

          {v.dosage ? (
            <>
              <SectionTitle>Dosage Validation</SectionTitle>
              <Text style={styles.contextLine}>{v.dosage.message || v.dosage.status}</Text>
              {v.dosage.askLabelDose ? (
                <Text style={styles.cardHint}>Reply Yes to apply registered label dosage.</Text>
              ) : null}
            </>
          ) : null}

          {v.frac ? (
            <>
              <SectionTitle>Resistance Management</SectionTitle>
              <Text style={styles.contextLine}>
                Previous · {v.frac.previousSpray}
                {v.frac.daysAgo != null ? ` · ${v.frac.daysAgo} days ago` : ''}
              </Text>
              <Text style={styles.contextLine}>
                FRAC · {v.frac.rotationOk ? 'Different MoA ✓' : 'Review needed'} · Risk{' '}
                {v.frac.risk || '—'}
              </Text>
            </>
          ) : null}

          {v.phytotoxicity ? (
            <>
              <SectionTitle>Phytotoxicity</SectionTitle>
              <Text style={styles.contextLine}>Risk · {v.phytotoxicity.risk || '—'}</Text>
            </>
          ) : null}

          {v.safety ? (
            <>
              <SectionTitle>Safety Validation</SectionTitle>
              {v.safety.ppe ? <CheckLine text="PPE Required" /> : null}
              {v.safety.reiHours != null ? (
                <CheckLine text={`Re-entry Interval · ${v.safety.reiHours} Hours`} />
              ) : null}
              {v.safety.phiRecorded ? <CheckLine text="Harvest Interval · Recorded" /> : null}
            </>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'missing') {
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <SectionTitle>Missing Information</SectionTitle>
          <Text style={styles.contextLine}>I still need these details.</Text>
          {(draft.farmerQuestions ?? []).map((q, i) => (
            <Text key={q} style={styles.contextLine}>
              {i + 1}. {q}
            </Text>
          ))}
          {draft.farmerQuestionsSent ? (
            <Text style={styles.cardMeta}>Questions sent to farmer.</Text>
          ) : (
            <Text style={styles.cardHint}>Reply “Yes” to send these questions to the farmer.</Text>
          )}
          {draft.farmerAnswers ? (
            <>
              <SectionTitle>Farmer replies</SectionTitle>
              {Object.entries(draft.farmerAnswers).map(([k, v]) => (
                <Text key={k} style={styles.contextLine}>
                  {k}: {v}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'safety' && safety) {
      const issues = [...(safety.blockers ?? []), ...(safety.warnings ?? [])];
      return (
        <View
          style={[
            styles.bubble,
            styles.assistantBubble,
            styles.cardBubble,
            safety.decision === 'PASS' ? styles.safetyPass : styles.safetyStop,
          ]}
        >
          <Text style={styles.cardTitle}>Safety gate · {safety.decision}</Text>
          {issues.length === 0 ? (
            <Text style={styles.bubbleText}>No blockers. Confirm below to approve the case.</Text>
          ) : (
            issues.map((issue, index) => (
              <Text key={`${issue.code}-${index}`} style={styles.bubbleText}>
                • {issue.message ?? issue.code ?? 'Review required'}
              </Text>
            ))
          )}
          {safety.decision === 'PASS' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: safetyConfirmed }}
              onPress={() => setSafetyConfirmed((v) => !v)}
              style={styles.confirmRow}
            >
              <View style={[styles.checkbox, safetyConfirmed && styles.checkboxChecked]}>
                <Text style={styles.checkmark}>{safetyConfirmed ? '✓' : ''}</Text>
              </View>
              <Text style={styles.confirmText}>
                I reviewed diagnosis, dosage, validations, and farmer instructions.
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'approved' && approvedActions) {
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble, styles.safetyPass]}>
          <Text style={styles.cardTitle}>✅ Case Approved Successfully</Text>
          <SectionTitle>Actions Completed Automatically</SectionTitle>
          {approvedActions.map((a) => (
            <Text key={a} style={styles.contextLine}>
              • {a}
            </Text>
          ))}
        </View>
      );
    }

    return null;
  }

  const farmerLabel = briefing?.farmerName || 'Farmer';
  const createdLabel = detail.expertCase.opened_at
    ? formatDate(detail.expertCase.opened_at)
    : '—';
  const priority = detail.expertCase.priority;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        <View style={styles.priorityRow}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor(priority) }]} />
          <Text style={styles.headerPriority}>
            Priority: {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Text>
        </View>
        <Text style={styles.headerMeta} numberOfLines={1}>
          Farmer: {farmerLabel}
          {detail.expertCase.crop_type ? ` · ${detail.expertCase.crop_type}` : ''}
        </Text>
        <Text style={styles.headerMeta}>Created: {createdLabel}</Text>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <AlertBox>{error}</AlertBox>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={listItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={styles.composerShell}>
        <View style={styles.quickRow}>
          {detail.expertCase.queue_route === 'field' &&
          detail.links.some((link) => link.link_type === 'escalation' && link.entity_id) ? (
            <Pressable
              style={styles.quickChip}
              onPress={() => {
                const link = detail.links.find(
                  (row) => row.link_type === 'escalation' && row.entity_id
                );
                if (link?.entity_id) {
                  void openEscalationVisit(String(link.entity_id), { router }).catch((e) =>
                    setError(e instanceof Error ? e.message : 'Could not open site visit')
                  );
                }
              }}
            >
              <Text style={styles.quickChipText}>Site visit</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.quickChip}
            onPress={() => {
              setMessage('Open all images');
            }}
          >
            <Text style={styles.quickChipText}>Images</Text>
          </Pressable>
          {leaseToken && canWrite ? (
            <Pressable
              style={styles.quickChip}
              onPress={() => void runSafetyCheck()}
              disabled={Boolean(busy)}
            >
              <Text style={styles.quickChipText}>
                {busy === 'safety' ? 'Checking…' : 'Safety'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!leaseToken && canWrite ? (
          <Pressable
            style={[styles.approveBtn, busy === 'claim' && styles.approveBtnDisabled]}
            onPress={() => void claim()}
            disabled={Boolean(busy)}
          >
            {busy === 'claim' ? (
              <ActivityIndicator color={tokens.textOnPrimary} />
            ) : (
              <Text style={styles.approveBtnText}>Claim case to chat</Text>
            )}
          </Pressable>
        ) : null}

        {leaseToken && canWrite && !approvedActions ? (
          <>
            <View style={styles.composerRow}>
              <TextInput
                style={styles.composerInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Type expert note or Yes / Approve"
                placeholderTextColor={tokens.textMuted}
                multiline
                maxLength={4000}
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  (!message.trim() || Boolean(busy)) && styles.sendBtnDisabled,
                ]}
                onPress={() => void sendMessage()}
                disabled={!message.trim() || Boolean(busy)}
              >
                {busy === 'chat' ? (
                  <ActivityIndicator color={tokens.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.sendBtnText}>➤</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              style={[styles.approveBtn, Boolean(busy) && styles.approveBtnDisabled]}
              onPress={() => void approve()}
              disabled={Boolean(busy)}
            >
              {busy === 'commit' || busy === 'safety' ? (
                <ActivityIndicator color={tokens.textOnPrimary} />
              ) : (
                <Text style={styles.approveBtnText}>
                  {!safety || safety.decision !== 'PASS'
                    ? 'Validate & continue'
                    : !safetyConfirmed
                      ? 'Confirm review'
                      : 'Approve & next case'}
                </Text>
              )}
            </Pressable>
          </>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e8efe9' },
  header: {
    backgroundColor: tokens.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
    gap: 2,
  },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  headerPriority: { fontSize: 13, fontWeight: '700', color: tokens.text },
  headerMeta: { fontSize: 12, color: tokens.textSecondary },
  errorWrap: { paddingHorizontal: 12, paddingTop: 8 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 20, gap: 8 },
  bubble: {
    maxWidth: '88%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    ...shadow.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.card,
    borderTopLeftRadius: 4,
  },
  mineBubble: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.green100,
    borderTopRightRadius: 4,
  },
  cardBubble: { maxWidth: '96%', paddingBottom: 12 },
  assistantLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.green700,
    marginBottom: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20, color: tokens.text },
  mineText: { color: tokens.text },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  timestamp: { fontSize: 10, color: tokens.textMuted, alignSelf: 'flex-end', marginTop: 4 },
  mineMeta: { color: tokens.textMuted },
  readReceipt: { fontSize: 11, color: tokens.info, marginTop: 2 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.green800,
    marginTop: 10,
    marginBottom: 4,
  },
  diagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  diagPrimary: { fontSize: 16, fontWeight: '700', color: tokens.text, flexShrink: 1 },
  confidencePill: {
    backgroundColor: tokens.green50,
    borderWidth: 1,
    borderColor: tokens.green200,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceText: { fontSize: 11, fontWeight: '700', color: tokens.green800 },
  cardMeta: { marginTop: 6, fontSize: 12, color: tokens.textSecondary },
  cardHint: { marginTop: 8, fontSize: 12, color: tokens.textMuted, fontStyle: 'italic' },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  mediaThumbWrap: { width: 72 },
  mediaThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: tokens.bgSubtle },
  mediaLabel: { fontSize: 9, color: tokens.textMuted, marginTop: 3 },
  contextLine: { fontSize: 13, color: tokens.textSecondary, lineHeight: 20, marginBottom: 2 },
  checkLine: { fontSize: 13, color: tokens.text, lineHeight: 20, marginBottom: 2 },
  previewCell: { marginBottom: 6 },
  previewCellWide: { width: '100%' },
  previewLabel: { fontSize: 11, color: tokens.textMuted, marginBottom: 2 },
  previewValue: { fontSize: 13, color: tokens.text, fontWeight: '600' },
  safetyPass: { borderWidth: 1, borderColor: tokens.success },
  safetyStop: { borderWidth: 1, borderColor: tokens.warning },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: tokens.green700, borderColor: tokens.green700 },
  checkmark: { color: tokens.textOnPrimary, fontWeight: '700', fontSize: 12 },
  confirmText: { flex: 1, fontSize: 12, lineHeight: 18, color: tokens.text },
  composerShell: {
    backgroundColor: tokens.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 10,
    gap: 8,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.cardMuted,
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: tokens.textSecondary },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.text,
    backgroundColor: tokens.bg,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: tokens.green700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: tokens.textOnPrimary, fontSize: 18, fontWeight: '700' },
  approveBtn: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  approveBtnDisabled: { opacity: 0.55 },
  approveBtnText: { color: tokens.textOnPrimary, fontSize: 15, fontWeight: '700' },
});
