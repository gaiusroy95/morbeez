import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { transcriptionService } from '../ai/transcription.service.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import { conversationIntelligenceService } from './conversation-intelligence.service.js';
import { callQcService } from './call-qc.service.js';
import type { CallSummaryJson } from '../../domain/call-intelligence/types.js';

const LANG_HINT: Record<string, string> = {
  en: 'en',
  ml: 'ml',
  hi: 'hi',
  ta: 'ta',
  kn: 'kn',
};

function summaryPrompt(transcript: string, expandedText: string): string {
  return `Transcript:\n${transcript}\n\nExpanded terminology:\n${expandedText}\n\nReturn JSON with:
- bullets: string[] (3-6 concise bullet points for CRM)
- crop: string|null
- problem: string|null
- interestLevel: "low"|"medium"|"high"|null
- interestedInSoilTest: boolean
- followUpDays: number|null (days until follow-up, e.g. 3)
- suggestedStage: one of new_lead, interested, follow_up, recommendation, order_placed, repeat_customer|null
- suggestedOutcome: short label e.g. Interested, Callback, Not interested
- nextAction: string|null
- language: ISO language code if detectable`;
}

export const callIntelligenceProcessor = {
  async transcribeAudio(buffer: Buffer, mimeType: string, language: AdvisoryLanguage): Promise<string> {
    return transcriptionService.transcribeVoice(buffer, mimeType, LANG_HINT[language] ?? 'en');
  },

  async summarizeTranscript(input: {
    farmerId: string;
    leadId: string;
    transcript: string;
    language: AdvisoryLanguage;
  }): Promise<{ summary: CallSummaryJson; summaryText: string; expandedText: string; detection: import('../regional-terminology/types.js').TerminologyDetectionResult | null }> {
    const { expandedText, detection } = await conversationIntelligenceService.processText({
      farmerId: input.farmerId,
      leadId: input.leadId,
      text: input.transcript,
      channel: 'call',
      language: input.language,
    });

    const raw = await openaiJsonCompletion<CallSummaryJson>(
      'You summarize telecaller CRM calls for Indian farmers. Output valid JSON only.',
      summaryPrompt(input.transcript, expandedText)
    );

    const bullets = Array.isArray(raw.bullets) ? raw.bullets.map(String).filter(Boolean) : [];
    const summary: CallSummaryJson = {
      bullets,
      crop: raw.crop != null ? String(raw.crop) : null,
      problem: raw.problem != null ? String(raw.problem) : null,
      interestLevel: raw.interestLevel ?? null,
      interestedInSoilTest: Boolean(raw.interestedInSoilTest),
      followUpDays: raw.followUpDays != null ? Number(raw.followUpDays) : null,
      suggestedStage: raw.suggestedStage != null ? String(raw.suggestedStage) : null,
      suggestedOutcome: raw.suggestedOutcome != null ? String(raw.suggestedOutcome) : null,
      nextAction: raw.nextAction != null ? String(raw.nextAction) : null,
      language: raw.language != null ? String(raw.language) : null,
    };

    const summaryText = bullets.length ? bullets.join('\n') : input.transcript.slice(0, 500);
    return { summary, summaryText, expandedText, detection };
  },

  async runQc(input: { transcript: string; summaryText: string; agentEmail: string }) {
    return callQcService.scoreCall({
      transcript: input.transcript,
      summary: input.summaryText,
      agentEmail: input.agentEmail,
    });
  },
};
