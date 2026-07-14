/**
 * Durable photo + chat context for an active WhatsApp diagnosis thread.
 * Every refine / conversational analysis must reload these — not text alone.
 */
import { downloadAdvisoryImageBase64 } from '../../core/advisory-image-storage.service.js';
import { supabase } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';
import { conversationSessionService } from '../conversation-session.service.js';
import type { DiagnosisPending, SessionContext } from '../scenarios/session-context.types.js';

export type DiagnosisTranscriptRole = 'farmer' | 'assistant' | 'system';

export type DiagnosisTranscriptEntry = {
  role: DiagnosisTranscriptRole;
  text: string;
  at: string;
};

const MAX_TRANSCRIPT = 40;
const MAX_PHOTOS = 6;
const MAX_ENTRY_CHARS = 500;

function uniqPaths(paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const t = p.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= MAX_PHOTOS) break;
  }
  return out;
}

function trimEntry(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_ENTRY_CHARS);
}

export const diagnosisSessionEvidenceService = {
  collectPendingPhotoPaths(ctx: SessionContext): string[] {
    const paths: string[] = [];
    if (ctx.pendingDiagnosisImagePath) paths.push(ctx.pendingDiagnosisImagePath);
    for (const b of ctx.pendingDiagnosisImageBatch ?? []) {
      if (b.path) paths.push(b.path);
    }
    for (const p of ctx.diagnosis?.photoPaths ?? []) {
      if (p) paths.push(p);
    }
    const maiosPaths =
      ctx.maiosCase?.evidence?.photos
        ?.filter((ph) => ph.status === 'captured' && ph.storagePath)
        .map((ph) => String(ph.storagePath)) ?? [];
    paths.push(...maiosPaths);
    return uniqPaths(paths);
  },

  async rememberPhotoPaths(farmerId: string, paths: string[]): Promise<string[]> {
    const cleaned = uniqPaths(paths);
    if (!cleaned.length) return [];
    const ctx = await conversationSessionService.getContext(farmerId);
    const merged = uniqPaths([...(ctx.diagnosis?.photoPaths ?? []), ...cleaned]);
    const diagnosis: DiagnosisPending = {
      imageCount: Math.max(ctx.diagnosis?.imageCount ?? 0, merged.length),
      ...ctx.diagnosis,
      photoPaths: merged,
    };
    await conversationSessionService.patchContext(farmerId, { diagnosis });
    return merged;
  },

  async appendTranscript(
    farmerId: string,
    role: DiagnosisTranscriptRole,
    text: string
  ): Promise<void> {
    const trimmed = trimEntry(text);
    if (!trimmed) return;
    const ctx = await conversationSessionService.getContext(farmerId);
    const prev = ctx.diagnosis?.transcript ?? [];
    const entry: DiagnosisTranscriptEntry = {
      role,
      text: trimmed,
      at: new Date().toISOString(),
    };
    const transcript = [...prev, entry].slice(-MAX_TRANSCRIPT);
    const diagnosis: DiagnosisPending = {
      imageCount: ctx.diagnosis?.imageCount ?? 0,
      ...ctx.diagnosis,
      transcript,
    };
    await conversationSessionService.patchContext(farmerId, { diagnosis });
  },

  async appendQaPair(
    farmerId: string,
    question: string,
    answer: string
  ): Promise<void> {
    const q = trimEntry(question);
    const a = trimEntry(answer);
    if (q) await this.appendTranscript(farmerId, 'assistant', `Q: ${q}`);
    if (a) await this.appendTranscript(farmerId, 'farmer', `A: ${a}`);
  },

  /**
   * Persist session id + photos + optional summary onto the active diagnosis thread.
   */
  async bindSession(
    farmerId: string,
    sessionId: string,
    options?: {
      photoPaths?: string[];
      summary?: string;
      dosageItems?: DiagnosisPending['dosageItems'];
    }
  ): Promise<void> {
    const ctx = await conversationSessionService.getContext(farmerId);
    const fromPending = this.collectPendingPhotoPaths(ctx);
    const photoPaths = uniqPaths([
      ...(options?.photoPaths ?? []),
      ...fromPending,
      ...(ctx.diagnosis?.photoPaths ?? []),
    ]);

    // Also mirror onto advisory session metadata for durable reload by sessionId.
    if (photoPaths.length) {
      try {
        const { data: sess } = await supabase
          .from('ai_advisory_sessions')
          .select('metadata')
          .eq('id', sessionId)
          .maybeSingle();
        const meta = (sess?.metadata ?? {}) as Record<string, unknown>;
        await supabase
          .from('ai_advisory_sessions')
          .update({
            metadata: {
              ...meta,
              diagnosis_photo_paths: photoPaths,
            },
          })
          .eq('id', sessionId);
      } catch (err) {
        logger.warn({ err, sessionId }, 'Failed to persist diagnosis_photo_paths on session');
      }
    }

    const diagnosis: DiagnosisPending = {
      imageCount: Math.max(ctx.diagnosis?.imageCount ?? 0, photoPaths.length || 1),
      ...ctx.diagnosis,
      lastSessionId: sessionId,
      photoPaths,
      ...(options?.summary
        ? { lastAdvisorySummary: options.summary.slice(0, 800) }
        : {}),
      ...(options?.dosageItems ? { dosageItems: options.dosageItems } : {}),
    };
    await conversationSessionService.patchContext(farmerId, {
      diagnosis,
      lastAdvisorySessionId: sessionId,
    });
  },

  async resolvePhotoPaths(params: {
    farmerId?: string | null;
    sessionId?: string | null;
  }): Promise<string[]> {
    const paths: string[] = [];

    if (params.farmerId) {
      const ctx = await conversationSessionService.getContext(params.farmerId);
      paths.push(...this.collectPendingPhotoPaths(ctx));
    }

    if (params.sessionId) {
      const { data: sess } = await supabase
        .from('ai_advisory_sessions')
        .select('image_storage_path, metadata')
        .eq('id', params.sessionId)
        .maybeSingle();
      if (sess?.image_storage_path) paths.push(String(sess.image_storage_path));
      const meta = (sess?.metadata ?? {}) as Record<string, unknown>;
      if (Array.isArray(meta.diagnosis_photo_paths)) {
        for (const p of meta.diagnosis_photo_paths) {
          if (typeof p === 'string') paths.push(p);
        }
      }
    }

    return uniqPaths(paths);
  },

  async loadImages(params: {
    farmerId?: string | null;
    sessionId?: string | null;
  }): Promise<Array<{ imageBase64: string; mimeType: string; path: string }>> {
    const paths = await this.resolvePhotoPaths(params);
    const images: Array<{ imageBase64: string; mimeType: string; path: string }> = [];
    for (const path of paths.slice(0, 4)) {
      const downloaded = await downloadAdvisoryImageBase64(path);
      if (!downloaded) {
        logger.warn({ path }, 'Diagnosis evidence: photo download failed');
        continue;
      }
      images.push({
        imageBase64: downloaded.base64,
        mimeType: downloaded.mimeType,
        path,
      });
    }
    return images;
  },

  formatTranscript(entries: DiagnosisTranscriptEntry[] | undefined | null, max = 24): string {
    if (!entries?.length) return '';
    return entries
      .slice(-max)
      .map((e) => {
        const who =
          e.role === 'farmer' ? 'Farmer' : e.role === 'assistant' ? 'Assistant' : 'System';
        return `${who}: ${e.text}`;
      })
      .join('\n');
  },

  async getTranscript(farmerId: string): Promise<DiagnosisTranscriptEntry[]> {
    const ctx = await conversationSessionService.getContext(farmerId);
    return ctx.diagnosis?.transcript ?? [];
  },

  /**
   * Prompt block: photo status + diagnosis-thread chat (intake Q&A, farmer corrections).
   */
  async formatEvidenceForPrompt(params: {
    farmerId: string;
    sessionId?: string | null;
  }): Promise<string> {
    const ctx = await conversationSessionService.getContext(params.farmerId);
    const sessionId =
      params.sessionId ?? ctx.diagnosis?.lastSessionId ?? ctx.lastAdvisorySessionId ?? null;
    const photoPaths = await this.resolvePhotoPaths({
      farmerId: params.farmerId,
      sessionId,
    });
    const transcript = this.formatTranscript(ctx.diagnosis?.transcript, 30);
    const summary = ctx.diagnosis?.lastAdvisorySummary?.trim();

    const lines = [
      'ACTIVE DIAGNOSIS EVIDENCE (always use — do not ignore photos or prior chat):',
      `Session id: ${sessionId ?? 'unknown'}`,
      `Crop photos on file: ${photoPaths.length} (paths retained; vision calls must reload them)`,
      summary ? `Last advisory summary: ${summary.slice(0, 500)}` : null,
      transcript
        ? `Diagnosis-thread chat (farmer + assistant follow-ups):\n${transcript}`
        : 'Diagnosis-thread chat: (none yet — use general recent WhatsApp turns if present)',
    ].filter(Boolean);

    return lines.join('\n');
  },
};
