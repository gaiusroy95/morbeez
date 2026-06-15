import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  partnerClient,
  validateVisitWizardStep,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type IssueMasterRow,
  type MeasurementTemplate,
  type PortalSoilReport,
  type SoilMoistureLevel,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, Loading, StickyScreenFooter, useStickyFooterScrollPadding } from '@morbeez/ui-native';
import { type FollowUpDraft } from '@agronomist/components/field-findings/FollowUpSection';
import { type IssueDraft } from '@agronomist/components/field-findings/IssueCard';
import { VisitStepper, VISIT_WIZARD_STEPS, type VisitWizardStep } from '@agronomist/components/field-findings/VisitStepper';
import { VisitIssuesStep } from '@agronomist/components/field-findings/wizard/VisitIssuesStep';
import { VisitMeasurementsStep } from '@agronomist/components/field-findings/wizard/VisitMeasurementsStep';
import { VisitOverviewStep } from '@agronomist/components/field-findings/wizard/VisitOverviewStep';
import { VisitPhotosStep } from '@agronomist/components/field-findings/wizard/VisitPhotosStep';
import { PartnerVisitAiAnalysisStep } from '@/components/visit/PartnerVisitAiAnalysisStep';
import { VisitFollowUpStep } from '@agronomist/components/field-findings/wizard/VisitFollowUpStep';
import { VisitRecommendationStep } from '@agronomist/components/field-findings/wizard/VisitRecommendationStep';
import { PartnerVisitReviewStep } from '@/components/visit/PartnerVisitReviewStep';
import { VisitSummaryStep } from '@agronomist/components/field-findings/wizard/VisitSummaryStep';
import { type VisitPhotoDraft, getDefaultSelectedPhotoTypes } from '@agronomist/components/field-findings/wizard/types';
import { usePartnerAuth } from '@/context/PartnerAuth';
import { clearVisitDraft, loadVisitDraft, saveVisitDraft } from '@/lib/visitDraft';

function mergeVisitPhotosIntoIssues(issues: IssueDraft[], visitPhotos: VisitPhotoDraft[]) {
  const sharedPhotos = visitPhotos.map((p) => ({
    filename: p.filename,
    mimeType: p.mimeType,
    dataBase64: p.dataBase64,
    photoType: p.photoType,
  }));
  return issues.map(({ localId, photosPreview, hypotheses, followUpQuestions, similarCases, confidenceAction, skipFollowUpOptional, qaSkipped, imageSignal, aiDosage, aiPriority, selectedHypothesisLabel, ...issue }, index) => ({
    ...issue,
    photos: [...(issue.photos ?? []), ...(index === 0 ? sharedPhotos : [])],
  }));
}

