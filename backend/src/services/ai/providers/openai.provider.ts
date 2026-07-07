import { env } from '../../../config/env.js';
import { AppError } from '../../../lib/errors.js';
import { logger } from '../../../lib/logger.js';
import {
  logOpenAiQuotaInsufficient,
  parseOpenAiHttpError,
} from '../openai-quota.service.js';
import type { StructuredAdvisory } from '../types.js';
import { normalizeStructuredAdvisory } from '../advisory-normalize.js';
import type { TranscriptionInput, TranscriptionProvider, VisionInput, VisionProvider } from './base.provider.js';
import { openaiTokenLimitBody } from './openai-chat-params.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

async function openaiFetch(path: string, init: RequestInit): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    throw new AppError('OpenAI not configured', 503, 'OPENAI_NOT_CONFIGURED');
  }
  return fetch(`${OPENAI_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      ...(init.headers as Record<string, string>),
    },
  });
}

function parseStructuredJson(content: string): StructuredAdvisory {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError('Invalid AI response format', 502, 'AI_PARSE_ERROR');
  }
  const parsed = JSON.parse(jsonMatch[0]) as StructuredAdvisory & { label?: string };
  if (!parsed.probableIssue?.trim() && parsed.label?.trim()) {
    parsed.probableIssue = parsed.label.trim();
  }
  return normalizeStructuredAdvisory(parsed);
}

export const openaiVisionProvider: VisionProvider = {
  name: 'openai',

  async analyzeVision(input: VisionInput): Promise<StructuredAdvisory> {
    const model = env.OPENAI_VISION_MODEL;
    const imageParts = [
      {
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
      },
      ...(input.additionalImages ?? []),
    ].map((img) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.imageBase64}`,
        detail: 'high' as const,
      },
    }));

    const body = {
      model,
      ...openaiTokenLimitBody(model, 3000),
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.systemPrompt },
        {
          role: 'user',
          content: [{ type: 'text', text: input.userPrompt }, ...imageParts],
        },
      ],
    };

    const started = Date.now();
    const res = await openaiFetch('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      const quota = parseOpenAiHttpError(res.status, text);
      if (quota.isQuotaIssue) {
        logOpenAiQuotaInsufficient('openai-vision', quota);
      } else {
        logger.error({ status: res.status, text }, 'OpenAI vision failed');
      }
      throw new AppError('Vision analysis failed', res.status, 'OPENAI_VISION_FAILED', text);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    logger.debug({ latencyMs: Date.now() - started, tokens: data.usage?.total_tokens }, 'OpenAI vision ok');
    return parseStructuredJson(content);
  },
};

export const openaiWhisperProvider: TranscriptionProvider = {
  name: 'openai-whisper',

  async transcribe(input: TranscriptionInput): Promise<string> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.audioBuffer)], { type: input.mimeType });
    form.append('file', blob, 'voice.ogg');
    form.append('model', env.OPENAI_WHISPER_MODEL);
    if (input.languageHint) form.append('language', input.languageHint);

    const res = await openaiFetch('/audio/transcriptions', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new AppError('Transcription failed', res.status, 'WHISPER_FAILED', text);
    }

    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? '';
  },
};

/** Text-only advisory when no image */
export async function openaiTextAdvisory(
  systemPrompt: string,
  userPrompt: string
): Promise<StructuredAdvisory> {
  const res = await openaiFetch('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_TEXT_MODEL,
      ...openaiTokenLimitBody(env.OPENAI_TEXT_MODEL, 3000),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const quota = parseOpenAiHttpError(res.status, text);
    if (quota.isQuotaIssue) {
      logOpenAiQuotaInsufficient('openai-text-advisory', quota);
    }
    throw new AppError('Text advisory failed', res.status, 'OPENAI_TEXT_FAILED', text);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseStructuredJson(data.choices?.[0]?.message?.content ?? '{}');
}

function extractJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError('Invalid AI JSON response', 502, 'AI_PARSE_ERROR');
  }
  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

/** Generic JSON completion for planners / classifiers (not crop-doctor advisory shape). */
export async function openaiJsonCompletion<T extends Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
  options?: { temperature?: number }
): Promise<T> {
  const model = env.OPENAI_TEXT_MODEL;
  const res = await openaiFetch('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      ...openaiTokenLimitBody(model, maxTokens),
      ...(options?.temperature != null ? { temperature: options.temperature } : {}),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const quota = parseOpenAiHttpError(res.status, text);
    if (quota.isQuotaIssue) {
      logOpenAiQuotaInsufficient('openai-json', quota);
    }
    throw new AppError('OpenAI JSON completion failed', res.status, 'OPENAI_JSON_FAILED', text);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return extractJsonObject(data.choices?.[0]?.message?.content ?? '{}') as T;
}
