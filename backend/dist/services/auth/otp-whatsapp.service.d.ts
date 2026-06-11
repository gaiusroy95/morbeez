/** Deliver OTP via WhatsApp. Returns whether a real message was sent (false = dev fallback only). */
export declare function deliverOtpWhatsApp(phoneRaw: string, code: string): Promise<{
    sent: boolean;
}>;
//# sourceMappingURL=otp-whatsapp.service.d.ts.map