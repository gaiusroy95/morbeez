import type { CallLanguage, CallScript, CallType } from './types.js';
type ScriptKey = CallType | 'opt_out_ack' | 'human_ack' | 'clarify';
export declare function buildCallScript(params: {
    type: ScriptKey;
    language: CallLanguage;
    stageQuestion?: string | null;
    reminderLabel?: string | null;
}): CallScript;
export {};
//# sourceMappingURL=scripts.d.ts.map