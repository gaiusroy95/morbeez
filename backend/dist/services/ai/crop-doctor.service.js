import { supabase } from '../../lib/supabase.js';
import { eventBus } from '../../events/bus.js';
import { farmerService } from '../farmer/farmer.service.js';
import { aiLogService } from './ai-log.service.js';
import { CROP_DOCTOR_SYSTEM_PROMPT, buildUserPrompt, } from './prompts/crop-doctor.system.js';
import { openaiVisionProvider, openaiTextAdvisory } from './providers/openai.provider.js';
import { plantIdProvider, formatPlantIdSummary } from './providers/plantid.provider.js';
import { recommendationService } from './recommendation.service.js';
import { escalationService } from './escalation.service.js';
import { farmerExperienceLearningService } from '../core/farmer-experience-learning.service.js';
import { env } from '../../config/env.js';
import { aiReuseService, buildSymptomKey, hasDiagnosisMedia } from './ai-reuse.service.js';
import { whatsappDiagnosisRendererService } from '../whatsapp/pipeline/whatsapp-diagnosis-renderer.service.js';
import { computeDap } from '../whatsapp/broadcasts/dap.service.js';
import { recommendationRecordsService } from '../core/recommendation-records.service.js';
import { isOpenAiQuotaAppError, logOpenAiQuotaInsufficient } from './openai-quota.service.js';
import { advisoryFromKnowledgeText, knowledgeFallbackService, } from '../whatsapp/pipeline/knowledge-fallback.service.js';
import { farmerMemoryService } from '../whatsapp/pipeline/farmer-memory.service.js';
import { leadService } from '../crm/lead.service.js';
import { whatsappDiagnosisContextService } from '../whatsapp/pipeline/whatsapp-diagnosis-context.service.js';
import { normalizeStructuredAdvisory } from './advisory-normalize.js';
import { caseBuilderService } from '../case/case-builder.service.js';
import { casePersistService } from '../case/case-persist.service.js';
async function getFarmerHistory(farmerId) {
    const { data } = await supabase
        .from('disease_history')
        .select('issue_label, severity, recorded_at')
        .eq('farmer_id', farmerId)
        .order('recorded_at', { ascending: false })
        .limit(5);
    if (!data?.length)
        return 'No prior disease history.';
    return data.map((d) => `- ${d.issue_label} (${d.severity ?? 'unknown'})`).join('\n');
}
async function persistOutput(sessionId, advisory, provider, language) {
    await supabase.from('ai_advisory_outputs').insert({
        session_id: sessionId,
        provider,
        language,
        probable_issue: advisory.probableIssue,
        nutrient_deficiency: advisory.nutrientDeficiency,
        stress_analysis: advisory.stressAnalysis,
        treatment_recommendations: advisory.treatments,
        dosage_guidance: advisory.dosageGuidance,
        precautions: advisory.precautions,
        farmer_summary_en: advisory.farmerSummaryEn,
        farmer_summary_ml: advisory.farmerSummaryMl,
        raw_response: advisory,
        model_version: env.OPENAI_VISION_MODEL,
    });
}
async function persistRecommendations(sessionId, recs) {
    if (!recs.length)
        return;
    await supabase.from('ai_product_recommendations').insert(recs.map((r) => ({
        session_id: sessionId,
        shopify_product_handle: r.shopifyProductHandle ?? null,
        product_title: r.productTitle,
        reason: r.reason,
        dosage_schedule: r.dosageSchedule ?? null,
        priority: r.priority,
        combo_kit_id: r.comboKitId ?? null,
    })));
}
export const cropDoctorService = {
    async diagnose(input) {
        const { data: session, error: sessionErr } = await supabase
            .from('ai_advisory_sessions')
            .insert({
            farmer_id: input.farmerId,
            channel: input.channel,
            crop_type: input.cropType,
            crop_stage: input.cropStage ?? null,
            language: input.language,
            symptoms_text: input.symptomsText ?? null,
            voice_transcript: input.voiceTranscript ?? null,
            image_storage_path: input.imageStoragePath ?? null,
            status: 'processing',
            metadata: {
                ...(input.contextPack ?? {}),
                investigationPattern: input.investigationPattern ?? undefined,
            },
        })
            .select()
            .single();
        if (sessionErr)
            throw sessionErr;
        const sessionId = session.id;
        void (async () => {
            const { weatherSnapshotService } = await import('../core/weather-snapshot.service.js');
            const blockId = input.activePlotId ?? null;
            await weatherSnapshotService.capture({
                farmerId: input.farmerId,
                blockId,
                eventType: 'ai_session',
                eventId: sessionId,
            });
        })();
        const skipReuse = input.skipReuseCache === true ||
            Boolean(input.fieldInvestigation?.trim()) ||
            hasDiagnosisMedia(input);
        const reused = skipReuse ? null : await aiReuseService.tryReuse(input, sessionId);
        if (reused) {
            reused.advisory = normalizeStructuredAdvisory(reused.advisory);
            await persistRecommendations(sessionId, reused.productRecommendations);
            await supabase.from('disease_history').insert({
                farmer_id: input.farmerId,
                session_id: sessionId,
                crop_type: input.cropType,
                issue_label: reused.advisory.probableIssue,
                severity: reused.advisory.confidence < 0.5 ? 'high' : reused.advisory.confidence < 0.7 ? 'medium' : 'low',
            });
            const { escalated, escalationId, confidence } = await escalationService.createIfNeeded({
                sessionId,
                farmerId: input.farmerId,
                advisory: reused.advisory,
                plantId: null,
            });
            await supabase
                .from('ai_advisory_sessions')
                .update({
                status: escalated ? 'escalated' : 'completed',
                confidence_score: confidence,
                updated_at: new Date().toISOString(),
            })
                .eq('id', sessionId);
            await eventBus.publish('advisory.completed', {
                sessionId,
                farmerId: input.farmerId,
                escalated,
                escalationId,
                confidence: reused.advisory.confidence,
                reused: true,
            }, 'crop-doctor');
            if (input.imageStoragePath) {
                const { cropImageReviewService } = await import('../core/crop-image-review.service.js');
                void cropImageReviewService.enqueueFromSession({
                    sessionId,
                    farmerId: input.farmerId,
                    storagePath: input.imageStoragePath,
                    cropType: input.cropType,
                    blockId: input.activePlotId ?? null,
                    symptoms: input.symptomsText ? [input.symptomsText.slice(0, 200)] : [],
                    aiPrediction: reused.advisory.probableIssue,
                    aiConfidence: confidence,
                });
            }
            return { ...reused, reused: true, escalationId, confidence };
        }
        let plantIdResult = null;
        const farmerHistory = input.compactHistory ?? (await getFarmerHistory(input.farmerId));
        if (input.imageBase64 && env.PLANT_ID_API_KEY) {
            const started = Date.now();
            try {
                plantIdResult = await plantIdProvider.assessHealth({ imageBase64: input.imageBase64 });
                await aiLogService.logRequest({
                    sessionId,
                    provider: 'plantid',
                    endpoint: 'health_assessment',
                    latencyMs: Date.now() - started,
                    success: true,
                });
                await supabase
                    .from('ai_advisory_sessions')
                    .update({ plant_id_result: plantIdResult.raw })
                    .eq('id', sessionId);
            }
            catch (err) {
                await aiLogService.logRequest({
                    sessionId,
                    provider: 'plantid',
                    endpoint: 'health_assessment',
                    latencyMs: Date.now() - started,
                    success: false,
                    errorMessage: String(err),
                });
            }
        }
        const plantIdSummary = plantIdResult ? formatPlantIdSummary(plantIdResult) : undefined;
        const verifiedRegionalHints = await farmerExperienceLearningService
            .getVerifiedRegionalHints(input.farmerId, input.cropType)
            .catch(() => null);
        const morbeezFieldContext = input.morbeezFieldContext ??
            (await whatsappDiagnosisContextService.buildFieldContext({
                farmerId: input.farmerId,
                blockId: input.activePlotId,
                cropType: input.cropType,
                issueName: input.issueLabelHint ?? input.symptomsText?.slice(0, 80) ?? 'field issue',
                observation: input.symptomsText ?? input.voiceTranscript,
            }));
        const fullUserPrompt = buildUserPrompt({
            cropType: input.cropType,
            cropStage: input.cropStage,
            symptomsText: input.symptomsText,
            voiceTranscript: input.voiceTranscript,
            plantIdSummary,
            farmerHistory,
            whatsappContext: input.compactHistory,
            verifiedRegionalHints: verifiedRegionalHints ?? undefined,
            environmentalContext: input.environmentalContext,
            morbeezFieldContext: morbeezFieldContext ?? undefined,
            fieldInvestigation: input.fieldInvestigation,
            issueLabelHint: input.issueLabelHint,
            language: input.language,
            photoCount: input.diagnosisImages?.length ?? (input.imageBase64 ? 1 : 0),
        });
        let advisory;
        const visionStarted = Date.now();
        try {
            if (input.imageBase64 && input.imageMimeType) {
                const additionalImages = (input.diagnosisImages ?? [])
                    .slice(1)
                    .filter((img) => img.imageBase64)
                    .map((img) => ({
                    imageBase64: img.imageBase64,
                    mimeType: img.imageMimeType,
                }));
                advisory = await openaiVisionProvider.analyzeVision({
                    imageBase64: input.imageBase64,
                    mimeType: input.imageMimeType,
                    systemPrompt: CROP_DOCTOR_SYSTEM_PROMPT,
                    userPrompt: fullUserPrompt,
                    additionalImages: additionalImages.length ? additionalImages : undefined,
                });
                advisory = normalizeStructuredAdvisory(advisory);
                if (!whatsappDiagnosisRendererService.hasImageEvidence(advisory) &&
                    !whatsappDiagnosisRendererService.hasRichSections(advisory)) {
                    const retryPrompt = `${fullUserPrompt}\n\nCRITICAL: You MUST populate imageObservations with specific visible features from the attached photo (colour, pattern, leaf age, spread). Do not answer from memory or generic templates alone. Populate differentialDiagnosis and dosageGuidance when treatment applies.`;
                    advisory = await openaiVisionProvider.analyzeVision({
                        imageBase64: input.imageBase64,
                        mimeType: input.imageMimeType,
                        systemPrompt: CROP_DOCTOR_SYSTEM_PROMPT,
                        userPrompt: retryPrompt,
                        additionalImages: additionalImages.length ? additionalImages : undefined,
                    });
                }
            }
            else {
                advisory = await openaiTextAdvisory(CROP_DOCTOR_SYSTEM_PROMPT, fullUserPrompt);
            }
            await aiLogService.logRequest({
                sessionId,
                provider: 'openai',
                endpoint: input.imageBase64 ? 'vision' : 'text',
                latencyMs: Date.now() - visionStarted,
                success: true,
            });
        }
        catch (err) {
            await aiLogService.logRequest({
                sessionId,
                provider: 'openai',
                endpoint: input.imageBase64 ? 'vision' : 'text',
                latencyMs: Date.now() - visionStarted,
                success: false,
                errorMessage: String(err),
            });
            if (isOpenAiQuotaAppError(err)) {
                logOpenAiQuotaInsufficient('crop-doctor', { isQuotaIssue: true, message: String(err) });
                const symptomText = [input.symptomsText, input.voiceTranscript].filter(Boolean).join('\n');
                const memory = await farmerMemoryService.build(input.farmerId, {
                    symptomsText: symptomText || undefined,
                });
                const kb = await knowledgeFallbackService.tryReply({
                    farmerId: input.farmerId,
                    text: symptomText || input.compactHistory || 'crop problem',
                    language: input.language,
                    memory,
                    hasMedia: hasDiagnosisMedia(input),
                });
                if (kb) {
                    advisory = advisoryFromKnowledgeText(kb, input.language);
                    await aiLogService.logRequest({
                        sessionId,
                        provider: 'knowledge_fallback',
                        endpoint: 'text',
                        latencyMs: Date.now() - visionStarted,
                        success: true,
                    });
                }
            }
            if (!advisory) {
                await supabase.from('ai_advisory_sessions').update({ status: 'failed' }).eq('id', sessionId);
                throw err;
            }
        }
        if (!advisory) {
            await supabase.from('ai_advisory_sessions').update({ status: 'failed' }).eq('id', sessionId);
            throw new Error('Crop Doctor produced no advisory');
        }
        advisory = normalizeStructuredAdvisory(advisory);
        const ctxPack = input.contextPack;
        let maiosCase = null;
        const photoCount = input.maiosPhotoCount ??
            input.gingerSopPhotoCount ??
            (input.imageBase64 ? 1 : 0);
        const photoPaths = input.maiosPhotoPaths ?? input.gingerSopPhotoPaths;
        const intakeConf = input.maiosIntakeConfidence ?? input.gingerSopIntakeConfidence;
        const hasSoil = input.maiosHasSoilReport ?? input.gingerSopHasSoilReport;
        if (env.ENABLE_MAIOS_V12 !== false) {
            maiosCase = await caseBuilderService.buildCase({
                farmerId: input.farmerId,
                blockId: input.activePlotId,
                cropType: input.cropType,
                channel: input.channel === 'telecaller' ? 'telecaller' : input.channel,
                sessionId,
                symptomsText: input.symptomsText,
                photoCount,
                photoStoragePaths: photoPaths,
                hasSoilReport: hasSoil,
                hasFieldInvestigation: Boolean(input.fieldInvestigation?.trim()),
                intakeMatchConfidence: intakeConf,
                contextPack: ctxPack
                    ? {
                        soilPh: ctxPack.soilPh,
                        soilEc: ctxPack.soilEc,
                        weatherRiskScore: ctxPack.weatherRiskScore,
                        heavyRainLikely: ctxPack.heavyRainLikely,
                        highHeatLikely: ctxPack.highHeatLikely,
                        highHumidityLikely: ctxPack.highHumidityLikely,
                        drainageRisk: ctxPack.drainageRisk,
                        dap: ctxPack.dap,
                    }
                    : undefined,
                advisory: {
                    probableIssue: advisory.probableIssue,
                    confidence: advisory.confidence,
                    severity: advisory.severity,
                    uncertain: advisory.uncertain,
                    escalationRecommended: advisory.escalationRecommended,
                    differentialDiagnosis: advisory.differentialDiagnosis,
                    causalChain: advisory.causalChain,
                    explanation: advisory.explanation,
                    rejectedHypotheses: advisory.rejectedHypotheses,
                    recommendedProductTags: advisory.recommendedProductTags,
                },
            });
            if (maiosCase) {
                advisory.confidence = maiosCase.diagnostics.fusedConfidence;
                if (maiosCase.route === 'field_visit' ||
                    maiosCase.route === 'emergency_callback') {
                    advisory.escalationRecommended = true;
                    advisory.escalationReason =
                        advisory.escalationReason ??
                            `MAIOS v12 route: ${maiosCase.route} (${maiosCase.triage.level})`;
                }
            }
        }
        else {
            maiosCase = await caseBuilderService.buildCase({
                farmerId: input.farmerId,
                blockId: input.activePlotId,
                cropType: input.cropType || '_default',
                channel: input.channel === 'telecaller' ? 'telecaller' : input.channel,
                sessionId,
                symptomsText: input.symptomsText,
                photoCount,
                photoStoragePaths: photoPaths,
                hasSoilReport: hasSoil,
                hasFieldInvestigation: Boolean(input.fieldInvestigation?.trim()),
                intakeMatchConfidence: intakeConf,
                contextPack: ctxPack
                    ? {
                        soilPh: ctxPack.soilPh,
                        soilEc: ctxPack.soilEc,
                        weatherRiskScore: ctxPack.weatherRiskScore,
                        heavyRainLikely: ctxPack.heavyRainLikely,
                        highHeatLikely: ctxPack.highHeatLikely,
                        highHumidityLikely: ctxPack.highHumidityLikely,
                        drainageRisk: ctxPack.drainageRisk,
                        dap: ctxPack.dap,
                    }
                    : undefined,
                advisory: {
                    probableIssue: advisory.probableIssue,
                    confidence: advisory.confidence,
                    severity: advisory.severity,
                    uncertain: advisory.uncertain,
                    escalationRecommended: advisory.escalationRecommended,
                    differentialDiagnosis: advisory.differentialDiagnosis,
                    causalChain: advisory.causalChain,
                    explanation: advisory.explanation,
                    rejectedHypotheses: advisory.rejectedHypotheses,
                    recommendedProductTags: advisory.recommendedProductTags,
                },
            });
            if (maiosCase) {
                advisory.confidence = maiosCase.diagnostics.fusedConfidence;
            }
        }
        await persistOutput(sessionId, advisory, 'openai', input.language);
        const productRecommendations = recommendationService.recommend(input.cropType, advisory);
        await persistRecommendations(sessionId, productRecommendations);
        const { escalated, escalationId, confidence } = await escalationService.createIfNeeded({
            sessionId,
            farmerId: input.farmerId,
            advisory,
            plantId: plantIdResult,
        });
        if (maiosCase) {
            maiosCase.sessionId = sessionId;
            await casePersistService.persistToSession(sessionId, maiosCase);
        }
        await supabase
            .from('ai_advisory_sessions')
            .update({
            status: escalated ? 'escalated' : 'completed',
            confidence_score: confidence,
            updated_at: new Date().toISOString(),
        })
            .eq('id', sessionId);
        await supabase.from('disease_history').insert({
            farmer_id: input.farmerId,
            session_id: sessionId,
            crop_type: input.cropType,
            issue_label: advisory.probableIssue,
            severity: advisory.confidence < 0.5 ? 'high' : advisory.confidence < 0.7 ? 'medium' : 'low',
        });
        await eventBus.publish('advisory.completed', { sessionId, farmerId: input.farmerId, escalated, confidence }, 'crop-doctor');
        if (input.imageStoragePath) {
            const { cropImageReviewService } = await import('../core/crop-image-review.service.js');
            void cropImageReviewService.enqueueFromSession({
                sessionId,
                farmerId: input.farmerId,
                storagePath: input.imageStoragePath,
                cropType: input.cropType,
                blockId: input.activePlotId ?? null,
                symptoms: input.symptomsText ? [input.symptomsText.slice(0, 200)] : [],
                aiPrediction: advisory.probableIssue,
                aiConfidence: confidence,
            });
        }
        const { data: farmerRow } = await supabase
            .from('farmers')
            .select('district')
            .eq('id', input.farmerId)
            .maybeSingle();
        const { data: cropRow } = await supabase
            .from('farm_blocks')
            .select('planting_date, created_at')
            .eq('farmer_id', input.farmerId)
            .order('is_primary', { ascending: false })
            .limit(1)
            .maybeSingle();
        const dap = computeDap(cropRow?.planting_date, cropRow?.created_at);
        await aiReuseService.indexSuccessfulCase({
            sessionId,
            farmerId: input.farmerId,
            cropType: input.cropType,
            district: farmerRow?.district ? String(farmerRow.district).toLowerCase() : null,
            dap,
            symptomKey: buildSymptomKey(input.symptomsText, input.voiceTranscript, input.compactHistory),
            advisory,
            products: productRecommendations,
            escalated,
        });
        const activeBlockId = input.activePlotId;
        const recText = input.language === 'ml' && advisory.farmerSummaryMl
            ? advisory.farmerSummaryMl
            : advisory.farmerSummaryEn || advisory.probableIssue;
        const firstProduct = productRecommendations[0];
        const technicalName = firstProduct && typeof firstProduct === 'object' && 'activeIngredient' in firstProduct
            ? String(firstProduct.activeIngredient ?? '')
            : undefined;
        const tradeName = firstProduct && typeof firstProduct === 'object' && 'productTitle' in firstProduct
            ? String(firstProduct.productTitle ?? '')
            : undefined;
        await recommendationRecordsService.create({
            farmerId: input.farmerId,
            blockId: activeBlockId ?? undefined,
            aiSessionId: sessionId,
            source: 'ai',
            issueDetected: advisory.probableIssue,
            recommendationText: recText,
            products: productRecommendations,
            dosage: advisory.dosageGuidance?.[0]?.rate,
            applicationType: advisory.dosageGuidance?.[0]?.method,
            language: input.language,
            status: 'draft',
            technicalName: technicalName || undefined,
            tradeName: tradeName || undefined,
            severity: advisory.confidence < 0.5 ? 'high' : advisory.confidence < 0.7 ? 'medium' : 'low',
        });
        return {
            sessionId,
            advisory,
            productRecommendations,
            escalated,
            escalationId,
            confidence: maiosCase?.diagnostics.fusedConfidence ?? confidence,
            maiosCase: maiosCase ?? undefined,
        };
    },
    async scheduleFollowUp(farmerId, sessionId, language) {
        const followUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('advisory_automation_jobs').insert({
            farmer_id: farmerId,
            session_id: sessionId,
            job_type: 'whatsapp_follow_up',
            scheduled_at: followUpAt,
            payload: { language },
        });
    },
    async getSession(sessionId) {
        const { data, error } = await supabase
            .from('ai_advisory_sessions')
            .select(`*, ai_advisory_outputs(*), ai_product_recommendations(*), agronomist_escalations(*)`)
            .eq('id', sessionId)
            .single();
        if (error || !data)
            throw error;
        return data;
    },
    async requestCallback(sessionId, farmerId) {
        await leadService.ensureLeadForFarmer({
            farmerId,
            intent: 'callback',
            source: 'crop_doctor',
            status: 'new',
            priority: 'high',
            stage: 'follow_up',
            notes: `Crop doctor session ${sessionId}`,
            mergeNotes: true,
        });
        await supabase.from('advisory_automation_jobs').insert({
            farmer_id: farmerId,
            session_id: sessionId,
            job_type: 'callback_reminder',
            scheduled_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            payload: { sessionId },
        });
        await eventBus.publish('callback.requested', { farmerId, sessionId }, 'crop-doctor');
    },
    async diagnoseByPhone(params) {
        const farmer = await farmerService.upsertByPhone({
            phone: params.phone,
            name: params.name,
            preferredLanguage: params.language,
            source: params.channel,
        });
        return this.diagnose({
            farmerId: farmer.id,
            cropType: params.cropType,
            cropStage: params.cropStage,
            language: params.language,
            symptomsText: params.symptomsText,
            voiceTranscript: params.voiceTranscript,
            imageBase64: params.imageBase64,
            imageMimeType: params.imageMimeType,
            channel: params.channel,
        });
    },
};
//# sourceMappingURL=crop-doctor.service.js.map