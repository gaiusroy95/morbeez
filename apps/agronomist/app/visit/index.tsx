import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  agronomistClient,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type IssueMasterRow,
  type MeasurementTemplate,
  type SoilMoistureLevel,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, Loading, StickyScreenFooter, useStickyFooterScrollPadding } from '@morbeez/ui-native';
import { FollowUpSection, type FollowUpDraft } from '@/components/field-findings/FollowUpSection';
import { type IssueDraft } from '@/components/field-findings/IssueCard';
import { VisitStepper, VISIT_WIZARD_STEPS, type VisitWizardStep } from '@/components/field-findings/VisitStepper';
import { VisitIssuesStep } from '@/components/field-findings/wizard/VisitIssuesStep';
import { VisitMeasurementsStep } from '@/components/field-findings/wizard/VisitMeasurementsStep';
import { VisitOverviewStep } from '@/components/field-findings/wizard/VisitOverviewStep';
import { VisitPhotosStep } from '@/components/field-findings/wizard/VisitPhotosStep';
import { VisitSummaryStep } from '@/components/field-findings/wizard/VisitSummaryStep';
import { type VisitPhotoDraft } from '@/components/field-findings/wizard/types';
import { useStaffAuth } from '@/context/StaffAuth';
import { clearVisitDraft, loadVisitDraft, saveVisitDraft } from '@/lib/visitDraft';

function mergeVisitPhotosIntoIssues(issues: IssueDraft[], visitPhotos: VisitPhotoDraft[]) {
  const sharedPhotos = visitPhotos.map((p) => ({
    filename: p.filename,
    mimeType: p.mimeType,
    dataBase64: p.dataBase64,
  }));
  return issues.map(({ localId, photosPreview, ...issue }, index) => ({
    ...issue,
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
  const [templates, setTemplates] = useState<MeasurementTemplate[]>([]);
  const [issueMaster, setIssueMaster] = useState<IssueMasterRow[]>([]);
  const [issues, setIssues] = useState<IssueDraft[]>([]);
  const [visitPhotos, setVisitPhotos] = useState<VisitPhotoDraft[]>([]);
  const [photoTypes, setPhotoTypes] = useState<string[]>(['whole_field']);
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
          agronomistClient.getMeasurementTemplates(cropType),
          agronomistClient.searchIssueMaster({ cropType }),
          agronomistClient.startVisitSession({ farmerId, blockId }),
          agronomistClient.getBlockDetail(farmerId, blockId).catch(() => null),
          agronomistClient.listFarmerRecommendations(farmerId, 20).catch(() => []),
        ]);
        if (cancelled) return;

        setTemplates(tpls);
        setIssueMaster(master);
        sessionRef.current = session.id;
        setBlockDap(blockDetail?.block?.dap ?? null);
        setBlockStage(blockDetail?.block?.cropHealthLabel ?? null);

        const openRecs = recs.filter(
          (r) => r.blockId === blockId && ['communicated', 'approved'].includes(String(r.status))
        );
        setFollowUps(
          openRecs.slice(0, 5).map((r) => ({
            recommendationId: r.id,
            label: r.issueDetected?.trim() || r.recommendationText.slice(0, 60),
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
    if (current === 'measurements') {
      for (const tpl of templates) {
        if (tpl.required && !measurements[tpl.measurementKey]?.trim()) {
          return `Required measurement: ${tpl.labelEn}`;
        }
      }
    }
    if (current === 'issues') {
      if (!issues.length) return 'Add at least one issue.';
      for (const issue of issues) {
        if (!issue.issueName.trim()) return 'Each issue needs a name.';
      }
    }
    return null;
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

      const visitResult = await agronomistClient.submitStructuredVisit({
        farmerId,
        blockId,
        sessionId: sessionRef.current ?? undefined,
        blockAssessment: { blockHealth: blockHealth!, cropPerformance: cropPerformance!, soilMoisture: soilMoisture! },
        measurements: measurementRows,
        issues: issuePayload,
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
            agronomistName={admin?.email ?? null}
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
            photos={visitPhotos}
            selectedTypes={photoTypes}
            onPhotosChange={setVisitPhotos}
            onTypesChange={setPhotoTypes}
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
          <>
            <VisitIssuesStep
              issues={issues}
              issueMaster={issueMaster}
              cropType={cropType}
              blockDap={blockDap}
              onChange={setIssues}
              onSuggestQuestions={(issue) =>
                agronomistClient.suggestIssueFollowUpQuestions({
                  issueCategory: issue.category,
                  issueName: issue.issueName || issue.category,
                  cropType,
                  dap: blockDap ?? undefined,
                  observation: issue.observation,
                  photoCount: (issue.photos?.length ?? 0) + visitPhotos.length,
                })
              }
            />
            <FollowUpSection
              items={followUps}
              onChange={(index, next) => setFollowUps((prev) => prev.map((f, i) => (i === index ? next : f)))}
            />
          </>
        ) : null}

        {step === 'summary' ? (
          <VisitSummaryStep
            photoCount={visitPhotos.length + issues.reduce((n, i) => n + (i.photos?.length ?? 0), 0)}
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
