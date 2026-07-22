export declare const SUPPORTED_TEMPLATE_LANGUAGES: readonly ["en", "hi", "kn", "ta", "ml"];
export type TemplateLanguage = (typeof SUPPORTED_TEMPLATE_LANGUAGES)[number];
export declare const STANDARD_TEMPLATE_VARIABLES: readonly [{
    readonly key: "FarmerName";
    readonly label: "Farmer Name";
    readonly sample: "Ramesh";
}, {
    readonly key: "CropName";
    readonly label: "Crop Name";
    readonly sample: "Ginger";
}, {
    readonly key: "Village";
    readonly label: "Village";
    readonly sample: "Wayanad";
}, {
    readonly key: "DAP";
    readonly label: "DAP";
    readonly sample: "45";
}, {
    readonly key: "AdvisorName";
    readonly label: "Advisor Name";
    readonly sample: "Anil";
}, {
    readonly key: "MobileNumber";
    readonly label: "Mobile Number";
    readonly sample: "9876543210";
}];
export type TemplateVariableContext = Record<string, string>;
export declare const SAMPLE_VARIABLE_CONTEXT: TemplateVariableContext;
export declare function renderLanguageTemplate(body: string, ctx?: TemplateVariableContext): string;
export declare function computeLanguageCompletion(languages: Record<string, {
    bodyText?: string | null;
    status?: string | null;
} | undefined>): {
    complete: number;
    total: number;
    rate: number;
    perLanguage: Record<string, boolean>;
};
export declare function displayNameFromKey(key: string): string;
//# sourceMappingURL=language-template-variables.d.ts.map