import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field, inputClass } from '../Modal';
import { Alert, Btn, Loading, Panel } from '../ui';
import { QuotationLogoField } from './QuotationLogoField';
import { TermsConditionsEditor } from './TermsConditionsEditor';

export type CompanySettings = {
  companyName: string;
  addressLine: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  cin: string;
  gstin: string;
  licenceNumber: string;
  customerCareNumber: string;
  whatsappNumber: string;
  termsAndConditions: string;
  quotationLogoUrl: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  bankBranch: string;
  bankIfsc: string;
  formattedAddress: string;
  updatedAt: string | null;
};

const EMPTY: CompanySettings = {
  companyName: '',
  addressLine: '',
  district: '',
  state: 'Karnataka',
  country: 'India',
  pincode: '',
  cin: '',
  gstin: '',
  licenceNumber: '',
  customerCareNumber: '',
  whatsappNumber: '',
  termsAndConditions: '',
  quotationLogoUrl: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankName: '',
  bankBranch: '',
  bankIfsc: '',
  formattedAddress: '',
  updatedAt: null,
};

function liveAddress(form: CompanySettings): string {
  const line2 = [form.district, form.state, form.pincode].filter(Boolean).join(', ');
  return [form.addressLine.trim(), line2, form.country.trim()].filter(Boolean).join('\n');
}

function completeness(form: CompanySettings) {
  const bankReady = Boolean(
    form.bankAccountName.trim() &&
      form.bankAccountNumber.trim() &&
      form.bankName.trim() &&
      form.bankIfsc.trim()
  );
  return [
    { id: 'name', label: 'Company name', done: Boolean(form.companyName.trim()) },
    { id: 'address', label: 'Registered address', done: Boolean(form.addressLine.trim()) },
    { id: 'gstin', label: 'GSTIN', done: Boolean(form.gstin.trim()) },
    {
      id: 'contact',
      label: 'Customer care or WhatsApp',
      done: Boolean(form.customerCareNumber.trim() || form.whatsappNumber.trim()),
    },
    { id: 'bank', label: 'Bank account details', done: bankReady },
    { id: 'logo', label: 'Quotation / letterhead logo', done: Boolean(form.quotationLogoUrl.trim()) },
    {
      id: 'terms',
      label: 'Terms & conditions',
      done: Boolean(form.termsAndConditions.trim()),
    },
  ] as const;
}

