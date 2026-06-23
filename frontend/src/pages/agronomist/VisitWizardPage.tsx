import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  agronomistClient,
  blockAutoApprove,
  getNextWizardStep,
  getPrevWizardStep,
  getVisibleWizardSteps,
  mergeVisitPhotosIntoIssues,
  suggestNextCapturePhotoType,
  validateVisitWizardStep,
  mapRecommendationGroupsForSubmit,
  buildPriorRecommendationFollowUps,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type IssueMasterRow,
  type MeasurementTemplate,
  type MonitoringPlanPreviewItem,
  type PortalSoilReport,
  type RecommendationGroupDraft,
  type SoilMoistureLevel,
  type TriagePreview,
  type VisitClassification,
  type VisitFarmContext,
  type VisitWizardStep,
  type WhatsappPreviewMessage,
} from '@morbeez/shared';
import { Alert, Btn, Loading } from '../../components/ui';
import { VisitWizardStepper } from '../../components/agronomist/visit-wizard/VisitWizardStepper';
import { VisitOverviewStep } from '../../components/agronomist/visit-wizard/VisitOverviewStep';
import { VisitPhotosStep } from '../../components/agronomist/visit-wizard/VisitPhotosStep';
import { getVisitPhotoTypesForCrop } from '../../components/agronomist/visit-wizard/visitPhotoTypes';
import { VisitFieldIntelligenceStep } from '../../components/agronomist/visit-wizard/VisitFieldIntelligenceStep';
import { VisitMeasurementsStep } from '../../components/agronomist/visit-wizard/VisitMeasurementsStep';
import { VisitSoilWeatherStep } from '../../components/agronomist/visit-wizard/VisitSoilWeatherStep';
import { VisitAgronomistReviewStep } from '../../components/agronomist/visit-wizard/VisitAgronomistReviewStep';
import { VisitAdditionalPhotosStep } from '../../components/agronomist/visit-wizard/VisitAdditionalPhotosStep';
import { VisitApplicationScheduleStep } from '../../components/agronomist/visit-wizard/VisitApplicationScheduleStep';
import { VisitMonitoringPlanStep } from '../../components/agronomist/visit-wizard/VisitMonitoringPlanStep';
import { VisitWhatsappPreviewStep } from '../../components/agronomist/visit-wizard/VisitWhatsappPreviewStep';
import { VisitCaseClosureStep } from '../../components/agronomist/visit-wizard/VisitCaseClosureStep';
import { VisitAiAnalysisStep } from '../../components/agronomist/visit-wizard/VisitAiAnalysisStep';
import { VisitAiTriageStep } from '../../components/agronomist/visit-wizard/VisitAiTriageStep';
import { VisitEconomicOptimizerStep } from '../../components/agronomist/visit-wizard/VisitEconomicOptimizerStep';
import { VisitFollowUpStep } from '../../components/agronomist/visit-wizard/VisitFollowUpStep';
import { VisitFinalDiagnosisStep } from '../../components/agronomist/visit-wizard/VisitFinalDiagnosisStep';
import { VisitRecommendationStep } from '../../components/agronomist/visit-wizard/VisitRecommendationStep';
import { VisitRecPlanningStep } from '../../components/agronomist/visit-wizard/VisitRecPlanningStep';
import { VisitRecApprovalStep } from '../../components/agronomist/visit-wizard/VisitRecApprovalStep';
import { VisitSummaryStep } from '../../components/agronomist/visit-wizard/VisitSummaryStep';
import type { FollowUpDraft, VisitIssueDraft, VisitPhotoDraft } from '../../components/agronomist/visit-wizard/types';
import { useAuth } from '../../context/AuthContext';
import { clearVisitDraft, loadVisitDraft, saveVisitDraft } from '../../lib/visitDraft';
import { paths, toPath } from '../../lib/routes';
import '../../styles/visit-wizard.css';

function initialCapturePhotoType(crop: string): string {
  return suggestNextCapturePhotoType([], getVisitPhotoTypesForCrop(crop).map((t) => t.value));
}

type Props = {
  canWrite: boolean;
};

