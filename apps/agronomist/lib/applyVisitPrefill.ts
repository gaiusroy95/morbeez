import type { RecommendationVisitContext } from '@morbeez/shared';
import type { VisitPhotoDraft } from '@/components/field-findings/wizard/types';
import { remoteImageToVisitPhotoDraft } from './prefillVisitPhotos';

/** Apply visit prefill from recommendation or escalation context. */
export async function applyVisitPrefillContext(ctx: RecommendationVisitContext): Promise<{
  fieldVoiceNote: string;
  issues: Array<{ issueName: string; observation: string }>;
  photos: VisitPhotoDraft[];
}> {
  const fieldVoiceNote = [ctx.symptomsText, ctx.aiDiagnosis ? `AI diagnosis: ${ctx.aiDiagnosis}` : null]
    .filter(Boolean)
    .join('\n')
    .trim();

  const issueName = ctx.issueDetected?.trim() || ctx.aiDiagnosis?.trim() || '';
  const issues = issueName
    ? [
        {
          issueName,
          observation:
            ctx.recommendationText?.slice(0, 500) ||
            ctx.symptomsText?.slice(0, 500) ||
            `Verify AI diagnosis: ${issueName}`,
        },
      ]
    : [];

  const photos: VisitPhotoDraft[] = [];
  for (let i = 0; i < ctx.images.length; i++) {
    const img = ctx.images[i]!;
    const defaultType = i === 0 ? 'whole_field' : 'leaf';
    const draft = await remoteImageToVisitPhotoDraft(img.url, defaultType, img.caption);
    if (draft) {
      photos.push({ ...draft, aiTagged: true });
    }
  }

  return { fieldVoiceNote, issues, photos };
}
