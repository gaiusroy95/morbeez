import type { AdvisoryLanguage, StructuredAdvisory } from '../../ai/types.js';
import { pickLocalizedFarmerSummary } from './crop-message-intent.service.js';

type SectionLabels = {
  whatISee: string;
  primaryIssue: string;
  lessLikely: string;
  immediateAction: string;
  tableHeader: string;
  sprayTiming: string;
  rootCorrection: string;
  cost: string;
  assessment: string;
  dataUsed: string;
  precautions: string;
};

const LABELS: Record<AdvisoryLanguage, SectionLabels> = {
  en: {
    whatISee: '🔍 What I see',
    primaryIssue: '🎯 Primary issue',
    lessLikely: '❌ Less likely',
    immediateAction: '💊 Immediate action',
    tableHeader: 'Item · Dose · Method',
    sprayTiming: '⏰ Spray timing',
    rootCorrection: '🌱 Root / soil correction',
    cost: '💰 Approximate cost',
    assessment: '📋 Morbeez assessment',
    dataUsed: '📊 Based on your field data',
    precautions: '⚠️ Precautions',
  },
  ml: {
    whatISee: '🔍 എന്താണ് കാണുന്നത്',
    primaryIssue: '🎯 പ്രധാന പ്രശ്നം',
    lessLikely: '❌ കുറവ് സാധ്യത',
    immediateAction: '💊 ഉടനടി നടപടി',
    tableHeader: 'ഉൽപ്പന്നം · ഡോസ് · രീതി',
    sprayTiming: '⏰ സ്പ്രേ സമയം',
    rootCorrection: '🌱 വേര് / മണ്ണ് ശരിയാക്കൽ',
    cost: '💰 ഏകദേശ ചെലവ്',
    assessment: '📋 മോർബീസ് വിലയിരുത്തൽ',
    dataUsed: '📊 നിങ്ങളുടെ ഫീൽഡ് ഡാറ്റ',
    precautions: '⚠️ മുൻകരുതി',
  },
  ta: {
    whatISee: '🔍 நான் காண்பது',
    primaryIssue: '🎯 முதன்மை பிரச்சனை',
    lessLikely: '❌ குறைந்த சாத்தியம்',
    immediateAction: '💊 உடனடி நடவடிக்கை',
    tableHeader: 'பொருள் · அளவு · முறை',
    sprayTiming: '⏰ தெளிப்பு நேரம்',
    rootCorrection: '🌱 வேர் / மண் திருத்தம்',
    cost: '💰 தோராய செலவு',
    assessment: '📋 Morbeez மதிப்பீடு',
    dataUsed: '📊 உங்கள் வயல் தரவு',
    precautions: '⚠️ முன்னெச்சரிக்கை',
  },
  kn: {
    whatISee: '🔍 ನಾನು ನೋಡುವುದು',
    primaryIssue: '🎯 ಪ್ರಮುಖ ಸಮಸ್ಯೆ',
    lessLikely: '❌ ಕಡಿಮೆ ಸಾಧ್ಯತೆ',
    immediateAction: '💊 ತಕ್ಷಣ ಕ್ರಮ',
    tableHeader: 'ವಸ್ತು · ಡೋಸ್ · ವಿಧಾನ',
    sprayTiming: '⏰ ಸಿಂಪಡಣೆ ಸಮಯ',
    rootCorrection: '🌱 ಬೇರು / ಮಣ್ಣು ಸರಿಪಡಿಸುವಿಕೆ',
    cost: '💰 ಅಂದಾಜು ವೆಚ್ಚ',
    assessment: '📋 Morbeez ಮೌಲ್ಯಮಾಪನ',
    dataUsed: '📊 ನಿಮ್ಮ ಹೊಲದ ಡೇಟಾ',
    precautions: '⚠️ ಎಚ್ಚರಿಕೆ',
  },
  hi: {
    whatISee: '🔍 मैं क्या देख रहा हूँ',
    primaryIssue: '🎯 मुख्य समस्या',
    lessLikely: '❌ कम संभावना',
    immediateAction: '💊 तुरंत कार्रवाई',
    tableHeader: 'वस्तु · मात्रा · तरीका',
    sprayTiming: '⏰ छिड़काव का समय',
    rootCorrection: '🌱 जड़ / मिट्टी सुधार',
    cost: '💰 अनुमानित लागत',
    assessment: '📋 Morbeez मूल्यांकन',
    dataUsed: '📊 आपके खेत का डेटा',
    precautions: '⚠️ सावधानी',
  },
};