export function VisitWizardPage({ canWrite }: Props) {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [searchParams] = useSearchParams();

  const farmerId = String(searchParams.get('farmerId') ?? '');
  const blockId = String(searchParams.get('blockId') ?? '');
  const blockName = String(searchParams.get('blockName') ?? '');
  const cropType = String(searchParams.get('cropType') ?? '');
  const farmerName = String(searchParams.get('farmerName') ?? '');

  const sessionRef = useRef<string | null>(null);
  const [step, setStep] = useState<VisitWizardStep>('overview');
  const [blockDap, setBlockDap] = useState<number | null>(null);
  const [blockStage, setBlockStage] = useState<string | null>(null);
  const [latestSoilTest, setLatestSoilTest] = useState<PortalSoilReport | null>(null);
  const [farmContext, setFarmContext] = useState<VisitFarmContext | null>(null);
  const [recommendationGroups, setRecommendationGroups] = useState<RecommendationGroupDraft[]>([]);
  const [recApproved, setRecApproved] = useState(false);
  const [compatibilityOverrideReason, setCompatibilityOverrideReason] = useState('');
  const [compatibilityOverridePairs, setCompatibilityOverridePairs] = useState<
    Array<{ productA: string; productB: string; status: string }>
  >([]);
  const [monitoringPlan, setMonitoringPlan] = useState<MonitoringPlanPreviewItem[]>([]);
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsappPreviewMessage[]>([]);
  const [templates, setTemplates] = useState<MeasurementTemplate[]>([]);
  const [issueMaster, setIssueMaster] = useState<IssueMasterRow[]>([]);
  const [issues, setIssues] = useState<VisitIssueDraft[]>([]);
  const [visitPhotos, setVisitPhotos] = useState<VisitPhotoDraft[]>([]);
  const [fieldVoiceNote, setFieldVoiceNote] = useState('');
  const [capturePhotoType, setCapturePhotoType] = useState(() => initialCapturePhotoType(cropType));
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
  const [visitClassification, setVisitClassification] = useState<VisitClassification>('first');
  const [plotIntelSummary, setPlotIntelSummary] = useState<string | null>(null);

  const persistDraft = useCallback(() => {
    if (!blockId || !farmerId) return;
    saveVisitDraft(blockId, {
      farmerId,
      blockId,
      sessionId: sessionRef.current ?? undefined,
      blockHealth: blockHealth ?? undefined,
      cropPerformance: cropPerformance ?? undefined,
      soilMoisture: soilMoisture ?? undefined,
      selectedCategories: issues.map((i) => i.category),
      issues: issues.map(({ localId: _localId, ...rest }) => rest),
      measurements,
      recommendationGroups: recommendationGroups.length ? recommendationGroups : undefined,
      savedAt: new Date().toISOString(),
    });
  }, [blockId, farmerId, blockHealth, cropPerformance, soilMoisture, issues, measurements, recommendationGroups]);

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

        const draft = loadVisitDraft(blockId);
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
              }))
            );
          }
          if (draft.recommendationGroups?.length) {
            setRecommendationGroups(draft.recommendationGroups);
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
    if (!visitPhotos.length) {
      setCapturePhotoType(initialCapturePhotoType(cropType));
    }
  }, [cropType, visitPhotos.length]);

  useEffect(() => {
    const t = setTimeout(() => {
      persistDraft();
    }, 800);
    return () => clearTimeout(t);
  }, [persistDraft]);

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
    return validateVisitWizardStep(current, validationContext());
  }

  function missingAssessments(): string | null {
    if (!blockHealth || !cropPerformance || !soilMoisture) {
      return 'Select block health, crop performance, and soil moisture on the Overview step before submitting.';
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
    const next = getNextWizardStep(step, validationContext());
    if (next) setStep(next);
  }

  function goBack() {
    setError('');
    const prev = getPrevWizardStep(step, validationContext());
    if (prev) setStep(prev);
  }

  async function captureGps() {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is not supported in this browser.');
      return;
    }
    setGpsLoading(true);
    setGpsStatus('Getting location…');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
      });
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

      const issuePayload = mergeVisitPhotosIntoIssues(issues, visitPhotos);
      const visitPhotoPayload = visitPhotos.map((p) => ({
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
        recApproved: recApproved || undefined,
        compatibilityOverrideReason: compatibilityOverrideReason.trim() || undefined,
        compatibilityOverridePairs: compatibilityOverridePairs.length ? compatibilityOverridePairs : undefined,
      });

      if (sessionRef.current) {
        await agronomistClient.checkOutVisitSession(sessionRef.current, {
          latitude: gpsLat ?? undefined,
          longitude: gpsLon ?? undefined,
          fieldFindingId: visitResult.findingId,
        });
      }

      clearVisitDraft(blockId);

      const successParams = new URLSearchParams({
        farmerName,
        blockName,
        findingId: visitResult.findingId,
      });
      if (visitResult.recommendationIds.length) {
        successParams.set('recommendationAdded', String(visitResult.recommendationIds.length));
      }
      navigate(`${toPath(paths.agronomistVisitSuccess)}?${successParams.toString()}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Starting visit session…" />;

  const stepIndex = getVisibleWizardSteps().indexOf(step);

  return (
    <div className="vw-page">
      <VisitWizardStepper current={step} />

      {triage ? (
        <div className="vw-triage-badge" style={{ marginBottom: 12 }}>
          <span className="priority-badge">Triage {triage.level}</span>
          <span className="muted" style={{ marginLeft: 8 }}>
            {triage.route} · {triage.reason}
          </span>
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {!canWrite ? <Alert tone="warn">Read-only — you cannot submit visits.</Alert> : null}

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

      {step === 'fieldIntelligence' ? (
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
          farmerId={farmerId}
          blockId={blockId}
          issues={issues}
          issueMaster={issueMaster}
          cropType={cropType}
          onChange={setIssues}
        />
      ) : null}

      {step === 'additionalPhotos' ? (
        <VisitAdditionalPhotosStep issues={issues} onChange={setIssues} />
      ) : null}

      {step === 'finalDiagnosis' ? <VisitFinalDiagnosisStep issues={issues} onChange={setIssues} /> : null}

      {step === 'economicOptimizer' ? (
        <VisitEconomicOptimizerStep
          issueLabel={issues[0]?.finalDiagnosis ?? issues[0]?.issueName ?? 'Field issue'}
          cropType={cropType}
          selectedId={selectedRecOptionId}
          onSelect={setSelectedRecOptionId}
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
          onApprovedChange={(approved, reason, pairs) => {
            setRecApproved(approved);
            setCompatibilityOverrideReason(reason ?? '');
            setCompatibilityOverridePairs(pairs ?? []);
          }}
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

      <footer className="vw-footer">
        {stepIndex > 0 ? (
          <div className="vw-footer-btn">
            <Btn variant="secondary" className="w-full" onClick={goBack}>
              Back
            </Btn>
          </div>
        ) : null}
        <div className="vw-footer-btn">
          {step === 'caseClosure' ? (
            <Btn variant="primary" className="w-full" onClick={() => void submit()} disabled={saving || !canWrite}>
              {saving ? 'Submitting…' : 'Submit visit'}
            </Btn>
          ) : (
            <Btn variant="primary" className="w-full" onClick={goNext}>
              Continue
            </Btn>
          )}
        </div>
      </footer>
    </div>
  );
}
