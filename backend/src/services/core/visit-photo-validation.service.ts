import { assessImageBuffer } from '../whatsapp/pipeline/image-quality.service.js';

export type VisitPhotoValidationIssue = 'blur' | 'dark' | 'low_resolution';

export type VisitPhotoValidationResult = {
  ok: boolean;
  issues: VisitPhotoValidationIssue[];
  retakeRecommended: boolean;
};

function estimateEntropy(buffer: Buffer): number {
  const freq = new Array<number>(256).fill(0);
  const step = Math.max(1, Math.floor(buffer.length / 50000));
  let sampled = 0;
  for (let i = 0; i < buffer.length; i += step) {
    freq[buffer[i]] += 1;
    sampled += 1;
  }
  let entropy = 0;
  for (const c of freq) {
    if (!c) continue;
    const p = c / sampled;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function estimateBrightness(buffer: Buffer): number {
  const step = Math.max(1, Math.floor(buffer.length / 20000));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < buffer.length; i += step) {
    sum += buffer[i];
    count += 1;
  }
  return count ? sum / count : 128;
}

export function validateVisitPhotoBuffer(buffer: Buffer, mimeType?: string): VisitPhotoValidationResult {
  const issues: VisitPhotoValidationIssue[] = [];
  const quality = assessImageBuffer(buffer, mimeType);

  if (!quality.ok) {
    if (quality.reason === 'too_small' || quality.reason === 'low_detail') {
      issues.push('low_resolution');
    }
  }

  if (estimateEntropy(buffer) < 4.8) {
    issues.push('blur');
  }

  if (estimateBrightness(buffer) < 45) {
    issues.push('dark');
  }

  const retakeRecommended = issues.length > 0;
  return { ok: issues.length === 0, issues, retakeRecommended };
}

export const visitPhotoValidationService = {
  validateBase64(dataBase64: string, mimeType?: string): VisitPhotoValidationResult {
    const buffer = Buffer.from(dataBase64, 'base64');
    return validateVisitPhotoBuffer(buffer, mimeType);
  },
};