function CompanyDocumentPreview({ form }: { form: CompanySettings }) {
  const address = liveAddress(form);
  const name = form.companyName.trim() || 'Your company name';
  const doneCount = completeness(form).filter((c) => c.done).length;
  const total = completeness(form).length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-elevated shadow-[var(--shadow-card)]">
        <div className="border-b border-border bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 px-5 py-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Document preview
          </p>
          <p className="mt-1 text-sm text-white/85">Live letterhead as it appears on new invoices</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3 border-b border-border/70 pb-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle">
              {form.quotationLogoUrl.trim() ? (
                <img
                  src={form.quotationLogoUrl}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  Logo
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-ink">{name}</p>
              {address ? (
                <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-secondary">
                  {address}
                </pre>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">Address will appear here…</p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-muted">GSTIN</dt>
              <dd className="mt-0.5 font-medium text-ink">{form.gstin.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-muted">CIN</dt>
              <dd className="mt-0.5 font-medium text-ink">{form.cin.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-muted">Care</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {form.customerCareNumber.trim() || '—'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-muted">WhatsApp</dt>
              <dd className="mt-0.5 font-medium text-ink">{form.whatsappNumber.trim() || '—'}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-dashed border-border-strong bg-surface-subtle/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Company&apos;s bank details
            </p>
            {form.bankAccountName.trim() || form.bankName.trim() ? (
              <div className="mt-2 space-y-0.5 text-xs text-ink-secondary">
                <p className="font-semibold text-ink">
                  {form.bankAccountName.trim() || 'Account holder'}
                </p>
                <p>
                  {form.bankName.trim() || 'Bank'}
                  {form.bankBranch.trim() ? ` · ${form.bankBranch.trim()}` : ''}
                </p>
                <p>
                  A/c {form.bankAccountNumber.trim() || '—'}
                  {form.bankIfsc.trim() ? ` · IFSC ${form.bankIfsc.trim()}` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-muted">Add bank details to show on tax invoices.</p>
            )}
          </div>

          <div className="rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-800">
            Used on tax invoices, quotations, delivery challans, website footer, and printed packs.
            Already-issued documents keep their saved snapshot.
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface-elevated p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Profile completeness</h3>
          <span className="text-xs font-bold text-brand-700">
            {doneCount}/{total} · {pct}%
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="space-y-2">
          {completeness(form).map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  item.done
                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700'
                    : 'flex h-5 w-5 items-center justify-center rounded-full border border-border text-ink-muted'
                }
                aria-hidden
              >
                {item.done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6.2L4.8 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
                )}
              </span>
              <span className={item.done ? 'text-ink-secondary' : 'text-ink-muted'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function CompanySettingsPanel({ canWrite }: { canWrite?: boolean }) {
  const [form, setForm] = useState<CompanySettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ ok: boolean; company: CompanySettings }>('/morbeez-staff/api/v1/os/settings/company')
      .then((d) => setForm(d.company ?? EMPTY))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load company profile'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const d = await api<{ ok: boolean; company: CompanySettings }>(
        '/morbeez-staff/api/v1/os/settings/company',
        {
          method: 'PUT',
          body: JSON.stringify({
            companyName: form.companyName,
            addressLine: form.addressLine,
            district: form.district,
            state: form.state,
            country: form.country || 'India',
            pincode: form.pincode,
            cin: form.cin,
            gstin: form.gstin,
            licenceNumber: form.licenceNumber,
            customerCareNumber: form.customerCareNumber,
            whatsappNumber: form.whatsappNumber,
            termsAndConditions: form.termsAndConditions,
            quotationLogoUrl: form.quotationLogoUrl || null,
            bankAccountName: form.bankAccountName,
            bankAccountNumber: form.bankAccountNumber,
            bankName: form.bankName,
            bankBranch: form.bankBranch,
            bankIfsc: form.bankIfsc,
          }),
        }
      );
      setForm(d.company ?? form);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save company profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Panel
      title="Company profile"
      description="Default company details for tax invoices, quotations, delivery challans, website footer, and printed materials. Changes apply to new documents; issued invoices keep their saved snapshot."
    >
      {error ? <Alert tone="error" className="mb-4">{error}</Alert> : null}
      {saved ? (
        <Alert tone="success" className="mb-4">
          Company profile saved.
        </Alert>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <Field label="Company name">
            <input
              className={inputClass}
              value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)}
              disabled={!canWrite}
              placeholder="Morbeez Agri Sciences"
            />
          </Field>
          <Field label="Address">
            <textarea
              className={inputClass}
              rows={2}
              value={form.addressLine}
              onChange={(e) => set('addressLine', e.target.value)}
              disabled={!canWrite}
              placeholder="Building, street, locality"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="District">
              <input
                className={inputClass}
                value={form.district}
                onChange={(e) => set('district', e.target.value)}
                disabled={!canWrite}
              />
            </Field>
            <Field label="State">
              <input
                className={inputClass}
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                disabled={!canWrite}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Country">
              <input
                className={inputClass}
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                disabled={!canWrite}
              />
            </Field>
            <Field label="Pincode">
              <input
                className={inputClass}
                value={form.pincode}
                onChange={(e) => set('pincode', e.target.value)}
                disabled={!canWrite}
                inputMode="numeric"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CIN">
              <input
                className={inputClass}
                value={form.cin}
                onChange={(e) => set('cin', e.target.value)}
                disabled={!canWrite}
              />
            </Field>
            <Field label="GSTIN">
              <input
                className={inputClass}
                value={form.gstin}
                onChange={(e) => set('gstin', e.target.value)}
                disabled={!canWrite}
                placeholder="29AAAAA0000A1Z5"
              />
            </Field>
          </div>
          <Field label="Licence number">
            <input
              className={inputClass}
              value={form.licenceNumber}
              onChange={(e) => set('licenceNumber', e.target.value)}
              disabled={!canWrite}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer care number">
              <input
                className={inputClass}
                value={form.customerCareNumber}
                onChange={(e) => set('customerCareNumber', e.target.value)}
                disabled={!canWrite}
                inputMode="tel"
              />
            </Field>
            <Field label="WhatsApp number">
              <input
                className={inputClass}
                value={form.whatsappNumber}
                onChange={(e) => set('whatsappNumber', e.target.value)}
                disabled={!canWrite}
                inputMode="tel"
                placeholder="91XXXXXXXXXX"
              />
            </Field>
          </div>

          <div className="settings-section-gap pt-2">
            <h3 className="text-base font-semibold text-ink">Bank account details</h3>
            <p className="mb-3 text-sm text-ink-muted">
              Shown on tax invoices under &ldquo;Company&apos;s Bank Details&rdquo;.
            </p>
            <div className="space-y-3">
              <Field label="Name (account holder)">
                <input
                  className={inputClass}
                  value={form.bankAccountName}
                  onChange={(e) => set('bankAccountName', e.target.value)}
                  disabled={!canWrite}
                  placeholder="Account holder name"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account number">
                  <input
                    className={inputClass}
                    value={form.bankAccountNumber}
                    onChange={(e) => set('bankAccountNumber', e.target.value)}
                    disabled={!canWrite}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="IFSC code">
                  <input
                    className={inputClass}
                    value={form.bankIfsc}
                    onChange={(e) => set('bankIfsc', e.target.value.toUpperCase())}
                    disabled={!canWrite}
                    placeholder="SBIN0001234"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Bank name">
                  <input
                    className={inputClass}
                    value={form.bankName}
                    onChange={(e) => set('bankName', e.target.value)}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Branch">
                  <input
                    className={inputClass}
                    value={form.bankBranch}
                    onChange={(e) => set('bankBranch', e.target.value)}
                    disabled={!canWrite}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="settings-section-gap pt-2">
            <QuotationLogoField
              value={form.quotationLogoUrl}
              onChange={(v) => set('quotationLogoUrl', v)}
              disabled={!canWrite}
            />
          </div>

          <div className="settings-section-gap pt-2">
            <TermsConditionsEditor
              value={form.termsAndConditions}
              onChange={(v) => set('termsAndConditions', v)}
              disabled={!canWrite}
            />
          </div>

          {canWrite ? (
            <div className="pt-2">
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save company profile'}
              </Btn>
            </div>
          ) : null}
        </div>

        <CompanyDocumentPreview form={form} />
      </div>
    </Panel>
  );
}
