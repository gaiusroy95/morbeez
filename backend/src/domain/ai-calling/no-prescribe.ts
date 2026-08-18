/** Common agrochemical / fertilizer names the voice engine must never volunteer. */
export const CHEMICAL_BLOCKLIST = [
  'mancozeb',
  'carbendazim',
  'chlorothalonil',
  'imidacloprid',
  'chlorpyrifos',
  'glyphosate',
  'profenofos',
  'cyhalothrin',
  'streptocycline',
  'copper oxychloride',
  'bordeaux',
  'monocrotophos',
  'acephate',
  'emamectin',
  'fipronil',
  'thiamethoxam',
  'hexaconazole',
  'propiconazole',
  'tebuconazole',
  'diammonium',
  'urea spray',
  '19:19:19',
  '12:32:16',
];

const BLOCK_RE = new RegExp(
  `\\b(${CHEMICAL_BLOCKLIST.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i'
);

export function findPrescriptionLeak(text: string): string | null {
  const m = text.match(BLOCK_RE);
  return m ? m[1] : null;
}

export function assertNoPrescription(text: string, context: string): void {
  const leak = findPrescriptionLeak(text);
  if (leak) {
    throw new Error(`${context}: calling script must not prescribe "${leak}"`);
  }
}

export function stripPrescription(text: string): string {
  return text.replace(BLOCK_RE, 'the recommended application');
}
