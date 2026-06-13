import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  agronomistClient,
  tokens,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type IssueCategory,
  type IssueMasterRow,
  type MeasurementTemplate,
  type SoilMoistureLevel,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, Loading, Panel } from '@morbeez/ui-native';
import { BlockAssessmentSection } from '@/components/field-findings/BlockAssessmentSection';
import { FollowUpSection, type FollowUpDraft } from '@/components/field-findings/FollowUpSection';
import { IssueCard, IssueCategoryPicker, type IssueDraft } from '@/components/field-findings/IssueCard';
import { MeasurementFields } from '@/components/field-findings/MeasurementFields';
import { VisitContextHeader } from '@/components/field-findings/VisitContextHeader';
import { useStaffAuth } from '@/context/StaffAuth';
import { clearVisitDraft, loadVisitDraft, saveVisitDraft } from '@/lib/visitDraft';

function newIssue(category: IssueCategory, localId: string): IssueDraft {
  return {
    localId,
    category,
    issueName: '',
    severity: 'medium',
    status: 'open',
    observation: '',
    photos: [],
    photosPreview: [],
  };
}

export default function VisitScreen() {
  const router = useRouter();
  const { canWrite, admin } = useStaffAuth();
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
  const [blockDap, setBlockDap] = useState<number | null>(null);
  const [templates, setTemplates] = useState<MeasurementTemplate[]>([]);
  const [issueMaster, setIssueMaster] = useState<IssueMasterRow[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<IssueCategory[]>([]);
  const [issues, setIssues] = useState<IssueDraft[]>([]);
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
      selectedCategories,
      issues: issues.map(({ localId, photosPreview, ...rest }) => rest),
      measurements,
      savedAt: new Date().toISOString(),
    });
  }, [
    blockId,
    farmerId,
    blockHealth,
    cropPerformance,
    soilMoisture,
    selectedCategories,
    issues,
    measurements,
  ]);

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
          setSelectedCategories(draft.selectedCategories ?? []);
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

  function toggleCategory(category: IssueCategory) {
    setSelectedCategories((prev) => {
      const exists = prev.includes(category);
      if (exists) {
        setIssues((iss) => iss.filter((i) => i.category !== category));
        return prev.filter((c) => c !== category);
      }
      const localId = `${category}-${Date.now()}`;
      setIssues((iss) => [...iss, newIssue(category, localId)]);
      return [...prev, category];
    });
  }

  function updateIssue(localId: string, next: IssueDraft) {
    setIssues((prev) => prev.map((i) => (i.localId === localId ? next : i)));
  }

  function removeIssue(localId: string, category: IssueCategory) {
    setIssues((prev) => {
      const remaining = prev.filter((i) => i.localId !== localId);
      if (!remaining.some((i) => i.category === category)) {
        setSelectedCategories((cats) => cats.filter((c) => c !== category));
      }
      return remaining;
    });
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
    if (!blockHealth || !cropPerformance || !soilMoisture) {
      setError('Complete block assessment (health, performance, moisture).');
      return;
    }
    if (!issues.length) {
      setError('Add at least one issue.');
      return;
    }
    for (const issue of issues) {
      if (!issue.issueName.trim()) {
        setError(`Each issue needs a name (${issue.category}).`);
        return;
      }
    }
    for (const tpl of templates) {
      if (tpl.required && !measurements[tpl.measurementKey]?.trim()) {
        setError(`Required measurement: ${tpl.labelEn}`);
        return;
      }
    }
    if (selectedCategories.length !== issues.length) {
      setError('Each selected issue category needs a named issue card.');
      return;
    }
    if (followUps.length) {
      const pending = followUps.filter(
        (f) => f.outcome === 'not_reviewed' && f.followed === 'not_applicable'
      );
      if (pending.length) {
        setError('Record follow-up outcomes for open recommendations on this block.');
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

      const visitResult = await agronomistClient.submitStructuredVisit({
        farmerId,
        blockId,
        sessionId: sessionRef.current ?? undefined,
        blockAssessment: { blockHealth, cropPerformance, soilMoisture },
        measurements: measurementRows,
        issues: issues.map(({ localId, photosPreview, ...issue }) => issue),
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

  return (
    <KeyboardAwareScrollScreen contentContainerStyle={styles.content}>
      <VisitContextHeader
        farmerName={farmerName}
        blockName={blockName}
        cropType={cropType}
        dap={blockDap}
        agronomistName={admin?.email ?? null}
      />

      {error ? <AlertBox>{error}</AlertBox> : null}

      <BlockAssessmentSection
        blockHealth={blockHealth}
        cropPerformance={cropPerformance}
        soilMoisture={soilMoisture}
        onBlockHealth={setBlockHealth}
        onCropPerformance={setCropPerformance}
        onSoilMoisture={setSoilMoisture}
      />

      <IssueCategoryPicker selected={selectedCategories} onToggle={toggleCategory} />

      {issues.map((issue) => (
        <IssueCard
          key={issue.localId}
          issue={issue}
          issueMaster={issueMaster}
          cropType={cropType}
          onChange={(next) => updateIssue(issue.localId, next)}
          onRemove={() => removeIssue(issue.localId, issue.category)}
          onSuggestQuestions={() =>
            agronomistClient.suggestIssueFollowUpQuestions({
              issueCategory: issue.category,
              issueName: issue.issueName || issue.category,
              cropType,
              dap: blockDap ?? undefined,
              observation: issue.observation,
              photoCount: issue.photos?.length ?? 0,
            })
          }
        />
      ))}

      <MeasurementFields
        templates={templates}
        values={measurements}
        onChange={(key, value) => setMeasurements((prev) => ({ ...prev, [key]: value }))}
      />

      <FollowUpSection
        items={followUps}
        onChange={(index, next) => setFollowUps((prev) => prev.map((f, i) => (i === index ? next : f)))}
      />

      <Panel title="Plot GPS">
        <Text style={styles.hint}>Stand at the plot and capture GPS for accurate weather advice.</Text>
        {gpsStatus ? <Text style={styles.gpsStatus}>{gpsStatus}</Text> : null}
        <Btn
          label={gpsLoading ? 'Getting location…' : gpsLat != null ? 'Update GPS' : 'Capture plot GPS'}
          onPress={captureGps}
          disabled={!canWrite || gpsLoading}
          variant="secondary"
        />
      </Panel>

      <Btn label={saving ? 'Uploading…' : 'Submit visit'} onPress={submit} disabled={saving || !canWrite} />
    </KeyboardAwareScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  gpsStatus: { fontSize: 13, color: tokens.green700, marginBottom: 8 },
});
