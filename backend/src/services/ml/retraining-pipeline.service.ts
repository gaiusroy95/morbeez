import { supabase } from '../../lib/supabase.js';
import { trainingExportService } from '../core/training-export.service.js';

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
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: sessions } = await supabase
      .from('ai_advisory_sessions')
      .select('corrected, human_reviewed, metadata')
      .gte('created_at', since.toISOString())
      .not('metadata->maiosCase', 'is', null)
      .limit(500);

    let total = 0;
    let corrected = 0;
    let d14Improved = 0;
    let d14Total = 0;

    for (const s of sessions ?? []) {
      total++;
      if (s.corrected || s.human_reviewed) corrected++;
      const mc = (s.metadata as Record<string, unknown>)?.maiosCase as {
        outcomes?: Array<{ day: number; status: string }>;
      } | undefined;
      const d14 = mc?.outcomes?.find((o) => o.day >= 14);
      if (d14) {
        d14Total++;
        if (d14.status === 'improved') d14Improved++;
      }
    }

    const accuracy = total ? Math.round(((total - corrected) / total) * 1000) / 10 : 0;
    const falsePositiveRate = total ? Math.round((corrected / total) * 1000) / 10 : 0;
    const recoveryRate = d14Total ? Math.round((d14Improved / d14Total) * 1000) / 10 : 0;

    return { accuracy, falsePositiveRate, recoveryRate };
  },
};

export const retrainingPipelineService = {
  async runWeekly(): Promise<{ exported: number; status: string }> {
    const { data: pending } = await supabase
      .from('ml_gold_queue')
      .select('id')
      .eq('status', 'pending')
      .limit(200);

    const stats = await trainingExportService.getDashboardStats().catch(() => null);
    const evalResult = await modelEvalService.runEval();

    for (const row of pending ?? []) {
      await supabase
        .from('ml_gold_queue')
        .update({ status: 'exported', metadata: { eval: evalResult, stats } })
        .eq('id', row.id);
    }

    return {
      exported: pending?.length ?? 0,
      status: 'exported',
    };
  },
};
