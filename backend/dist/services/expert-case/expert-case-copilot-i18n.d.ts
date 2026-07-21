import type { AdvisoryLanguage } from '../ai/types.js';
export type CopilotUiLocale = 'en' | 'hi' | 'ml' | 'ta' | 'kn';
export declare function normalizeCopilotLocale(value?: string | null): CopilotUiLocale;
type MsgKey = 'imagesLoaded' | 'photosAvailable' | 'imageAnalysisTitle' | 'detected' | 'wantAnnotated' | 'overlayEnabled' | 'registeredDoseApplied' | 'resistanceFrac' | 'phytotoxicityLow' | 'safetyPpe' | 'missingInfoSend' | 'questionsSent' | 'extracting' | 'runningValidations' | 'dosageAsk' | 'dosageOk' | 'validationsAttached' | 'clarifyDiagnosis' | 'askLabelDose' | 'askDilution' | 'dilutionAsk' | 'askSendFarmerQs' | 'farmerQIntro' | 'farmerQPh' | 'farmerQEc' | 'farmerQFungicide' | 'farmerQRain' | 'navOpeningNext' | 'navOpeningPrevious' | 'navNoNext' | 'navNoPrevious' | 'navAtFirst' | 'navAtLast' | 'farmerConfirmThanks' | 'farmerAnswersRecorded' | 'farmerPreviewConfirmPrompt';
export declare function copilotMsg(locale: CopilotUiLocale | string | null | undefined, key: MsgKey, vars?: Record<string, string | number>): string;
export declare function defaultFarmerQuestions(locale: CopilotUiLocale | string | null | undefined): string[];
export declare function toAdvisoryLanguage(value?: string | null): AdvisoryLanguage;
export {};
//# sourceMappingURL=expert-case-copilot-i18n.d.ts.map