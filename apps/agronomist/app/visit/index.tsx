import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  agronomistClient,
  blockAutoApprove,
  getNextWizardStep,
  getPrevWizardStep,
  getVisibleWizardSteps,
  normalizeVisitWizardStep,
  suggestNextCapturePhotoType,
  validateVisitWizardStep,
  mapRecommendationGroupsForSubmit,
  buildPriorRecommendationFollowUps,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type IssueCategory,
  type IssueMasterRow,
  type MeasurementTemplate,
  type MonitoringPlanPreviewItem,
  type PortalSoilReport,
  type RecommendationGroupDraft,
  type SoilMoistureLevel,
  type VisitFarmContext,
  type WhatsappPreviewMessage,
  type TriagePreview,
  type VisitClassification,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, Loading, StickyScreenFooter, useStickyFooterScrollPadding } from '@morbeez/ui-native';
import { type FollowUpDraft } from '@/components/field-findings/FollowUpSection';
import { type IssueDraft } from '@/components/field-findings/IssueCard';
import { VisitStepper, type VisitWizardStep } from '@/components/field-findings/VisitStepper';
import { VisitAgronomistReviewStep } from '@/components/field-findings/wizard/VisitAgronomistReviewStep';
import { VisitAdditionalPhotosStep } from '@/components/field-findings/wizard/VisitAdditionalPhotosStep';
import { VisitApplicationScheduleStep } from '@/components/field-findings/wizard/VisitApplicationScheduleStep';
import { VisitMonitoringPlanStep } from '@/components/field-findings/wizard/VisitMonitoringPlanStep';
import { VisitWhatsappPreviewStep } from '@/components/field-findings/wizard/VisitWhatsappPreviewStep';
import { VisitCaseClosureStep } from '@/components/field-findings/wizard/VisitCaseClosureStep';
import { VisitFieldIntelligenceStep } from '@/components/field-findings/wizard/VisitFieldIntelligenceStep';
import { VisitMeasurementsStep } from '@/components/field-findings/wizard/VisitMeasurementsStep';
import { VisitOverviewStep } from '@/components/field-findings/wizard/VisitOverviewStep';
import { VisitPhotosStep } from '@/components/field-findings/wizard/VisitPhotosStep';
import { VisitAiAnalysisStep } from '@/components/field-findings/wizard/VisitAiAnalysisStep';
import { VisitAiTriageStep } from '@/components/field-findings/wizard/VisitAiTriageStep';
import { VisitEconomicOptimizerStep } from '@/components/field-findings/wizard/VisitEconomicOptimizerStep';
import { VisitFollowUpStep } from '@/components/field-findings/wizard/VisitFollowUpStep';
import { VisitRecommendationStep } from '@/components/field-findings/wizard/VisitRecommendationStep';
import { VisitSoilWeatherStep } from '@/components/field-findings/wizard/VisitSoilWeatherStep';
import { VisitFinalDiagnosisStep } from '@/components/field-findings/wizard/VisitFinalDiagnosisStep';
import { VisitRecPlanningStep } from '@/components/field-findings/wizard/VisitRecPlanningStep';
import { VisitRecApprovalStep } from '@/components/field-findings/wizard/VisitRecApprovalStep';
import { VisitSummaryStep } from '@/components/field-findings/wizard/VisitSummaryStep';
import { type VisitPhotoDraft, getVisitPhotoTypesForCrop, newIssueDraft, pickDefaultCategory } from '@/components/field-findings/wizard/types';
import { useStaffAuth } from '@/context/StaffAuth';
import { applyVisitPrefillContext } from '@/lib/applyVisitPrefill';
import { clearVisitDraft, loadVisitDraft, saveVisitDraft } from '@/lib/visitDraft';
import { ensureVisitPhotoBase64 } from '@/lib/prefillVisitPhotos';

function initialCapturePhotoType(crop: string): string {
  return suggestNextCapturePhotoType([], getVisitPhotoTypesForCrop(crop).map((t) => t.value));
}

