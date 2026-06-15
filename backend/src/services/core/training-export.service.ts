import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';

export type TrainingDataset = 'events' | 'images' | 'samples' | 'weather';
export type ExportFormat = 'json' | 'csv';
export type QaEntityType = 'training_event' | 'crop_image';
export type QaFlag = 'needs_review' | 'approved' | 'excluded';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function labelsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isCorrectionAction(action: string | null | undefined): boolean {
  return action === 'correct_ai' || action === 'partial_match' || action === 'partial';
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

function weatherFields(
  ctx: Record<string, unknown> | null | undefined,
  snap: Record<string, unknown> | null | undefined
) {
  const c = ctx ?? {};
  return {
    rainfallMm: snap?.rainfall_mm ?? c.rainfall_mm ?? '',
    rainfallForecastMm: snap?.rainfall_mm_forecast ?? c.rainfall_mm_forecast ?? '',
    humidityPct: snap?.humidity_pct ?? c.humidity_pct ?? '',
    temperatureC: snap?.temperature_c ?? c.temperature_c ?? '',
    weatherRiskScore: snap?.weather_risk_score ?? c.weather_risk_score ?? '',
    diseaseAlerts: JSON.stringify(snap?.disease_alerts ?? c.disease_alerts ?? []),
    locationLabel: snap?.location_label ?? c.location_label ?? '',
  };
}

async function loadWeatherMap(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Record<string, unknown>>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase.from('weather_snapshots').select('*').in('id', unique);
  throwIfSupabaseError(error, 'Could not load weather snapshots for export');
  for (const row of data ?? []) {
    map.set(String(row.id), row as Record<string, unknown>);
  }
  return map;
}

function mapTrainingEventRow(
  r: Record<string, unknown>,
  snap?: Record<string, unknown> | null
) {
  const meta = (r.metadata as Record<string, unknown>) ?? {};
  const block = r.farm_blocks as { crop_name?: string; crop_type?: string } | null;
  const crop = block?.crop_name ?? block?.crop_type ?? null;
  const aiPred = r.ai_prediction ? String(r.ai_prediction) : null;
  const humanLabel = r.human_final_label ? String(r.human_final_label) : null;
  const w = weatherFields(
    (meta.weatherContext as Record<string, unknown>) ?? null,
    snap ?? null
  );
  return {
    id: String(r.id),
    reviewedAt: String(r.reviewed_at ?? r.created_at),
    reviewSurface: String(r.review_surface),
    source: String(r.source),
    farmerId: String(r.farmer_id),
    blockId: r.block_id ? String(r.block_id) : '',
    crop: crop ?? '',
    aiPrediction: aiPred ?? '',
    aiConfidence: r.ai_confidence != null ? Number(r.ai_confidence) : '',
    humanAction: r.human_action ? String(r.human_action) : '',
    humanFinalLabel: humanLabel ?? '',
    labelMatch: labelsMatch(aiPred, humanLabel) ? 'true' : 'false',
    correctionReason: r.correction_reason ? String(r.correction_reason) : '',
    confidenceBefore: r.confidence_before != null ? Number(r.confidence_before) : '',
    confidenceAfter: r.confidence_after != null ? Number(r.confidence_after) : '',
    reviewedBy: r.reviewed_by ? String(r.reviewed_by) : '',
    qaFlag: meta.qaFlag ? String(meta.qaFlag) : '',
    weatherSnapshotId: meta.weatherSnapshotId ? String(meta.weatherSnapshotId) : '',
    ...w,
  };
}

function mapCropImageRow(r: Record<string, unknown>) {
  const meta = (r.metadata as Record<string, unknown>) ?? {};
  const snapRaw = r.weather_snapshots as Record<string, unknown> | Record<string, unknown>[] | null;
  const snap = Array.isArray(snapRaw) ? snapRaw[0] : snapRaw;
  const aiPred = r.ai_prediction ? String(r.ai_prediction) : null;
  const agLabel = r.agronomist_label ? String(r.agronomist_label) : null;
  const w = weatherFields(null, snap);
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    source: String(r.source),
    farmerId: String(r.farmer_id),
    blockId: r.block_id ? String(r.block_id) : '',
    crop: r.crop ? String(r.crop) : '',
    dap: r.dap != null ? Number(r.dap) : '',
    aiPrediction: aiPred ?? '',
    aiConfidence: r.ai_confidence != null ? Number(r.ai_confidence) : '',
    agronomistLabel: agLabel ?? '',
    labelMatch: labelsMatch(aiPred, agLabel) ? 'true' : 'false',
    severity: r.severity ? String(r.severity) : '',
    reviewStatus: String(r.review_status),
    reviewAction: r.review_action ? String(r.review_action) : '',
    symptoms: JSON.stringify(r.symptoms ?? []),
    externalUrl: r.external_url ? String(r.external_url) : '',
    storagePath: r.storage_path ? String(r.storage_path) : '',
    qaFlag: meta.qaFlag ? String(meta.qaFlag) : '',
    weatherSnapshotId: r.weather_snapshot_id ? String(r.weather_snapshot_id) : '',
    ...w,
  };
}

