/** EVSI metadata for LLM question planning — never farmer-facing pack question text. */
export type EvsiPlannerHint = {
    questionId: string;
    kind: 'yes_no' | 'photo';
    evidenceSlot: string;
    informationGain: number;
};
//# sourceMappingURL=evsi-planner-hint.types.d.ts.map