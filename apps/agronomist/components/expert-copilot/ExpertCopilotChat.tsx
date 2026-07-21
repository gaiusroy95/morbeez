import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
  type ExpertCaseNavigation,
  type ExpertCaseSafetyDecision,
} from '@morbeez/shared';
import { AlertBox } from '@morbeez/ui-native';
import { openEscalationVisit } from '@/lib/open-escalation-visit';
import { canCommitExpertDraft } from '@/lib/expert-copilot';
import { useLocale, useT } from '@/context/LocaleContext';

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

function SectionTitle({ children }: { children: ReactNode }) {
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
  const { locale } = useLocale();
  const t = useT();
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
  const [caseNavigation, setCaseNavigation] = useState<ExpertCaseNavigation | null>(
    initialDetail.caseNavigation ?? null
  );
  const [showCaseList, setShowCaseList] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
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
    if (initialDetail.caseNavigation) setCaseNavigation(initialDetail.caseNavigation);
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

  const caseImages = useMemo(() => {
    if (draft.imageAnalysis?.images?.length) return draft.imageAnalysis.images;
    if (draft.imageAnalysis?.imagesOpened && briefing?.images?.length) return briefing.images;
    return [];
  }, [briefing?.images, draft.imageAnalysis?.images, draft.imageAnalysis?.imagesOpened]);

  const hasPreview = Boolean(
    draft.diagnosis ||
      draft.treatmentProduct ||
      draft.recommendationText ||
      draft.dosage ||
      (draft.treatmentActivities?.length ?? 0) > 0 ||
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
      if (next.caseNavigation) setCaseNavigation(next.caseNavigation);
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
      const result = await agronomistClient.postExpertCaseChat(
        caseId,
        content,
        leaseToken,
        locale
      );
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
      if (result.navigation?.caseNavigation) {
        setCaseNavigation(result.navigation.caseNavigation);
      }
      if (result.navigation?.targetCaseId) {
        setTimeout(() => {
          void openCase(result.navigation!.targetCaseId!);
        }, 600);
      }
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

  async function openCase(targetId: string) {
    if (!targetId || targetId === caseId) return;
    router.replace(`/case/${targetId}`);
  }

  async function sendNavMessage(text: string) {
    if (!leaseToken || busy) {
      setMessage(text);
      return;
    }
    setBusy('chat');
    setError('');
    try {
      const result = await agronomistClient.postExpertCaseChat(
        caseId,
        text,
        leaseToken,
        locale
      );
      setDetail((current) => ({
        ...current,
        turns: [...current.turns, result.agronomistTurn, result.assistantTurn],
      }));
      setMessage('');
      if (result.navigation?.caseNavigation) {
        setCaseNavigation(result.navigation.caseNavigation);
      }
      if (result.navigation?.targetCaseId) {
        setTimeout(() => {
          void openCase(result.navigation!.targetCaseId!);
        }, 600);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setBusy('');
    }
  }

  async function openPreviousCase() {
    const target = caseNavigation?.previousCaseId ?? detail.previousCaseId;
    if (target) {
      await openCase(target);
      return;
    }
    await sendNavMessage('previous case');
  }

  async function openNextCase(preferredId?: string | null) {
    const target =
      preferredId ?? caseNavigation?.nextCaseId ?? detail.nextCaseId ?? null;
    if (target) {
      await openCase(target);
      return;
    }
    if (!preferredId) {
      await sendNavMessage('next case');
      return;
    }
    try {
      const queue = await agronomistClient.getExpertCaseQueue();
      const next =
        queue.buckets.my_work.find((row) => row.id !== caseId) ??
        queue.buckets.available.find((row) => row.id !== caseId) ??
        null;
      if (next) {
        await openCase(next.id);
        return;
      }
      router.back();
    } catch {
      router.back();
    }
  }

  async function listCases() {
    setShowCaseList(true);
    if (leaseToken && !busy) {
      await sendNavMessage('list cases');
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
        t('ecActionFarmerWhatsApp'),
        t('ecActionFollowUp').replace('{days}', String(draft.followUpDays ?? 7)),
        t('ecActionCompatWeather'),
        t('ecActionSafety'),
        commitResult.result.knowledgeCandidateId
          ? t('ecActionKnowledge')
          : t('ecActionLearning'),
        t('ecActionAnalytics'),
        t('ecActionNextCase'),
      ]);
      await onReload();
      setTimeout(() => {
        void openNextCase(
          caseNavigation?.nextCaseId ?? detail.nextCaseId ?? detail.caseNavigation?.nextCaseId
        );
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
          <Text style={styles.assistantLabel}>{t('ecAiCopilot')}</Text>
          <Text style={styles.cardTitle}>📥 {t('ecNewCaseAssigned')}</Text>
          <Text style={styles.contextLine}>
            {t('ecCaseId')}: {(briefing?.caseCode || caseId.slice(0, 8)).toUpperCase()}
          </Text>
          <Text style={styles.contextLine}>
            {t('ecPriority')}: {priorityLabel(detail.expertCase.priority)}
          </Text>
          <Text style={styles.contextLine}>
            {t('ecFarmer')}: {briefing?.farmerName || t('ecFarmer')}
          </Text>
          <Text style={styles.contextLine}>
            {t('ecCrop')}: {briefing?.cropType || detail.expertCase.crop_type || '—'}
          </Text>
          {briefing?.growthStage ? (
            <Text style={styles.contextLine}>
              {t('ecGrowthStage')}: {briefing.growthStage}
            </Text>
          ) : null}
          <Text style={styles.timestamp}>{formatTime(detail.expertCase.opened_at)}</Text>
        </View>
      );
    }

    if (item.kind === 'summary') {
      const images = briefing?.images ?? [];
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <SectionTitle>{t('ecCaseSummary')}</SectionTitle>
          <Text style={styles.contextLine}>
            📷 {t('ecImages')} · {briefing?.imageCount || images.length || 0} {t('ecUploaded')}
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

          <SectionTitle>🌦 {t('ecWeather')}</SectionTitle>
          {briefing?.weather?.rainfall7dMm != null ? (
            <Text style={styles.contextLine}>
              {t('ecRainfall7d')}: {briefing.weather.rainfall7dMm} mm
            </Text>
          ) : null}
          {briefing?.weather?.humidityPct != null ? (
            <Text style={styles.contextLine}>
              {t('ecHumidity')}: {briefing.weather.humidityPct}%
            </Text>
          ) : null}
          {briefing?.weather?.temperatureC != null ? (
            <Text style={styles.contextLine}>
              {t('ecTemperature')}: {briefing.weather.temperatureC}°C
            </Text>
          ) : null}
          {briefing?.weather?.summary ? (
            <Text style={styles.contextLine}>{briefing.weather.summary}</Text>
          ) : !briefing?.weather ? (
            <Text style={styles.contextLine}>{t('ecWeatherPending')}</Text>
          ) : null}

          <SectionTitle>🧪 {t('ecSoilReport')}</SectionTitle>
          <Text style={styles.contextLine}>
            pH: {briefing?.soil?.ph ?? t('ecPending')}
          </Text>
          <Text style={styles.contextLine}>
            EC: {briefing?.soil?.ec ?? t('ecPending')}
          </Text>

          {(briefing?.previousActivities?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('ecPreviousActivities')}</SectionTitle>
              {briefing!.previousActivities!.map((act) => (
                <Text key={act} style={styles.contextLine}>
                  • {act}
                </Text>
              ))}
            </>
          ) : null}

          <SectionTitle>{t('ecAiInitialDiagnosis')}</SectionTitle>
          <View style={styles.diagRow}>
            <Text style={styles.diagPrimary}>
              {briefing?.primaryDiagnosis ||
                detail.expertCase.primary_issue_label ||
                t('ecPending')}
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
              {t('ecAlternative')} · {briefing.alternativeDiagnosis}
              {confidencePct(briefing.alternativeConfidence)
                ? ` (${confidencePct(briefing.alternativeConfidence)})`
                : ''}
            </Text>
          ) : null}
          {briefing?.confidenceBand ? (
            <Text style={styles.cardMeta}>
              {t('ecConfidence')} · {briefing.confidenceBand}
            </Text>
          ) : null}
          <Text style={styles.cardHint}>{t('ecOpenImagesHint')}</Text>
        </View>
      );
    }

    if (item.kind === 'image_analysis' && draft.imageAnalysis) {
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <SectionTitle>{t('ecAiImageAnalysis')}</SectionTitle>
          {caseImages.length > 0 ? (
            <>
              <Text style={styles.cardMeta}>
                {caseImages.length} {t('ecImages')} · {t('ecTapToView')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageStrip}>
                {caseImages.map((img) => (
                  <Pressable
                    key={img.url}
                    onPress={() => setSelectedImageUrl(img.url)}
                    style={styles.imageThumbWrap}
                  >
                    <Image source={{ uri: img.url }} style={styles.imageThumb} resizeMode="cover" />
                    {img.label ? <Text style={styles.imageThumbLabel}>{img.label}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
          <Text style={styles.contextLine}>{t('ecDetected')}</Text>
          {(draft.imageAnalysis.findings ?? []).map((f) => (
            <CheckLine key={f} text={f} />
          ))}
          {draft.imageAnalysis.annotated ? (
            <Text style={styles.cardMeta}>{t('ecOverlayEnabled')}</Text>
          ) : draft.imageAnalysis.offerAnnotate ? (
            <Text style={styles.cardHint}>{t('ecWantAnnotated')}</Text>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'turn') {
      const turn = turns.find((row) => row.id === item.turnId);
      if (!turn) return null;
      const mine = turn.role === 'agronomist';
      return (
        <View style={[styles.bubble, mine ? styles.mineBubble : styles.assistantBubble]}>
          {!mine ? (
            <Text style={styles.assistantLabel}>
              {turn.role === 'assistant'
                ? t('ecAiCopilot')
                : turn.role === 'farmer'
                  ? t('ecFarmer')
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
          <Text style={styles.cardTitle}>📋 {t('ecStructuredPreview')}</Text>

          <SectionTitle>{t('ecDiagnosis')}</SectionTitle>
          <PreviewRow
            label={t('ecPrimary')}
            value={`${draft.diagnosis || '—'} ${confidencePct(draft.confidence) ?? ''}`.trim()}
          />
          {draft.secondaryDiagnosis ? (
            <PreviewRow
              label={t('ecSecondary')}
              value={`${draft.secondaryDiagnosis} ${confidencePct(draft.secondaryConfidence) ?? ''}`.trim()}
            />
          ) : null}
          {draft.severity ? (
            <PreviewRow label={t('ecSeverity')} value={draft.severity} />
          ) : null}

          {(draft.evidence?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('ecEvidence')}</SectionTitle>
              {draft.evidence!.map((e) => (
                <CheckLine key={e} text={e} />
              ))}
            </>
          ) : null}

          {(draft.rootCauses?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('ecRootCause')}</SectionTitle>
              {draft.rootCauses!.map((r) => (
                <Text key={r} style={styles.contextLine}>
                  • {r}
                </Text>
              ))}
            </>
          ) : null}

          <SectionTitle>{t('ecTreatment')}</SectionTitle>
          {(draft.treatmentActivities?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('ecActivities')}</SectionTitle>
              {draft.treatmentActivities!.map((activity, index) => (
                <View key={`${activity.method}-${activity.product}-${index}`} style={styles.activityCard}>
                  <PreviewRow label={t('ecMethod')} value={activity.method || '—'} />
                  <PreviewRow label={t('ecProduct')} value={activity.product || '—'} wide />
                  <PreviewRow label={t('ecDose')} value={activity.dose || '—'} />
                  {activity.dilutionVolumeL != null ? (
                    <PreviewRow
                      label={t('ecSprayVolume')}
                      value={`${activity.dilutionVolumeL} L`}
                    />
                  ) : null}
                  {activity.interval ? (
                    <PreviewRow label={t('ecTiming')} value={`Every ${activity.interval}`} />
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
          <PreviewRow
            label={t('ecProduct')}
            value={draft.treatmentProduct || draft.recommendationText || '—'}
            wide
          />
          <PreviewRow
            label={t('ecDose')}
            value={
              draft.dosageSource === 'label'
                ? `${t('ecRegistered')} · ${draft.dosage || 'label dose'}`
                : draft.dosage || `⚠ ${t('ecLabelDosePending')}`
            }
          />
          {draft.sprayVolumeL != null || draft.dilutionNotes ? (
            <PreviewRow
              label={t('ecDilution')}
              value={
                draft.sprayVolumeL != null
                  ? `${draft.sprayVolumeL} L`
                  : draft.dilutionNotes || '—'
              }
            />
          ) : null}
          <PreviewRow label={t('ecMethod')} value={draft.applicationMethod || '—'} />
          <PreviewRow label={t('ecTiming')} value={draft.applicationTiming || '—'} />

          {draft.nutritionProduct ? (
            <>
              <SectionTitle>{t('ecNutrition')}</SectionTitle>
              <PreviewRow label={t('ecProduct')} value={draft.nutritionProduct} />
              <PreviewRow label={t('ecDose')} value={draft.nutritionDose || '—'} />
              <PreviewRow label={t('ecTiming')} value={draft.nutritionTiming || '—'} />
            </>
          ) : null}

          {(draft.culturalPractices?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('ecCulturalPractice')}</SectionTitle>
              {draft.culturalPractices!.map((c) => (
                <Text key={c} style={styles.contextLine}>
                  • {c}
                </Text>
              ))}
            </>
          ) : null}

          <SectionTitle>{t('ecFollowUp')}</SectionTitle>
          <PreviewRow
            label={t('ecDays')}
            value={draft.followUpDays != null ? `${draft.followUpDays}` : '—'}
          />
          {(draft.farmerTasks?.length ?? 0) > 0 ? (
            <>
              {draft.farmerTasks!.map((task) => (
                <Text key={task} style={styles.contextLine}>
                  • {task}
                </Text>
              ))}
            </>
          ) : null}

          {(draft.precautions?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('ecPrecaution')}</SectionTitle>
              {draft.precautions!.map((p) => (
                <Text key={p} style={styles.contextLine}>
                  • {p}
                </Text>
              ))}
            </>
          ) : null}

          {draft.knowledgeCandidate ? (
            <>
              <SectionTitle>{t('ecKnowledgeCandidate')}</SectionTitle>
              <Text style={styles.contextLine}>{t('ecYes')}</Text>
              {draft.knowledgeCandidateReason ? (
                <Text style={styles.cardMeta}>{draft.knowledgeCandidateReason}</Text>
              ) : null}
            </>
          ) : null}

          {checklist.length ? (
            <>
              <SectionTitle>{t('ecAiValidation')}</SectionTitle>
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
          <Text style={styles.cardTitle}>{t('ecRunningValidations')}</Text>

          {(v.compatibility?.length ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('ecCompatibilityCheck')}</SectionTitle>
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
              <SectionTitle>{t('ecWeatherValidation')}</SectionTitle>
              {v.weather.forecast ? (
                <Text style={styles.contextLine}>
                  {t('ecForecast')} · {v.weather.forecast}
                </Text>
              ) : null}
              {v.weather.recommendation ? (
                <Text style={styles.contextLine}>
                  {t('ecRecommendation')} · {v.weather.recommendation}
                </Text>
              ) : null}
              {v.weather.wind ? (
                <Text style={styles.contextLine}>
                  {t('ecWind')} · {v.weather.wind}
                </Text>
              ) : null}
              {v.weather.humidity ? (
                <Text style={styles.contextLine}>
                  {t('ecHumidity')} · {v.weather.humidity}
                </Text>
              ) : null}
            </>
          ) : null}

          {v.dosage ? (
            <>
              <SectionTitle>{t('ecDosageValidation')}</SectionTitle>
              <Text style={styles.contextLine}>{v.dosage.message || v.dosage.status}</Text>
              {v.dosage.askLabelDose ? (
                <Text style={styles.cardHint}>{t('ecReplyYesLabelDose')}</Text>
              ) : null}
            </>
          ) : null}

          {v.frac ? (
            <>
              <SectionTitle>{t('ecResistanceMgmt')}</SectionTitle>
              <Text style={styles.contextLine}>
                {t('ecPrevious')} · {v.frac.previousSpray}
                {v.frac.daysAgo != null ? ` · ${v.frac.daysAgo} ${t('ecDaysAgo')}` : ''}
              </Text>
              <Text style={styles.contextLine}>
                {t('ecFrac')} · {v.frac.rotationOk ? t('ecDifferentMoA') : t('ecReviewNeeded')} ·{' '}
                {t('ecRisk')} {v.frac.risk || '—'}
              </Text>
            </>
          ) : null}

          {v.phytotoxicity ? (
            <>
              <SectionTitle>{t('ecPhytotoxicity')}</SectionTitle>
              <Text style={styles.contextLine}>
                {t('ecRisk')} · {v.phytotoxicity.risk || '—'}
              </Text>
            </>
          ) : null}

          {v.safety ? (
            <>
              <SectionTitle>{t('ecSafetyValidation')}</SectionTitle>
              {v.safety.ppe ? <CheckLine text={t('ecPpeRequired')} /> : null}
              {v.safety.reiHours != null ? (
                <CheckLine
                  text={`${t('ecRei')} · ${v.safety.reiHours} ${t('ecHours')}`}
                />
              ) : null}
              {v.safety.phiRecorded ? (
                <CheckLine text={`${t('ecHarvestInterval')} · ${t('ecRecorded')}`} />
              ) : null}
            </>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'missing') {
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble]}>
          <SectionTitle>{t('ecMissingInfo')}</SectionTitle>
          <Text style={styles.contextLine}>{t('ecStillNeed')}</Text>
          {(draft.farmerQuestions ?? []).map((q, i) => (
            <Text key={q} style={styles.contextLine}>
              {i + 1}. {q}
            </Text>
          ))}
          {draft.farmerQuestionsSent ? (
            <Text style={styles.cardMeta}>{t('ecQuestionsSent')}</Text>
          ) : (
            <Text style={styles.cardHint}>{t('ecReplyYesSendQs')}</Text>
          )}
          {draft.farmerAnswers ? (
            <>
              <SectionTitle>{t('ecFarmerReplies')}</SectionTitle>
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
          <Text style={styles.cardTitle}>
            {t('ecSafetyGate')} · {safety.decision}
          </Text>
          {issues.length === 0 ? (
            <Text style={styles.bubbleText}>{t('ecNoBlockers')}</Text>
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
              <Text style={styles.confirmText}>{t('ecConfirmReviewCheck')}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'approved' && approvedActions) {
      return (
        <View style={[styles.bubble, styles.assistantBubble, styles.cardBubble, styles.safetyPass]}>
          <Text style={styles.cardTitle}>✅ {t('ecCaseApproved')}</Text>
          <SectionTitle>{t('ecActionsCompleted')}</SectionTitle>
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
  const navLabel =
    caseNavigation && caseNavigation.total > 0
      ? t('ecCaseNav')
          .replace('{current}', String(caseNavigation.currentIndex || '—'))
          .replace('{total}', String(caseNavigation.total))
      : null;

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
            {t('ecPriority')}: {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Text>
        </View>
        <Text style={styles.headerMeta} numberOfLines={1}>
          {t('ecFarmer')}: {farmerLabel}
          {detail.expertCase.crop_type ? ` · ${detail.expertCase.crop_type}` : ''}
        </Text>
        <Text style={styles.headerMeta}>
          {t('ecCreated')}: {createdLabel}
        </Text>
        {navLabel ? (
          <View style={styles.navRow}>
            <Pressable
              style={[
                styles.navBtn,
                !caseNavigation?.previousCaseId && styles.navBtnDisabled,
              ]}
              onPress={() => void openPreviousCase()}
              disabled={Boolean(busy)}
            >
              <Text style={styles.navBtnText}>‹ {t('ecPrevCase')}</Text>
            </Pressable>
            <Text style={styles.navCounter}>{navLabel}</Text>
            <Pressable
              style={[styles.navBtn, !caseNavigation?.nextCaseId && styles.navBtnDisabled]}
              onPress={() => void openNextCase()}
              disabled={Boolean(busy)}
            >
              <Text style={styles.navBtnText}>{t('ecNextCase')} ›</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable style={styles.listCasesBtn} onPress={() => void listCases()}>
          <Text style={styles.listCasesBtnText}>📋 {t('ecListCases')}</Text>
        </Pressable>
      </View>

      <Modal
        visible={showCaseList}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCaseList(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📋 {t('ecListCases')}</Text>
            {navLabel ? <Text style={styles.modalMeta}>{navLabel}</Text> : null}
            <ScrollView style={styles.modalList}>
              {(caseNavigation?.items ?? []).length === 0 ? (
                <Text style={styles.contextLine}>{t('ecNoCasesInQueue')}</Text>
              ) : (
                caseNavigation!.items.map((item, index) => {
                  const active = item.id === caseId;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.caseListRow, active && styles.caseListRowActive]}
                      onPress={() => {
                        setShowCaseList(false);
                        void openCase(item.id);
                      }}
                    >
                      <Text style={styles.caseListIndex}>{active ? '▶' : `${index + 1}.`}</Text>
                      <View style={styles.caseListBody}>
                        <Text style={styles.caseListTitle}>
                          {item.caseCode} · {item.farmerName || t('ecFarmer')}
                        </Text>
                        <Text style={styles.caseListMeta} numberOfLines={2}>
                          {[item.cropType, item.primaryIssue, item.priority]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      {!active ? (
                        <Text style={styles.caseListOpen}>{t('ecOpenCase')}</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setShowCaseList(false)}>
              <Text style={styles.modalCloseText}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedImageUrl)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedImageUrl(null)}
      >
        <Pressable style={styles.imageModalBackdrop} onPress={() => setSelectedImageUrl(null)}>
          {selectedImageUrl ? (
            <Image source={{ uri: selectedImageUrl }} style={styles.imageModalFull} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>

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
              <Text style={styles.quickChipText}>{t('ecSiteVisit')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.quickChip}
            onPress={() => {
              setMessage('Open all images');
            }}
          >
            <Text style={styles.quickChipText}>{t('ecImagesChip')}</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => void openPreviousCase()}
            disabled={Boolean(busy)}
          >
            <Text style={styles.quickChipText}>‹ {t('ecPrevCase')}</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => void listCases()}
            disabled={Boolean(busy)}
          >
            <Text style={styles.quickChipText}>{t('ecListCases')}</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => void openNextCase()}
            disabled={Boolean(busy)}
          >
            <Text style={styles.quickChipText}>{t('ecNextCase')} ›</Text>
          </Pressable>
          {leaseToken && canWrite ? (
            <Pressable
              style={styles.quickChip}
              onPress={() => void runSafetyCheck()}
              disabled={Boolean(busy)}
            >
              <Text style={styles.quickChipText}>
                {busy === 'safety' ? t('ecChecking') : t('ecSafetyChip')}
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
              <Text style={styles.approveBtnText}>{t('ecClaimToChat')}</Text>
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
                placeholder={t('ecComposerPlaceholder')}
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
                    ? t('ecValidateContinue')
                    : !safetyConfirmed
                      ? t('ecConfirmReviewBtn')
                      : t('ecApproveNext')}
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
  imageStrip: { marginBottom: 8 },
  imageThumbWrap: { width: 88, marginRight: 8 },
  imageThumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: tokens.bgSubtle },
  imageThumbLabel: { fontSize: 9, color: tokens.textMuted, marginTop: 4 },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imageModalFull: { width: '100%', height: '80%' },
  activityCard: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 10,
    marginBottom: 8,
    backgroundColor: tokens.bgSubtle,
  },
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 6,
  },
  navBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: tokens.cardMuted,
  },
  navBtnDisabled: { opacity: 0.45 },
  navBtnText: { fontSize: 11, fontWeight: '600', color: tokens.green800, textAlign: 'center' },
  navCounter: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.textSecondary,
    minWidth: 72,
    textAlign: 'center',
  },
  listCasesBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: tokens.green200,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.green50,
  },
  listCasesBtnText: { fontSize: 12, fontWeight: '700', color: tokens.green800 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '78%',
    backgroundColor: tokens.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  modalMeta: { fontSize: 12, color: tokens.textMuted, marginBottom: 12 },
  modalList: { maxHeight: 420 },
  caseListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  caseListRowActive: { backgroundColor: tokens.green50, borderRadius: tokens.radiusSm },
  caseListIndex: { width: 22, fontSize: 12, fontWeight: '700', color: tokens.green800 },
  caseListBody: { flex: 1 },
  caseListTitle: { fontSize: 14, fontWeight: '700', color: tokens.text },
  caseListMeta: { fontSize: 12, color: tokens.textSecondary, marginTop: 2 },
  caseListOpen: { fontSize: 12, fontWeight: '700', color: tokens.green700 },
  modalClose: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.cardMuted,
  },
  modalCloseText: { fontSize: 14, fontWeight: '600', color: tokens.textSecondary },
});
