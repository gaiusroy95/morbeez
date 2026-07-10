export function formatInr(amount: number): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatInrFull(amount: number): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function initials(name: string | undefined): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    operations: 'Operations',
    manager: 'Manager',
    viewer: 'Viewer',
    agronomist: 'Agronomist',
    telecaller: 'Telecaller',
    warehouse: 'Warehouse',
    picker_packer: 'Picker / Packer',
  };
  return map[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export {
  phoneDigits,
  formatPhoneE164,
  formatPhoneDisplay,
  telHref,
  whatsAppPhone,
  whatsAppHref,
} from './phone';