function mergeVisitPhotosIntoIssues(issues: IssueDraft[], visitPhotos: VisitPhotoDraft[]) {
  const sharedPhotos = visitPhotos.map((p) => ({
    filename: p.filename,
    mimeType: p.mimeType,
    dataBase64: p.dataBase64,
    photoType: p.photoType,
  }));
  return issues.map(({ localId, photosPreview, categoryLabel, hypotheses, followUpQuestions, similarCases, confidenceAction, skipFollowUpOptional, qaSkipped, imageSignal, aiDosage, aiPriority, selectedHypothesisLabel, ...issue }, index) => ({
    ...issue,
    observation: categoryLabel
      ? `[${categoryLabel}] ${issue.observation ?? ''}`.trim()
      : issue.observation,
    photos: [...(issue.photos ?? []), ...(index === 0 ? sharedPhotos : [])],
  }));
}

export default function VisitScreen() {
  const router = useRouter();
  const { canWrite, admin } = useStaffAuth();
  const footerPad = useStickyFooterScrollPadding({ rows: 1 });
  const params = useLocalSearchParams<{
    farmerId: string;
    blockId: string;
    blockName: string;
    cropType: string;
    farmerName: string;
    recommendationId?: string;
    escalationId?: string;
    rectification?: string;
  }>();

  const farmerId = String(params.farmerId ?? '');
  const blockId = String(params.blockId ?? '');
  const blockName = String(params.blockName ?? '');
  const cropType = String(params.cropType ?? '');
  const farmerName = String(params.farmerName ?? '');
  const recommendationId = params.recommendationId ? String(params.recommendationId) : '';
  const escalationId = params.escalationId ? String(params.escalationId) : '';
  const rectificationMode = params.rectification === '1' || Boolean(escalationId);

  const sessionRef = useRef<string | null>(null);
  const [step, setStep] = useState<VisitWizardStep>('overview');
  const [blockDap, setBlockDap] = useState<number | null>(null);
  const [blockStage, setBlockStage] = useState<string | null>(null);
  const [latestSoilTest, setLatestSoilTest] = useState<PortalSoilReport | null>(null);
  const [farmContext, setFarmContext] = useState<VisitFarmContext | null>(null);
  const [recommendationGroups, setRecommendationGroups] = useState<RecommendationGroupDraft[]>([]);
  const [recApproved, setRecApproved] = useState(false);
  const [monitoringPlan, setMonitoringPlan] = useState<MonitoringPlanPreviewItem[]>([]);
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsappPreviewMessage[]>([]);
  const [templates, setTemplates] = useState<MeasurementTemplate[]>([]);
  const [issueMaster, setIssueMaster] = useState<IssueMasterRow[]>([]);
  const [issues, setIssues] = useState<IssueDraft[]>([]);
  const [visitPhotos, setVisitPhotos] = useState<VisitPhotoDraft[]>([]);
  const [fieldVoiceNote, setFieldVoiceNote] = useState('');
  const [capturePhotoType, setCapturePhotoType] = useState(() => initialCapturePhotoType(cropType));
  const [prefillDiagnosis, setPrefillDiagnosis] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [blockHealth, setBlockHealth] = useState<BlockHealthLevel | null>(null);
  const [cropPerformance, setCropPerformance] = useState<CropPerformanceLevel | null>(null);
  const [soilMoisture, setSoilMoisture] = useState<SoilMoistureLevel | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpDraft[]>([]);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLon, setGpsLon] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triage, setTriage] = useState<TriagePreview | null>(null);
  const [selectedRecOptionId, setSelectedRecOptionId] = useState<string | null>(null);
  const [visitClassification, setVisitClassification] = useState<VisitClassification>(
    rectificationMode ? 'rectification' : 'first'
  );
  const [plotIntelSummary, setPlotIntelSummary] = useState<string | null>(null);

  const persistDraft = useCallback(async () => {
    if (!blockId || !farmerId) return;
    await saveVisitDraft(blockId, {
      farmerId,
      blockId,
      sessionId: sessionRef.current ?? undefined,
      blockHealth: blockHealth ?? undefined,
      cropPerformance: cropPerformance ?? undefined,
      soilMoisture: soilMoisture ?? undefined,
      selectedCategories: issues.map((i) => i.category),
      issues: issues.map(({ localId, photosPreview, ...rest }) => rest),
      measurements,
      savedAt: new Date().toISOString(),
    });
  }, [blockId, farmerId, blockHealth, cropPerformance, soilMoisture, issues, measurements]);

  useEffect(() => {
    if (!cropType || !farmerId || !blockId) {
      setLoading(false);
      setError('Missing farmer or block for this visit.');
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const [tpls, master, session, blockDetail, recs, plotIntel] = await Promise.all([
          agronomistClient.getMeasurementTemplates(cropType),
          agronomistClient.searchIssueMaster({ cropType }),
          agronomistClient.startVisitSession({ farmerId, blockId }),
          agronomistClient.getBlockDetail(farmerId, blockId).catch(() => null),
          agronomistClient.listFarmerRecommendations(farmerId, 20).catch(() => []),
          agronomistClient.getPlotIntelligence(blockId).catch(() => null),
        ]);
        if (cancelled) return;

        setTemplates(tpls);
        setIssueMaster(master);
        sessionRef.current = session.id;
        setBlockDap(blockDetail?.block?.dap ?? null);
        setBlockStage(blockDetail?.block?.cropHealthLabel ?? null);
        setLatestSoilTest(blockDetail?.soilReports?.[0] ?? null);
        setFarmContext((blockDetail?.farmContext as VisitFarmContext | undefined) ?? null);

        const recurring = (plotIntel as { recurringIssues?: Array<{ label: string; count: number }> } | null)
          ?.recurringIssues;
        if (recurring?.length) {
          setPlotIntelSummary(
            `Plot memory: ${recurring.map((r) => `${r.label} (${r.count}x)`).join('; ')}`
          );
        }

        setFollowUps(buildPriorRecommendationFollowUps(recs, blockId));

        const draft = await loadVisitDraft(blockId);
        let restoredIssues = false;
        if (draft && draft.farmerId === farmerId) {
          setBlockHealth(draft.blockHealth ?? null);
          setCropPerformance(draft.cropPerformance ?? null);
          setSoilMoisture(draft.soilMoisture ?? null);
          setMeasurements(draft.measurements ?? {});
          if (draft.issues?.length) {
            restoredIssues = true;
            setIssues(
              draft.issues.map((i, idx) => ({
                ...i,
                localId: `draft-${idx}`,
                photosPreview: [],
              }))
            );
          }
        }

        const prefillSource = escalationId
          ? await agronomistClient.getEscalationVisitContext(escalationId).catch(() => null)
          : recommendationId
            ? await agronomistClient.getRecommendationVisitContext(recommendationId).catch(() => null)
            : null;

        if (prefillSource && !cancelled) {
          const applied = await applyVisitPrefillContext(prefillSource);
          if (applied.fieldVoiceNote) setFieldVoiceNote(applied.fieldVoiceNote);
          if (applied.issues.length && !restoredIssues) {
            setIssues(
              applied.issues.map((row, idx) => ({
                ...newIssueDraft(pickDefaultCategory(), `ai-prefill-${idx}`),
                issueName: row.issueName,
                observation: row.observation,
              }))
            );
          }
          if (applied.photos.length) {
            setVisitPhotos(applied.photos);
            setCapturePhotoType(
              suggestNextCapturePhotoType(
                applied.photos.map((p) => p.photoType),
                getVisitPhotoTypesForCrop(prefillSource.cropType ?? cropType).map((t) => t.value)
              )
            );
          }
          const diagnosis = prefillSource.aiDiagnosis ?? prefillSource.issueDetected;
          if (diagnosis) setPrefillDiagnosis(diagnosis);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not start visit');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [cropType, farmerId, blockId, recommendationId, escalationId]);

  useEffect(() => {
    if (!visitPhotos.length) {
      setCapturePhotoType(initialCapturePhotoType(cropType));
    }
  }, [cropType, visitPhotos.length]);

  useEffect(() => {
    const t = setTimeout(() => {
      void persistDraft();
    }, 800);
    return () => clearTimeout(t);
  }, [persistDraft]);

  function missingAssessments(): string | null {
    if (!blockHealth || !cropPerformance || !soilMoisture) {
      return 'Select block health, crop performance, and soil moisture on the Overview step before submitting.';
    }
    return null;
  }

  function validationContext() {
    return {
      templates,
      measurements,
      issues,
      visitPhotos,
      recommendationGroups,
      monitoringPlan,
      whatsappConfirmed,
      whatsappMessages,
      recApproved,
      blockHealth,
      cropPerformance,
      soilMoisture,
      triage,
      selectedRecommendationOptionId: selectedRecOptionId,
    };
  }

  function validateStep(current: VisitWizardStep): string | null {
    const normalized = normalizeVisitWizardStep(current);
    return validateVisitWizardStep(normalized, validationContext());
  }

  function activeStep(): VisitWizardStep {
    return normalizeVisitWizardStep(step);
  }

  async function createIssueType(input: {
    category: IssueCategory;
    issueName: string;
    cropType: string;
  }): Promise<IssueMasterRow | null> {
    const row = await agronomistClient.createIssueMaster(input);
    setIssueMaster((prev) => [...prev, row]);
    return row;
  }

  function goNext() {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    const next = getNextWizardStep(activeStep(), validationContext());
    if (next) setStep(next);
  }

  function goBack() {
    setError('');
    const prev = getPrevWizardStep(activeStep(), validationContext());
    if (prev) setStep(prev);
  }

  async function captureGps() {
    setGpsLoading(true);
    setGpsStatus('Getting location…');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('Location permission denied.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsLat(pos.coords.latitude);
      setGpsLon(pos.coords.longitude);
      setGpsStatus(`Captured ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      await agronomistClient.saveBlockLocation(blockId, {
        farmerId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e) {
      setGpsStatus(e instanceof Error ? e.message : 'Could not get GPS');
    } finally {
      setGpsLoading(false);
    }
  }

  async function submit() {
    if (!canWrite || !farmerId || !blockId) return;
    const assessmentMsg = missingAssessments();
    if (assessmentMsg) {
      setError(assessmentMsg);
      setStep('overview');
      return;
    }
    const msg = validateStep('agronomistReview');
    if (msg) {
      setError(msg);
      return;
    }
    for (const tpl of templates) {
      if (tpl.required && !measurements[tpl.measurementKey]?.trim()) {
        setError(`Required measurement: ${tpl.labelEn}`);
        setStep('fieldIntelligence');
        return;
      }
    }
    if (followUps.length) {
      const pending = followUps.filter(
        (f) => f.outcome === 'not_reviewed' && f.followed === 'not_applicable'
      );
      if (pending.length) {
        setError('Record follow-up outcomes for open recommendations on this block.');
        setStep('summary');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const measurementRows = templates
        .map((tpl) => ({
          key: tpl.measurementKey,
          value: measurements[tpl.measurementKey]?.trim() ?? '',
          unit: tpl.unit ?? undefined,
        }))
        .filter((m) => m.value);

      const resolvedPhotos = await ensureVisitPhotoBase64(visitPhotos);
      const issuePayload = mergeVisitPhotosIntoIssues(issues, resolvedPhotos);
      const visitPhotoPayload = resolvedPhotos.map((p) => ({
        filename: p.filename,
        mimeType: p.mimeType,
        dataBase64: p.dataBase64,
        photoType: p.photoType,
      }));

      const visitResult = await agronomistClient.submitStructuredVisit({
        farmerId,
        blockId,
        sessionId: sessionRef.current ?? undefined,
        blockAssessment: { blockHealth: blockHealth!, cropPerformance: cropPerformance!, soilMoisture: soilMoisture! },
        measurements: measurementRows,
        visitPhotos: visitPhotoPayload.length ? visitPhotoPayload : undefined,
        issues: issuePayload.map((issue) => ({
          ...issue,
          agronomistReview: issue.agronomistReview!,
        })),
        recommendationGroups: recommendationGroups.length
          ? mapRecommendationGroupsForSubmit(recommendationGroups, (localId) =>
              issues.findIndex((i) => i.localId === localId)
            )
          : undefined,
        whatsappMessages: whatsappMessages.length
          ? whatsappMessages.map((m) => ({
              issueIndex: m.issueIndex,
              message: m.message.trim(),
              complianceQuestion: m.complianceQuestion?.trim() || undefined,
              complianceNoAction: m.complianceNoAction ?? 'escalate',
            }))
          : undefined,
        followUps: followUps
          .filter((f) => f.outcome !== 'not_reviewed' || f.followed !== 'not_applicable')
          .map((f) => ({
            recommendationId: f.recommendationId,
            followed: f.followed,
            outcome: f.outcome,
            notes: f.notes.trim() || undefined,
          })),
        visitClassification,
        selectedRecommendationOptionId: selectedRecOptionId ?? undefined,
        latitude: gpsLat ?? undefined,
        longitude: gpsLon ?? undefined,
      });

      if (sessionRef.current) {
        await agronomistClient.checkOutVisitSession(sessionRef.current, {
          latitude: gpsLat ?? undefined,
          longitude: gpsLon ?? undefined,
          fieldFindingId: visitResult.findingId,
        });
      }

      await clearVisitDraft(blockId);

      router.replace({
        pathname: '/visit/success',
        params: {
          farmerName,
          blockName,
          findingId: visitResult.findingId,
          recommendationAdded: visitResult.recommendationIds.length ? String(visitResult.recommendationIds.length) : undefined,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Starting visit session…" />;

  const visibleSteps = getVisibleWizardSteps();
  const stepIndex = visibleSteps.indexOf(step);

  return (
    <View style={styles.root}>
      <VisitStepper current={activeStep()} />
      <KeyboardAwareScrollScreen contentContainerStyle={[styles.content, { paddingBottom: footerPad }]}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        {step === 'overview' ? (
          <VisitOverviewStep
            farmerName={farmerName}
            blockName={blockName}
            cropType={cropType}
            dap={blockDap}
            stage={blockStage}
            agronomistName={admin?.email ?? null}
            soilTest={latestSoilTest}
            farmContext={farmContext}
            blockHealth={blockHealth}
            cropPerformance={cropPerformance}
            soilMoisture={soilMoisture}
            onBlockHealth={setBlockHealth}
            onCropPerformance={setCropPerformance}
            onSoilMoisture={setSoilMoisture}
            visitClassification={visitClassification}
            onVisitClassification={setVisitClassification}
            plotIntelSummary={plotIntelSummary}
          />
        ) : null}

        {rectificationMode && prefillDiagnosis ? (
          <AlertBox>
            Rectification visit — verify or correct AI diagnosis: {prefillDiagnosis}. Use review steps to reject and
            record the correct diagnosis.
          </AlertBox>
        ) : null}

        {step === 'photos' ? (
          <VisitPhotosStep
            cropType={cropType}
            photos={visitPhotos}
            captureType={capturePhotoType}
            onCaptureTypeChange={setCapturePhotoType}
            voiceNote={fieldVoiceNote}
            onPhotosChange={setVisitPhotos}
            onVoiceNoteChange={setFieldVoiceNote}
          />
        ) : null}

        {activeStep() === 'fieldIntelligence' ? (
          <VisitFieldIntelligenceStep
            cropType={cropType}
            farmerId={farmerId}
            blockId={blockId}
            templates={templates}
            measurements={measurements}
            onMeasurementChange={(key, value) => setMeasurements((prev) => ({ ...prev, [key]: value }))}
          />
        ) : null}

        {step === 'measurements' ? (
          <VisitMeasurementsStep
            cropType={cropType}
            templates={templates}
            values={measurements}
            onChange={(key, value) => setMeasurements((prev) => ({ ...prev, [key]: value }))}
          />
        ) : null}

        {step === 'soilWeather' ? (
          <VisitSoilWeatherStep farmerId={farmerId} blockId={blockId} />
        ) : null}

        {step === 'aiTriage' && blockHealth && cropPerformance && soilMoisture ? (
          <VisitAiTriageStep
            farmerId={farmerId}
            blockId={blockId}
            blockAssessment={{ blockHealth, cropPerformance, soilMoisture }}
            measurements={measurements}
            triage={triage}
            onTriage={setTriage}
          />
        ) : null}

        {step === 'followUp' && blockHealth && cropPerformance && soilMoisture ? (
          <VisitFollowUpStep
            issues={issues}
            onChange={setIssues}
            triage={triage}
            screening={{
              farmerId,
              blockId,
              sessionId: sessionRef.current,
              fieldVoiceNote,
              blockAssessment: { blockHealth, cropPerformance, soilMoisture },
              measurements,
              templates,
              gpsLat,
              gpsLon,
              visitPhotos: visitPhotos.map((p) => ({
                dataBase64: p.dataBase64,
                mimeType: p.mimeType,
                photoType: p.photoType,
              })),
            }}
          />
        ) : null}

        {step === 'aiAnalysis' && blockHealth && cropPerformance && soilMoisture ? (
          <VisitAiAnalysisStep
            farmerId={farmerId}
            blockId={blockId}
            sessionId={sessionRef.current}
            cropType={cropType}
            issues={issues}
            visitPhotos={visitPhotos}
            fieldVoiceNote={fieldVoiceNote}
            blockAssessment={{ blockHealth, cropPerformance, soilMoisture }}
            measurements={measurements}
            templates={templates}
            gpsLat={gpsLat}
            gpsLon={gpsLon}
            onChange={setIssues}
          />
        ) : null}

        {step === 'agronomistReview' ? (
          <VisitAgronomistReviewStep
            issues={issues}
            issueMaster={issueMaster}
            cropType={cropType}
            blockDap={blockDap}
            blockAutoApprove={blockAutoApprove({ triage, issues })}
            onChange={setIssues}
            onSuggestQuestions={() => Promise.resolve([])}
            onCreateIssueType={createIssueType}
          />
        ) : null}

        {step === 'additionalPhotos' ? (
          <VisitAdditionalPhotosStep issues={issues} onChange={setIssues} />
        ) : null}

        {step === 'finalDiagnosis' ? (
          <VisitFinalDiagnosisStep issues={issues} onChange={setIssues} />
        ) : null}

        {step === 'economicOptimizer' ? (
          <VisitEconomicOptimizerStep
            issueLabel={issues[0]?.finalDiagnosis ?? issues[0]?.issueName ?? 'Field issue'}
            cropType={cropType}
            selectedId={selectedRecOptionId}
            onSelect={(id) => setSelectedRecOptionId(id)}
          />
        ) : null}

        {step === 'recPlanning' ? (
          <>
            <VisitRecommendationStep issues={issues} onChange={setIssues} />
            <VisitRecPlanningStep
              cropType={cropType}
              issues={issues}
              groups={recommendationGroups}
              onChange={setRecommendationGroups}
            />
          </>
        ) : null}

        {step === 'applicationSchedule' ? (
          <VisitApplicationScheduleStep groups={recommendationGroups} onChange={setRecommendationGroups} />
        ) : null}

        {step === 'recApproval' ? (
          <VisitRecApprovalStep
            groups={recommendationGroups}
            approved={recApproved}
            onApprovedChange={(approved) => setRecApproved(approved)}
          />
        ) : null}

        {step === 'monitoringPlan' ? (
          <VisitMonitoringPlanStep
            issues={issues}
            recommendationGroups={recommendationGroups}
            monitoringPlan={monitoringPlan}
            onChange={setMonitoringPlan}
          />
        ) : null}

        {step === 'whatsappPreview' ? (
          <VisitWhatsappPreviewStep
            farmerId={farmerId}
            blockName={blockName}
            issues={issues}
            recommendationGroups={recommendationGroups}
            monitoringInterval={
              monitoringPlan[0]?.intervalDays != null
                ? String(monitoringPlan[0].intervalDays)
                : undefined
            }
            confirmed={whatsappConfirmed}
            onConfirmedChange={setWhatsappConfirmed}
            messages={whatsappMessages}
            onMessagesChange={setWhatsappMessages}
          />
        ) : null}

        {step === 'summary' ? (
          <VisitSummaryStep
            photoCount={visitPhotos.length + issues.reduce((n, i) => n + (i.photos?.length ?? 0), 0)}
            photoTypeCount={visitPhotos.length}
            templates={templates}
            measurements={measurements}
            issues={issues}
            followUps={followUps}
            onFollowUpChange={(index, next) => setFollowUps((prev) => prev.map((f, i) => (i === index ? next : f)))}
            blockHealth={blockHealth}
            cropPerformance={cropPerformance}
            soilMoisture={soilMoisture}
            hasGps={gpsLat != null}
            gpsStatus={gpsStatus}
            gpsLoading={gpsLoading}
            onCaptureGps={() => void captureGps()}
          />
        ) : null}

        {step === 'caseClosure' ? (
          <VisitCaseClosureStep issues={issues} recommendationGroups={recommendationGroups} />
        ) : null}
      </KeyboardAwareScrollScreen>

      <StickyScreenFooter>
        <View style={styles.footerRow}>
          {stepIndex > 0 ? (
            <View style={styles.footerBtn}>
              <Btn label="Back" variant="secondary" onPress={goBack} />
            </View>
          ) : null}
          <View style={styles.footerBtn}>
            {step === 'caseClosure' ? (
              <Btn label={saving ? 'Submitting…' : 'Submit visit'} onPress={() => void submit()} disabled={saving || !canWrite} />
            ) : (
              <Btn label="Continue" onPress={goNext} />
            )}
          </View>
        </View>
      </StickyScreenFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerBtn: { flex: 1 },
});
