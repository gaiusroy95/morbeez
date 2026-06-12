export declare const LEAD_CHANNELS: readonly ["meta", "instagram", "google", "referral", "organic", "whatsapp", "field", "other"];
export type LeadChannel = (typeof LEAD_CHANNELS)[number];
export declare const CONNECTED_CALL_OUTCOMES: Set<string>;
export declare const INTERESTED_STAGES: Set<string>;
export declare const PAID_STAGES: Set<string>;
export declare const STAGE_RANK: Record<string, number>;
export declare function leadChannelFromUtm(utmSource?: string | null, utmMedium?: string | null): LeadChannel;
export declare function attributionBadge(channel?: string | null, campaign?: string | null): string | null;
//# sourceMappingURL=lead-attribution.d.ts.map