import { supabase } from '../../lib/supabase.js';

export const goldLearningQueueService = {
  async enqueue(params: {
    sessionId: string;
    cropType?: string;
    district?: string;
    failureType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
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
  async runEval(): Promise<{ accuracy: number; falsePositiveRate: number; recoveryRate: number }> {
    return { accuracy: 0, falsePositiveRate: 0, recoveryRate: 0 };
  },
};

export const retrainingPipelineService = {
  async runWeekly(): Promise<{ exported: number; status: string }> {
    return { exported: 0, status: 'queued' };
  },
};
