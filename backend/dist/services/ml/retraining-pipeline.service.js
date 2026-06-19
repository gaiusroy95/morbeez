import { supabase } from '../../lib/supabase.js';
export const goldLearningQueueService = {
    async enqueue(params) {
        await supabase.from('ml_gold_queue').insert({
            session_id: params.sessionId,
            crop_type: params.cropType,
            district: params.district,
            failure_type: params.failureType,
            metadata: params.metadata ?? {},
            status: 'pending',
        });
    },
};
export const modelEvalService = {
    async runEval() {
        return { accuracy: 0, falsePositiveRate: 0, recoveryRate: 0 };
    },
};
export const retrainingPipelineService = {
    async runWeekly() {
        return { exported: 0, status: 'queued' };
    },
};
//# sourceMappingURL=retraining-pipeline.service.js.map