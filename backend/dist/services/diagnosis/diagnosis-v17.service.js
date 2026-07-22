import { supabase } from '../../lib/supabase.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { farmerService } from '../farmer/farmer.service.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { maiosKnowledgeService } from '../maios-reasoning/knowledge.service.js';
import { maiosReasoningPipelineService } from '../maios-reasoning/maios-reasoning-pipeline.service.js';
import { visitVisionObservationsService } from '../maios-reasoning/visit-vision-observations.service.js';
import { maiosLearningFacadeService } from '../maios-reasoning/maios-learning-facade.service.js';
function sessionMeta(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const v17 = raw.v17Diagnosis;
    if (!v17 || typeof v17 !== 'object')
        return null;
    const m = v17;
    return m.version === '17.0' && m.lastSnapshot ? m : null;
}
function seedHypotheses(cropType, suspectedIssue) {
    const pkg = maiosKnowledgeService.load(cropType);
    if (suspectedIssue?.trim()) {
        return [{ label: suspectedIssue.trim(), probability: 55, source: 'M5' }];
    }
    return pkg.diseaseLabels.slice(0, 3).map((label, i) => ({
        label,
        probability: i === 0 ? 35 : 20 - i * 5,
        source: 'M5',
    }));
}
function photosFromCount(count, pack) {
    if (count <= 0)
        return [];
    return pack.photoSlots.slice(0, count).map((slot, i) => ({
        slot: slot.id,
        status: 'captured',
        qualityScore: i === 0 ? 78 : 72,
    }));
}
function estimateEqs(photoCount, answerCount) {
    return Math.min(88, 40 + photoCount * 14 + answerCount * 6);
}
async function resolveFarmerId(input) {
    if (input.farmerId)
        return input.farmerId;
    if (!input.phone)
        throw new ValidationError('Provide farmerId or phone');
    const farmer = await farmerService.upsertByPhone({
        phone: input.phone,
        name: input.name,
        preferredLanguage: input.language ?? 'en',
        source: 'api',
    });
    return farmer.id;
}
async function runPipeline(meta) {
    const pack = await cropPackLoaderService.load(meta.cropType);
    const hypotheses = seedHypotheses(meta.cropType, meta.visionLabel ?? undefined);
    const photos = photosFromCount(meta.photoCount ?? 0, pack);
    const eqs = estimateEqs(meta.photoCount ?? 0, meta.farmerAnswers.length);
    const snapshot = await maiosReasoningPipelineService.run({
        cropType: meta.cropType,
        pack,
        symptomsText: meta.symptomsText,
        contextPack: meta.contextPack,
        photos,
        hypotheses,
        eqs,
        maiosRoute: 'auto_recommend',
        visionLabel: meta.visionLabel,
        visionConfidence: meta.visionConfidence,
        visionObservations: meta.visionLabel
            ? visitVisionObservationsService.inferFromLabel(meta.visionLabel, meta.visionConfidence ?? 0.75)
            : undefined,
        farmerAnswers: meta.farmerAnswers,
        answeredQuestionIds: meta.answeredQuestionIds,
        dap: meta.contextPack?.dap,
    });
    if (!snapshot?.finalReport) {
        throw new Error('Reasoning pipeline did not produce a final report');
    }
    return {
        ...meta,
        lastSnapshot: snapshot,
    };
}
function toStartResponse(sessionId, meta) {
    const snap = meta.lastSnapshot;
    return {
        sessionId,
        pipelineVersion: '17.0',
        decision: snap.decision,
        explanation: snap.explanation,
        nextEvidence: snap.nextEvidence,
        posterior: snap.posterior,
        finalReport: snap.finalReport,
        management: snap.management,
        safety: snap.safety,
    };
}
/** v17 evidence-driven diagnosis API — Bayesian engine owns probability; no LLM ranking. */
export const diagnosisV17Service = {
    async start(input) {
        if (!maiosReasoningPipelineService.isEnabled()) {
            throw new ValidationError('MAIOS reasoning pipeline is disabled');
        }
        if (!input.symptomsText?.trim() && !input.visionLabel?.trim()) {
            throw new ValidationError('Provide symptomsText or visionLabel');
        }
        const farmerId = await resolveFarmerId(input);
        const baseMeta = {
            version: '17.0',
            cropType: input.cropType,
            symptomsText: input.symptomsText,
            farmerAnswers: [],
            answeredQuestionIds: [],
            contextPack: input.contextPack,
            visionLabel: input.visionLabel ?? input.suspectedIssue ?? null,
            visionConfidence: input.visionConfidence,
            photoCount: input.photoCount ?? 0,
        };
        const meta = await runPipeline(baseMeta);
        const { data: session, error } = await supabase
            .from('ai_advisory_sessions')
            .insert({
            farmer_id: farmerId,
            channel: 'api',
            crop_type: input.cropType,
            language: input.language ?? 'en',
            symptoms_text: input.symptomsText ?? null,
            status: meta.lastSnapshot.decision.action === 'LOCK' ? 'completed' : 'processing',
            metadata: { v17Diagnosis: meta, source: 'diagnosis_v17' },
        })
            .select('id')
            .single();
        if (error)
            throw error;
        const sessionId = String(session.id);
        if (meta.lastSnapshot.decision.action === 'LOCK') {
            void maiosLearningFacadeService.recordFromReasoningSnapshot({
                farmerId,
                cropType: input.cropType,
                sessionId,
                channel: 'api',
                snapshot: meta.lastSnapshot,
            });
        }
        return toStartResponse(sessionId, meta);
    },
    async submitAnswers(sessionId, input) {
        const { data: session, error } = await supabase
            .from('ai_advisory_sessions')
            .select('id, metadata, status')
            .eq('id', sessionId)
            .maybeSingle();
        if (error)
            throw error;
        if (!session)
            throw new NotFoundError('Diagnosis session not found');
        const existing = sessionMeta(session.metadata);
        if (!existing)
            throw new ValidationError('Session is not a v17 diagnosis session');
        const answered = new Set(existing.answeredQuestionIds);
        for (const ans of input.answers) {
            if (ans.questionId)
                answered.add(ans.questionId);
        }
        const meta = await runPipeline({
            ...existing,
            farmerAnswers: [...existing.farmerAnswers, ...input.answers],
            answeredQuestionIds: [...answered],
        });
        await supabase
            .from('ai_advisory_sessions')
            .update({
            status: meta.lastSnapshot.decision.action === 'LOCK' ? 'completed' : 'processing',
            metadata: { ...session.metadata, v17Diagnosis: meta },
            updated_at: new Date().toISOString(),
        })
            .eq('id', sessionId);
        if (meta.lastSnapshot.decision.action === 'LOCK') {
            const { data: sessionRow } = await supabase
                .from('ai_advisory_sessions')
                .select('farmer_id, crop_type')
                .eq('id', sessionId)
                .maybeSingle();
            if (sessionRow?.farmer_id) {
                void maiosLearningFacadeService.recordFromReasoningSnapshot({
                    farmerId: String(sessionRow.farmer_id),
                    cropType: String(sessionRow.crop_type ?? existing.cropType),
                    sessionId,
                    channel: 'api',
                    snapshot: meta.lastSnapshot,
                });
            }
        }
        return toStartResponse(sessionId, meta);
    },
    async getReport(sessionId) {
        const { data: session, error } = await supabase
            .from('ai_advisory_sessions')
            .select('id, metadata')
            .eq('id', sessionId)
            .maybeSingle();
        if (error)
            throw error;
        if (!session)
            throw new NotFoundError('Diagnosis session not found');
        const meta = sessionMeta(session.metadata);
        if (!meta?.lastSnapshot.finalReport) {
            throw new NotFoundError('No v17 report available for this session');
        }
        return {
            sessionId,
            report: meta.lastSnapshot.finalReport,
            decision: meta.lastSnapshot.decision,
        };
    },
};
//# sourceMappingURL=diagnosis-v17.service.js.map