export type RenderDiagnosisInput = {
  advisory: StructuredAdvisory;
  language: AdvisoryLanguage;
  plotLabel?: string;
  reuseNote?: string;
  safetyNote?: string;
  escalateNote?: string;
};

function hasRichSections(advisory: StructuredAdvisory): boolean {
  return Boolean(
    advisory.imageObservations?.length ||
      advisory.differentialDiagnosis?.length ||
      advisory.dosageGuidance?.length ||
      advisory.agronomistAssessment?.trim() ||
      advisory.sprayTiming?.trim()
  );
}

function severityLabel(severity: string | undefined, language: AdvisoryLanguage): string {
  const map: Record<string, Record<AdvisoryLanguage, string>> = {
    mild: { en: 'Mild', ml: 'ലഘു', ta: 'லேசான', kn: 'ಸೌಮ್ಯ', hi: 'हल्का' },
    moderate: { en: 'Moderate', ml: 'മിതം', ta: 'மிதமான', kn: 'ಮಧ್ಯಮ', hi: 'मध्यम' },
    severe: { en: 'Severe', ml: 'ഗുരുതരം', ta: 'கடுமையான', kn: 'ತೀವ್ರ', hi: 'गंभीर' },
  };
  const s = severity ?? 'moderate';
  return map[s]?.[language] ?? map.moderate![language];
}

export const whatsappDiagnosisRendererService = {
  hasRichSections,

  render(input: RenderDiagnosisInput): string {
    const { advisory, language } = input;
    if (!hasRichSections(advisory)) {
      return legacyFallback(input);
    }

    const t = LABELS[language] ?? LABELS.en;
    const sections: string[] = [];

    if (input.plotLabel?.trim()) {
      sections.push(`📍 ${input.plotLabel.trim()}`);
    }

    const observations =
      advisory.imageObservations?.length
        ? advisory.imageObservations
        : advisory.stressAnalysis?.slice(0, 4) ?? [];
    if (observations.length) {
      sections.push(t.whatISee, ...observations.map((o) => `• ${o}`));
    }

    const confPct = Math.round(advisory.confidence * 100);
    sections.push(
      '',
      `${t.primaryIssue}: ${advisory.probableIssue} — ${severityLabel(advisory.severity, language)} (${confPct}%)`
    );

    if (advisory.differentialDiagnosis?.length) {
      sections.push('', t.lessLikely);
      for (const d of advisory.differentialDiagnosis.slice(0, 4)) {
        sections.push(`• ${d.label} — ${d.reason}`);
      }
    }

    if (advisory.dosageGuidance?.length) {
      sections.push('', t.immediateAction, t.tableHeader);
      for (const d of advisory.dosageGuidance) {
        const parts = [d.product, d.rate, d.method].filter(Boolean);
        sections.push(parts.join(' · '));
      }
    } else if (advisory.treatments?.length) {
      sections.push('', t.immediateAction);
      for (const tr of advisory.treatments.slice(0, 4)) {
        sections.push(`• ${tr.action}${tr.timing ? ` (${tr.timing})` : ''}`);
      }
    }

    if (advisory.sprayTiming?.trim()) {
      sections.push('', t.sprayTiming, advisory.sprayTiming.trim());
    }

    if (advisory.rootCorrection?.trim()) {
      sections.push('', t.rootCorrection, advisory.rootCorrection.trim());
    }

    if (advisory.costEstimate?.length) {
      sections.push('', t.cost);
      for (const c of advisory.costEstimate.slice(0, 5)) {
        sections.push(`• ${c.item}: ${c.note}`);
      }
    }

    if (advisory.morbeezDataUsed?.length) {
      sections.push('', t.dataUsed, ...advisory.morbeezDataUsed.map((d) => `• ${d}`));
    }

    if (advisory.agronomistAssessment?.trim()) {
      sections.push('', t.assessment, advisory.agronomistAssessment.trim());
    }

    if (advisory.precautions?.length) {
      sections.push('', t.precautions, ...advisory.precautions.map((p) => `• ${p}`));
    }

    if (input.reuseNote) sections.push('', input.reuseNote);
    if (input.safetyNote) sections.push('', input.safetyNote);
    if (input.escalateNote) sections.push('', input.escalateNote);

    return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  },
};

function legacyFallback(input: RenderDiagnosisInput): string {
  const summary = pickLocalizedFarmerSummary(input.advisory, input.language);
  const parts = [input.plotLabel ? `📍 ${input.plotLabel}` : null, summary].filter(Boolean) as string[];
  if (input.reuseNote) parts.push(input.reuseNote);
  if (input.safetyNote) parts.push(input.safetyNote);
  if (input.escalateNote) parts.push(input.escalateNote);
  return parts.join('\n\n');
}
