import type { AdvisoryLanguage } from '../ai/types.js';

export type TerminologyDictionaryEntry = {
  id: string;
  term: string;
  language: string;
  meaning: string;
  standardTerm: string | null;
  localScript: string | null;
  cropType: string | null;
  district: string | null;
  confidence: number;
  replyPreferred?: boolean;
  conceptId?: string | null;
  source?: 'farmer' | 'dictionary' | 'builtin';
};

export type DetectedTerm = {
  token: string;
  known: boolean;
  meaning?: string;
  standardTerm?: string;
  confidence: number;
  source: 'farmer' | 'builtin' | 'dictionary' | 'unknown';
  replyPreferred?: boolean;
  conceptId?: string | null;
};

export type TerminologyDetectionResult = {
  rawMessage: string;
  language: AdvisoryLanguage;
  terms: DetectedTerm[];
  unknownTerms: DetectedTerm[];
  knownTerms: DetectedTerm[];
  hasUnknown: boolean;
  /** Expanded text for AI (regional → standard meanings). */
  expandedForAi: string;
  /** Glossary lines for prompt injection. */
  glossaryLines: string[];
};

export type EscalationTaskRow = {
  id: string;
  farmerId: string | null;
  term: string;
  unknownWord: string;
  rawMessage: string | null;
  status: string;
  cropType: string | null;
  district: string | null;
  occurrenceCount: number;
  priorityScore: number;
};