export default function VisitScreen() {
  const router = useRouter();
  const { partner } = usePartnerAuth();
  const footerPad = useStickyFooterScrollPadding({ rows: 1 });
  const params = useLocalSearchParams<{
    farmerId: string;
    blockId: string;
    blockName: string;
    cropType: string;
    farmerName: string;
  }>();

  const farmerId = String(params.farmerId ?? '');
  const blockId = String(params.blockId ?? '');
  const blockName = String(params.blockName ?? '');
  const cropType = String(params.cropType ?? '');
  const farmerName = String(params.farmerName ?? '');

  const sessionRef = useRef<string | null>(null);
  const [step, setStep] = useState<VisitWizardStep>('overview');
  const [blockDap, setBlockDap] = useState<number | null>(null);
  const [blockStage, setBlockStage] = useState<string | null>(null);
  const [latestSoilTest, setLatestSoilTest] = useState<PortalSoilReport | null>(null);
  const [templates, setTemplates] = useState<MeasurementTemplate[]>([]);
  const [issueMaster, setIssueMaster] = useState<IssueMasterRow[]>([]);
  const [issues, setIssues] = useState<IssueDraft[]>([]);
  const [visitPhotos, setVisitPhotos] = useState<VisitPhotoDraft[]>([]);
  const [fieldVoiceNote, setFieldVoiceNote] = useState('');
  const [photoTypes, setPhotoTypes] = useState<string[]>(() => getDefaultSelectedPhotoTypes(cropType));
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
        const [tpls, master, session, blockDetail, recs] = await Promise.all([
          partnerClient.getMeasurementTemplates(cropType),
          partnerClient.getIssueMaster(cropType),
          partnerClient.startVisitSession({ farmerId, blockId }),
          partnerClient.getBlockDetail(farmerId, blockId).catch(() => null),
          partnerClient.getFarmerRecommendations(farmerId).catch(() => []),
        ]);
        if (cancelled) return;

        setTemplates(tpls as MeasurementTemplate[]);
        setIssueMaster(master as IssueMasterRow[]);
        sessionRef.current = String(session.id ?? '');
        const detail = blockDetail as Record<string, unknown> | null;
        const block = detail?.block as Record<string, unknown> | undefined;
        setBlockDap(block?.dap != null ? Number(block.dap) : null);
        setBlockStage(block?.stage ? String(block.stage) : null);
        const soilReports = detail?.soilReports as PortalSoilReport[] | undefined;
        setLatestSoilTest(soilReports?.[0] ?? null);

        const openRecs = (recs as Array<Record<string, unknown>>).filter(
          (r) => r.blockId === blockId && ['communicated', 'approved', 'open', 'monitoring'].includes(String(r.status))
        );
        setFollowUps(
          openRecs.slice(0, 5).map((r) => ({
            recommendationId: String(r.id),
            label: String(r.recommendationText ?? 'Recommendation').slice(0, 60),
            followed: 'not_applicable' as const,
            outcome: 'not_reviewed' as const,
            notes: '',
          }))
        );

        const draft = await loadVisitDraft(blockId);
        if (draft && draft.farmerId === farmerId) {
          setBlockHealth(draft.blockHealth ?? null);
          setCropPerformance(draft.cropPerformance ?? null);
          setSoilMoisture(draft.soilMoisture ?? null);
          setMeasurements(draft.measurements ?? {});
          if (draft.issues?.length) {
            setIssues(
              draft.issues.map((i, idx) => ({
                ...i,
                localId: `draft-${idx}`,
                photosPreview: [],
              }))
            );
          }
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
  }, [cropType, farmerId, blockId]);

  useEffect(() => {
    setPhotoTypes(getDefaultSelectedPhotoTypes(cropType));
  }, [cropType]);

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

  function validateStep(current: VisitWizardStep): string | null {
    return validateVisitWizardStep(current, {
      templates,
      measurements,
      issues,
      blockHealth,
      cropPerformance,
      soilMoisture,
    });
  }

  function goNext() {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    const idx = VISIT_WIZARD_STEPS.findIndex((s) => s.id === step);
    if (idx < VISIT_WIZARD_STEPS.length - 1) {
      setStep(VISIT_WIZARD_STEPS[idx + 1]!.id);
    }
  }

  function goBack() {
    setError('');
    const idx = VISIT_WIZARD_STEPS.findIndex((s) => s.id === step);
    if (idx > 0) setStep(VISIT_WIZARD_STEPS[idx - 1]!.id);
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
      await partnerClient.saveBlockLocation(blockId, {
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
    if (!farmerId || !blockId) return;
    const assessmentMsg = missingAssessments();
    if (assessmentMsg) {
      setError(assessmentMsg);
      setStep('overview');
      return;
    }
    const msg = validateStep('issues');
    if (msg) {
      setError(msg);
      return;
    }
    for (const tpl of templates) {
      if (tpl.required && !measurements[tpl.measurementKey]?.trim()) {
        setError(`Required measurement: ${tpl.labelEn}`);
        setStep('measurements');
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

      const issuePayload = mergeVisitPhotosIntoIssues(issues, visitPhotos);
      const visitPhotoPayload = visitPhotos.map((p) => ({
        filename: p.filename,
        mimeType: p.mimeType,
        dataBase64: p.dataBase64,
        photoType: p.photoType,
      }));

      const visitResult = await partnerClient.submitVisit({
        farmerId,
        blockId,
        sessionId: sessionRef.current ?? undefined,
        blockAssessment: { blockHealth: blockHealth!, cropPerformance: cropPerformance!, soilMoisture: soilMoisture! },
        measurements: measurementRows,
        visitPhotos: visitPhotoPayload.length ? visitPhotoPayload : undefined,
        issues: issuePayload.map((issue) => ({
          ...issue,
          agronomistReview: issue.agronomistReview ?? {
            action: 'approve_ai',
            finalDiagnosis: issue.finalDiagnosis,
            finalRecommendation: issue.finalRecommendation,
          },
        })),
        followUps: followUps
          .filter((f) => f.outcome !== 'not_reviewed' || f.followed !== 'not_applicable')
          .map((f) => ({
            recommendationId: f.recommendationId,
            followed: f.followed,
            outcome: f.outcome,
            notes: f.notes.trim() || undefined,
          })),
        latitude: gpsLat ?? undefined,
        longitude: gpsLon ?? undefined,
      });

      if (sessionRef.current) {
        await partnerClient.checkOutVisitSession(sessionRef.current, {
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
          recommendationAdded: visitResult.recommendationIds?.length
            ? String(visitResult.recommendationIds.length)
            : undefined,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Starting visit session…" />;

  const stepIndex = VISIT_WIZARD_STEPS.findIndex((s) => s.id === step);

  return (
    <View style={styles.root}>
      <VisitStepper current={step} />
      <KeyboardAwareScrollScreen contentContainerStyle={[styles.content, { paddingBottom: footerPad }]}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        {step === 'overview' ? (
          <VisitOverviewStep
            farmerName={farmerName}
            blockName={blockName}
            cropType={cropType}
            dap={blockDap}
            stage={blockStage}
            agronomistName={partner?.fullName ?? 'Partner'}
            soilTest={latestSoilTest}
            blockHealth={blockHealth}
            cropPerformance={cropPerformance}
            soilMoisture={soilMoisture}
            onBlockHealth={setBlockHealth}
            onCropPerformance={setCropPerformance}
            onSoilMoisture={setSoilMoisture}
          />
        ) : null}

        {step === 'photos' ? (
          <VisitPhotosStep
            cropType={cropType}
            photos={visitPhotos}
            selectedTypes={photoTypes}
            voiceNote={fieldVoiceNote}
            onPhotosChange={setVisitPhotos}
            onTypesChange={setPhotoTypes}
            onVoiceNoteChange={setFieldVoiceNote}
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

        {step === 'issues' ? (
          <VisitIssuesStep
            issues={issues}
            issueMaster={issueMaster}
            cropType={cropType}
            blockDap={blockDap}
            onChange={setIssues}
            onSuggestQuestions={() => Promise.resolve([])}
          />
        ) : null}

        {step === 'aiAnalysis' && blockHealth && cropPerformance && soilMoisture ? (
          <PartnerVisitAiAnalysisStep
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

        {step === 'followUp' ? (
          <VisitFollowUpStep issues={issues} onChange={setIssues} />
        ) : null}

        {step === 'recommendation' ? (
          <VisitRecommendationStep issues={issues} onChange={setIssues} />
        ) : null}

        {step === 'review' ? (
          <PartnerVisitReviewStep issues={issues} onChange={setIssues} />
        ) : null}

        {step === 'summary' ? (
          <VisitSummaryStep
            photoCount={visitPhotos.length + issues.reduce((n, i) => n + (i.photos?.length ?? 0), 0)}
            photoTypeCount={photoTypes.length}
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
      </KeyboardAwareScrollScreen>

      <StickyScreenFooter>
        <View style={styles.footerRow}>
          {stepIndex > 0 ? (
            <View style={styles.footerBtn}>
              <Btn label="Back" variant="secondary" onPress={goBack} />
            </View>
          ) : null}
          <View style={styles.footerBtn}>
            {step === 'summary' ? (
              <Btn label={saving ? 'Submitting…' : 'Submit visit'} onPress={() => void submit()} disabled={saving} />
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
