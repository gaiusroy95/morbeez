export type ScanImageType = 'leaf' | 'field' | 'rhizome';

export type ScanResult = {
  sessionId: string;
  detectedIssue: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  spreadRisk: string | null;
  description: string;
  escalated: boolean;
  recommendationId: string | null;
  summary: string;
};
