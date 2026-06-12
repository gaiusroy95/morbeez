export function cropHealthFromTone(tone?: string | null): {
  cropHealthLabel: string;
  cropHealthStatus: 'stable' | 'monitor' | 'alert' | 'critical';
} {
  const t = String(tone ?? '').toLowerCase();
  if (t === 'healthy') return { cropHealthLabel: 'Good', cropHealthStatus: 'stable' };
  if (t === 'warning') return { cropHealthLabel: 'Average', cropHealthStatus: 'monitor' };
  if (t === 'danger') return { cropHealthLabel: 'Need assistance', cropHealthStatus: 'alert' };
  return { cropHealthLabel: '—', cropHealthStatus: 'monitor' };
}

export function soilHealthMeta(raw?: string | null): {
  soilHealthLabel: string;
  soilHealthStatus: 'stable' | 'monitor' | 'alert' | 'critical';
} {
  const health = String(raw ?? 'good').toLowerCase();
  if (health === 'good') return { soilHealthLabel: 'Good', soilHealthStatus: 'stable' };
  if (health === 'medium') return { soilHealthLabel: 'Average', soilHealthStatus: 'monitor' };
  return { soilHealthLabel: 'Need assistance', soilHealthStatus: 'alert' };
}
