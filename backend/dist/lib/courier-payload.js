export function volumetricWeightKg(lengthCm, breadthCm, heightCm, divisor = 5000) {
    const vol = (lengthCm * breadthCm * heightCm) / divisor;
    return Math.round(vol * 1000) / 1000;
}
export function billingWeightKg(actualKg, lengthCm, breadthCm, heightCm, settings) {
    const divisor = settings?.volumetricDivisorCm ?? 5000;
    const minKg = settings?.minBillingWeightKg ?? 0.2;
    const chargeable = Math.max(actualKg, volumetricWeightKg(lengthCm, breadthCm, heightCm, divisor));
    return Math.max(minKg, Math.round(chargeable * 1000) / 1000);
}
export function buildCourierPayload(dimensions, settings) {
    const minKg = settings?.minBillingWeightKg ?? 0.2;
    return {
        length: Math.round(dimensions.length * 100) / 100,
        breadth: Math.round(dimensions.breadth * 100) / 100,
        height: Math.round(dimensions.height * 100) / 100,
        weight: Math.max(minKg, Math.round(dimensions.weight * 1000) / 1000),
        billingWeight: Math.max(minKg, Math.round(dimensions.billingWeight * 1000) / 1000),
    };
}
//# sourceMappingURL=courier-payload.js.map