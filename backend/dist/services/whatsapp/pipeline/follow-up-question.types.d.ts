import type { AdvisoryLanguage } from '../../ai/types.js';
/** Structured follow-up only: yes/no, n-choice, or photo — no free text. */
export type FollowUpQuestionKind = 'yes_no' | 'multiple_choice' | 'photo';
export type FollowUpChoiceOption = {
    id: string;
    labelEn: string;
    labelMl: string;
};
export declare const YES_NO_CHOICES: FollowUpChoiceOption[];
export declare const SPRAY_TIMING_CHOICES: FollowUpChoiceOption[];
export declare function normalizeFollowUpKind(raw: unknown): FollowUpQuestionKind;
export declare function defaultChoicesForKind(kind: FollowUpQuestionKind): FollowUpChoiceOption[];
/** EVSI questions often carry `choices: []`; treat empty stored arrays as missing. */
export declare function resolveFollowUpChoices(params: {
    question: {
        id: string;
        kind?: FollowUpQuestionKind;
        choices?: FollowUpChoiceOption[];
    };
    storedChoices?: FollowUpChoiceOption[] | null;
}): FollowUpChoiceOption[];
export declare function localizeChoice(option: FollowUpChoiceOption, lang: AdvisoryLanguage): string;
export declare function normalizeChoiceOptions(raw: unknown, kind: FollowUpQuestionKind): FollowUpChoiceOption[];
export declare function formatChoiceAnswerLabel(answerId: string, choices: FollowUpChoiceOption[], lang?: AdvisoryLanguage): string;
//# sourceMappingURL=follow-up-question.types.d.ts.map