function mapWeatherSnapshotRow(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    capturedAt: String(r.captured_at),
    eventType: String(r.event_type),
    eventId: r.event_id ? String(r.event_id) : '',
    farmerId: r.farmer_id ? String(r.farmer_id) : '',
    blockId: r.block_id ? String(r.block_id) : '',
    locationLabel: r.location_label ? String(r.location_label) : '',
    rainfallMm: r.rainfall_mm != null ? Number(r.rainfall_mm) : '',
    rainfallForecastMm: r.rainfall_mm_forecast != null ? Number(r.rainfall_mm_forecast) : '',
    humidityPct: r.humidity_pct != null ? Number(r.humidity_pct) : '',
    temperatureC: r.temperature_c != null ? Number(r.temperature_c) : '',
    weatherRiskScore: r.weather_risk_score != null ? Number(r.weather_risk_score) : '',
    diseaseAlerts: JSON.stringify(r.disease_alerts ?? []),
  };
}

function mapLearningSampleRow(r: Record<string, unknown>) {
  const weather = (r.weather_context as Record<string, unknown>) ?? {};
  const w = weatherFields(weather, null);
  const issueRaw = r.visit_issues as Record<string, unknown> | Record<string, unknown>[] | null;
  const issue = Array.isArray(issueRaw) ? issueRaw[0] : issueRaw;
  const findingRaw = r.crm_field_findings as Record<string, unknown> | Record<string, unknown>[] | null;
  const finding = Array.isArray(findingRaw) ? findingRaw[0] : findingRaw;
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    farmerId: String(r.farmer_id),
    recommendationRecordId: r.recommendation_record_id ? String(r.recommendation_record_id) : '',
    fieldFindingId: r.field_finding_id ? String(r.field_finding_id) : '',
    visitIssueId: r.visit_issue_id ? String(r.visit_issue_id) : '',
    cropType: r.crop_type ? String(r.crop_type) : '',
    diseaseLabel: r.disease_label ? String(r.disease_label) : '',
    issueCategory: issue?.issue_category ? String(issue.issue_category) : '',
    issueName: issue?.issue_name ? String(issue.issue_name) : '',
    blockHealth: finding?.block_health ? String(finding.block_health) : '',
    cropPerformance: finding?.crop_performance ? String(finding.crop_performance) : '',
    soilMoisture: finding?.soil_moisture ? String(finding.soil_moisture) : '',
    dap: r.dap != null ? Number(r.dap) : '',
    severity: r.severity ? String(r.severity) : '',
    outcome: r.outcome ? String(r.outcome) : '',
    applicationConfirmed:
      r.application_confirmed == null ? '' : r.application_confirmed ? 'true' : 'false',
    escalated: r.escalated ? 'true' : 'false',
    ...w,
  };
}

