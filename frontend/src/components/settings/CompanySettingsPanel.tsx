import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field, inputClass } from '../Modal';
import { Alert, Btn, Loading, Panel } from '../ui';

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
  formattedAddress: '',
  updatedAt: null,
};

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
    <Panel title="Company profile">
      <p className="muted" style={{ marginBottom: 16 }}>
        Default company details for tax invoices, quotations, delivery challans, website footer, and
        printed materials. Changes apply to new documents; issued invoices keep their saved snapshot.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">Company profile saved.</Alert> : null}
      <div className="space-y-3" style={{ maxWidth: 560 }}>
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
        {form.formattedAddress ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">Preview (invoices &amp; materials)</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-slate-600">{form.formattedAddress}</pre>
            {form.gstin ? <p className="mt-2 text-slate-600">GSTIN: {form.gstin}</p> : null}
            {form.cin ? <p className="text-slate-600">CIN: {form.cin}</p> : null}
          </div>
        ) : null}
        {canWrite ? (
          <Btn onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save company profile'}
          </Btn>
        ) : null}
      </div>
    </Panel>
  );
}
