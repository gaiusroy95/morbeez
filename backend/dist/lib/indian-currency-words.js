const ONES = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigits(n) {
    if (n < 20)
        return ONES[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim();
}
function threeDigits(n) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const head = h ? `${ONES[h]} Hundred` : '';
    const tail = rest ? twoDigits(rest) : '';
    return [head, tail].filter(Boolean).join(' ').trim();
}
function integerToWords(n) {
    if (n === 0)
        return 'Zero';
    const parts = [];
    const crore = Math.floor(n / 10_000_000);
    const lakh = Math.floor((n % 10_000_000) / 100_000);
    const thousand = Math.floor((n % 100_000) / 1000);
    const hundred = n % 1000;
    if (crore)
        parts.push(`${threeDigits(crore)} Crore`);
    if (lakh)
        parts.push(`${threeDigits(lakh)} Lakh`);
    if (thousand)
        parts.push(`${threeDigits(thousand)} Thousand`);
    if (hundred)
        parts.push(threeDigits(hundred));
    return parts.join(' ').trim();
}
/** e.g. 30620 → "Indian Rupee Thirty Thousand Six Hundred Twenty Only" */
export function amountInIndianWords(amount) {
    const value = Math.max(0, Number(amount) || 0);
    const rupees = Math.floor(value);
    const paise = Math.round((value - rupees) * 100);
    let words = `Indian Rupee ${integerToWords(rupees)}`;
    if (paise > 0) {
        words += ` and ${integerToWords(paise)} Paise`;
    }
    return `${words} Only`;
}
//# sourceMappingURL=indian-currency-words.js.map