export const trainingExportService = {
  async getDashboardStats(days = 30) {
    const since = daysAgoIso(days);

    const [eventsRes, imagesRes, samplesRes, outcomesRes] = await Promise.all([
      supabase
        .from('ai_training_events')
        .select('human_action, review_surface, ai_prediction, human_final_label, metadata')
        .gte('reviewed_at', since),
      supabase
        .from('crop_images')
        .select('review_status, review_action, ai_prediction, agronomist_label')
        .gte('created_at', since),
      supabase.from('ai_learning_samples').select('outcome, escalated').gte('created_at', since),
      supabase
        .from('recommendation_records')
        .select('outcome, issue_resolved')
        .gte('created_at', since)
        .not('outcome', 'is', null),
    ]);

    throwIfSupabaseError(eventsRes.error, 'Could not load training events stats');
    throwIfSupabaseError(imagesRes.error, 'Could not load crop image stats');
    throwIfSupabaseError(samplesRes.error, 'Could not load learning sample stats');
    throwIfSupabaseError(outcomesRes.error, 'Could not load outcome stats');

    const events = eventsRes.data ?? [];
    const images = imagesRes.data ?? [];
    const samples = samplesRes.data ?? [];
    const outcomes = outcomesRes.data ?? [];

    let corrections = 0;
    let approvals = 0;
    let labelMatches = 0;
    let labelComparable = 0;
    let qaNeedsReview = 0;
    const bySurface: Record<string, number> = {};

    for (const e of events) {
      const action = String(e.human_action ?? '');
      const surface = String(e.review_surface ?? 'unknown');
      bySurface[surface] = (bySurface[surface] ?? 0) + 1;
      if (action === 'approve_ai' || action === 'confirm_ai') approvals += 1;
      if (isCorrectionAction(action)) corrections += 1;
      const meta = (e.metadata as Record<string, unknown>) ?? {};
      if (meta.qaFlag === 'needs_review') qaNeedsReview += 1;
      if (e.ai_prediction && e.human_final_label) {
        labelComparable += 1;
        if (labelsMatch(String(e.ai_prediction), String(e.human_final_label))) labelMatches += 1;
      }
    }

    let imagesPending = 0;
    let imagesReviewed = 0;
    let imageCorrections = 0;
    for (const img of images) {
      const status = String(img.review_status ?? '');
      if (status === 'pending') imagesPending += 1;
      if (status === 'reviewed') imagesReviewed += 1;
      if (img.review_action === 'correct_ai') imageCorrections += 1;
    }

    const outcomeCounts = { better: 0, partial: 0, no_improvement: 0, unknown: 0 };
    let issueResolvedCount = 0;
    for (const o of outcomes) {
      const out = String(o.outcome ?? 'unknown');
      if (out in outcomeCounts) outcomeCounts[out as keyof typeof outcomeCounts] += 1;
      if (o.issue_resolved) issueResolvedCount += 1;
    }
    const outcomeTotal = outcomes.length;
    const outcomeSuccessPct = pct(
      outcomeCounts.better + outcomeCounts.partial,
      outcomeTotal
    );

    let samplesWithOutcome = 0;
    for (const s of samples) {
      if (s.outcome && String(s.outcome) !== 'unknown') samplesWithOutcome += 1;
    }

    return {
      periodDays: days,
      since,
      trainingEvents: {
        total: events.length,
        corrections,
        approvals,
        correctionRatePct: pct(corrections, events.length),
        labelAccuracyPct: pct(labelMatches, labelComparable),
        qaNeedsReview,
        bySurface,
      },
      cropImages: {
        total: images.length,
        pending: imagesPending,
        reviewed: imagesReviewed,
        correctionRatePct: pct(imageCorrections, imagesReviewed || images.length),
      },
      learningSamples: {
        total: samples.length,
        withOutcome: samplesWithOutcome,
        outcomeCoveragePct: pct(samplesWithOutcome, samples.length),
      },
      recommendationOutcomes: {
        total: outcomeTotal,
        counts: outcomeCounts,
        issueResolvedCount,
        successRatePct: outcomeSuccessPct,
      },
    };
  },

  async listQaFlags(limit = 40) {
    const flags: Array<{
      entityType: QaEntityType;
      entityId: string;
      reason: string;
      aiLabel: string | null;
      humanLabel: string | null;
      reviewedAt: string | null;
      qaFlag: string | null;
    }> = [];

    const { data: events, error: evErr } = await supabase
      .from('ai_training_events')
      .select(
        'id, reviewed_at, ai_prediction, human_final_label, human_action, metadata, review_surface'
      )
      .order('reviewed_at', { ascending: false })
      .limit(200);
    throwIfSupabaseError(evErr, 'Could not load training events for QA');

    for (const e of events ?? []) {
      const meta = (e.metadata as Record<string, unknown>) ?? {};
      const qaFlag = meta.qaFlag ? String(meta.qaFlag) : null;
      const aiPred = e.ai_prediction ? String(e.ai_prediction) : null;
      const human = e.human_final_label ? String(e.human_final_label) : null;
      const action = String(e.human_action ?? '');

      let reason: string | null = null;
      if (qaFlag === 'needs_review') reason = 'Flagged for QA review';
      else if (!human?.trim() && isCorrectionAction(action)) {
        reason = 'Correction without final label';
      } else if (aiPred && human && !labelsMatch(aiPred, human) && action !== 'exclude') {
        reason = 'AI label differs from human label';
      }

      if (reason) {
        flags.push({
          entityType: 'training_event',
          entityId: String(e.id),
          reason,
          aiLabel: aiPred,
          humanLabel: human,
          reviewedAt: e.reviewed_at ? String(e.reviewed_at) : null,
          qaFlag,
        });
      }
      if (flags.length >= limit) break;
    }

    if (flags.length < limit) {
      const { data: images, error: imgErr } = await supabase
        .from('crop_images')
        .select(
          'id, created_at, ai_prediction, agronomist_label, review_status, review_action, metadata'
        )
        .in('review_status', ['pending', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(150);
      throwIfSupabaseError(imgErr, 'Could not load images for QA');

      for (const img of images ?? []) {
        const meta = (img.metadata as Record<string, unknown>) ?? {};
        const qaFlag = meta.qaFlag ? String(meta.qaFlag) : null;
        const aiPred = img.ai_prediction ? String(img.ai_prediction) : null;
        const agLabel = img.agronomist_label ? String(img.agronomist_label) : null;
        const status = String(img.review_status ?? '');

        let reason: string | null = null;
        if (qaFlag === 'needs_review') reason = 'Flagged for QA review';
        else if (status === 'pending') reason = 'Image pending review';
        else if (img.review_action === 'correct_ai' && !agLabel?.trim()) {
          reason = 'Corrected without agronomist label';
        } else if (aiPred && agLabel && !labelsMatch(aiPred, agLabel)) {
          reason = 'AI label differs from agronomist label';
        }

        if (reason) {
          flags.push({
            entityType: 'crop_image',
            entityId: String(img.id),
            reason,
            aiLabel: aiPred,
            humanLabel: agLabel,
            reviewedAt: img.created_at ? String(img.created_at) : null,
            qaFlag,
          });
        }
        if (flags.length >= limit) break;
      }
    }

    return { flags: flags.slice(0, limit), total: flags.length };
  },

  async setQaFlag(params: {
    entityType: QaEntityType;
    entityId: string;
    flag: QaFlag;
    notes?: string;
    reviewedBy: string;
  }) {
    const now = new Date().toISOString();
    const table = params.entityType === 'training_event' ? 'ai_training_events' : 'crop_images';

    const { data: existing, error: loadErr } = await supabase
      .from(table)
      .select('metadata')
      .eq('id', params.entityId)
      .maybeSingle();
    throwIfSupabaseError(loadErr, 'Could not load record for QA flag');
    if (!existing) throw new NotFoundError('Record not found');

    const metadata = {
      ...((existing.metadata as Record<string, unknown>) ?? {}),
      qaFlag: params.flag,
      qaNotes: params.notes?.trim() || null,
      qaReviewedAt: now,
      qaReviewedBy: params.reviewedBy,
    };

    const { error } = await supabase.from(table).update({ metadata }).eq('id', params.entityId);
    throwIfSupabaseError(error, 'Could not update QA flag');
    return { ok: true, entityType: params.entityType, entityId: params.entityId, flag: params.flag };
  },

  async exportDataset(params: {
    dataset: TrainingDataset | 'all';
    format: ExportFormat;
    since?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 2000, 1), 10000);
    const since = params.since ?? daysAgoIso(365);

    const exportOne = async (dataset: TrainingDataset) => {
      if (dataset === 'events') {
        const { data, error } = await supabase
          .from('ai_training_events')
          .select('*, farm_blocks(crop_name, crop_type)')
          .gte('reviewed_at', since)
          .order('reviewed_at', { ascending: false })
          .limit(limit);
        throwIfSupabaseError(error, 'Could not export training events');
        const rows = data ?? [];
        const snapIds = rows
          .map((r) => {
            const meta = (r.metadata as Record<string, unknown>) ?? {};
            return meta.weatherSnapshotId ? String(meta.weatherSnapshotId) : '';
          })
          .filter(Boolean);
        const weatherMap = await loadWeatherMap(snapIds);
        return rows.map((r) => {
          const meta = (r.metadata as Record<string, unknown>) ?? {};
          const sid = meta.weatherSnapshotId ? String(meta.weatherSnapshotId) : '';
          return mapTrainingEventRow(
            r as Record<string, unknown>,
            sid ? weatherMap.get(sid) : null
          );
        });
      }
      if (dataset === 'images') {
        const { data, error } = await supabase
          .from('crop_images')
          .select('*, weather_snapshots(*)')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit);
        throwIfSupabaseError(error, 'Could not export crop images');
        return (data ?? []).map((r) => mapCropImageRow(r as Record<string, unknown>));
      }
      if (dataset === 'weather') {
        const { data, error } = await supabase
          .from('weather_snapshots')
          .select('*')
          .gte('captured_at', since)
          .order('captured_at', { ascending: false })
          .limit(limit);
        throwIfSupabaseError(error, 'Could not export weather snapshots');
        return (data ?? []).map((r) => mapWeatherSnapshotRow(r as Record<string, unknown>));
      }
      const { data, error } = await supabase
        .from('ai_learning_samples')
        .select('*, visit_issues(issue_name, issue_category, severity), crm_field_findings(block_health, crop_performance, soil_moisture)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);
      throwIfSupabaseError(error, 'Could not export learning samples');
      return (data ?? []).map((r) => mapLearningSampleRow(r as Record<string, unknown>));
    };

    const datasets: TrainingDataset[] =
      params.dataset === 'all'
        ? ['events', 'images', 'samples', 'weather']
        : [params.dataset];

    if (params.format === 'json') {
      const payload: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        since,
        limit,
      };
      for (const ds of datasets) {
        payload[ds] = await exportOne(ds);
      }
      const { data: reuseRows } = await supabase.from('advisory_reuse_cases').select('source_type');
      const reuseBySource: Record<string, number> = {};
      for (const row of reuseRows ?? []) {
        const key = String(row.source_type ?? 'ai_session');
        reuseBySource[key] = (reuseBySource[key] ?? 0) + 1;
      }
      payload.reuseCaseStats = reuseBySource;
      const { data: visitAiRows, error: visitAiErr } = await supabase
        .from('visit_ai_cases')
        .select(
          `*, visit_ai_hypotheses(label, confidence, selected, image_prediction, image_confidence),
           visit_ai_questions(question_text, answer_type, answer, metadata),
           visit_ai_recommendations(ai_text, human_text, review_action, review_after_days, recommendation_record_id),
           crm_field_findings(
             visited_at, block_id, block_health, crop_performance, soil_moisture,
             visit_issues(id, issue_name, severity, observation, issue_photos(storage_path, photo_type)),
             visit_photos(storage_path, photo_type),
             visit_measurements(measurement_key, value, unit)
           )`
        )
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!visitAiErr) {
        const recIds = (visitAiRows ?? [])
          .flatMap((r) =>
            ((r.visit_ai_recommendations as Array<{ recommendation_record_id?: string }> | null) ?? [])
              .map((rec) => rec.recommendation_record_id)
              .filter(Boolean)
          )
          .map(String);
        const outcomeByRec = new Map<string, string>();
        if (recIds.length) {
          const { data: recOutcomes } = await supabase
            .from('recommendation_records')
            .select('id, outcome, application_status')
            .in('id', recIds);
          for (const row of recOutcomes ?? []) {
            outcomeByRec.set(String(row.id), String(row.outcome ?? row.application_status ?? ''));
          }
        }

        payload.visitAiCases = (visitAiRows ?? []).map((r) => {
          const finding = r.crm_field_findings as {
            visited_at?: string;
            block_id?: string;
            block_health?: string;
            crop_performance?: string;
            soil_moisture?: string;
            visit_issues?: Array<{
              issue_name?: string;
              severity?: string;
              observation?: string;
              issue_photos?: Array<{ storage_path?: string; photo_type?: string }>;
            }>;
            visit_photos?: Array<{ storage_path?: string; photo_type?: string }>;
            visit_measurements?: Array<{ measurement_key?: string; value?: string; unit?: string }>;
          } | null;
          const linkedRecId = (
            (r.visit_ai_recommendations as Array<{ recommendation_record_id?: string }> | null) ?? []
          )[0]?.recommendation_record_id;
          return {
            id: String(r.id),
            category: String(r.category),
            issueName: String(r.issue_name),
            finalDiagnosis: r.final_diagnosis ? String(r.final_diagnosis) : '',
            finalConfidence: r.final_confidence != null ? Number(r.final_confidence) : '',
            status: String(r.status),
            hypotheses: JSON.stringify(r.visit_ai_hypotheses ?? []),
            questions: JSON.stringify(r.visit_ai_questions ?? []),
            recommendations: JSON.stringify(r.visit_ai_recommendations ?? []),
            metadata: JSON.stringify(r.metadata ?? {}),
            visitedAt: finding?.visited_at ?? String(r.created_at),
            blockAssessment: JSON.stringify({
              blockHealth: finding?.block_health ?? null,
              cropPerformance: finding?.crop_performance ?? null,
              soilMoisture: finding?.soil_moisture ?? null,
            }),
            measurements: JSON.stringify(finding?.visit_measurements ?? []),
            visitPhotos: JSON.stringify(finding?.visit_photos ?? []),
            issuePhotos: JSON.stringify(finding?.visit_issues?.[0]?.issue_photos ?? []),
            weatherSnapshotId: (r.metadata as Record<string, unknown>)?.weatherSnapshotId ?? null,
            outcome: linkedRecId ? outcomeByRec.get(String(linkedRecId)) ?? null : null,
          };
        });
      }
      return {
        contentType: 'application/json',
        filename: `morbeez-training-export-${new Date().toISOString().slice(0, 10)}.json`,
        body: JSON.stringify(payload, null, 2),
      };
    }

    const ds = datasets[0];
    const rows = await exportOne(ds);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const csv = rowsToCsv(headers, rows);
    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `morbeez-training-${ds}-${new Date().toISOString().slice(0, 10)}.csv`,
      body: csv,
    };
  },
};
