/** Build a public carrier tracking URL from AWB / courier metadata. */
export declare function delhiveryTrackUrl(awb: string): string;
export declare function resolveTrackingUrl(input: {
    trackingId?: string | null;
    trackingUrl?: string | null;
    courier?: string | null;
}): string | null;
export declare function trackingLinkLabel(courier: string | null | undefined, trackingId: string): string;
//# sourceMappingURL=shipment-tracking.d.ts.map