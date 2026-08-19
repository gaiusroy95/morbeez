import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Alert,
  Badge,
  Btn,
  Input,
  Label,
  Panel,
  ReadOnlyBanner,
  Select,
  inputClass,
  textareaClass,
} from '../../components/ui';

const base = '/morbeez-staff/api/v1/partners';

interface FormData {
  fullName: string;
  partnerType: string;
  phone: string;
  email: string;
  loginIdType: 'mobile' | 'email';
  createAppAccount: boolean;
  panNumber: string;
  panName: string;
  addressLine1: string;
  addressLine2: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
  territory: string;
  bankAccountHolder: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  branchName: string;
  cropAdvisor: string;
  notes: string;
}

const initial: FormData = {
  fullName: '',
  partnerType: '',
  phone: '',
  email: '',
  loginIdType: 'mobile',
  createAppAccount: true,
  panNumber: '',
  panName: '',
  addressLine1: '',
  addressLine2: '',
  state: '',
  district: '',
  city: '',
  pincode: '',
  territory: '',
  bankAccountHolder: '',
  bankName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  branchName: '',
  cropAdvisor: '',
  notes: '',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 border-b border-border/60 pb-2 text-sm font-bold uppercase tracking-wider text-ink-muted">
      {children}
    </h3>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {children}
    </label>
  );
}

export function PartnerCreatePage({ canWrite }: { canWrite: boolean }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set =
    (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setBool =
    (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.checked }));

  async function submit() {
    if (!canWrite) return;
    if (!form.fullName.trim() || !form.phone.trim()) {
      setError('Partner name and mobile number are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`${base}/applications`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          state: form.state || undefined,
          district: form.district || undefined,
          village: form.city || undefined,
        }),
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create partner');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="hub-page">
        <Alert tone="success">
          Partner application created successfully! The partner will receive an activation link.
        </Alert>
        <div className="mt-4 flex gap-3">
          <Btn variant="primary" onClick={() => navigate('/partners')}>
            Back to Partners
          </Btn>
          <Btn
            onClick={() => {
              setForm(initial);
              setSuccess(false);
            }}
          >
            Create Another
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-page">
      <div className="mb-1 text-xs text-ink-muted">
        <Link to="/partners" className="hover:underline">
          Partner Program
        </Link>
        {' / '}
        <Link to="/partners" className="hover:underline">
          Partners
        </Link>
        {' / '}
        <span className="text-ink">Create Partner</span>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Create Partner</h1>
          <p className="text-sm text-ink-muted">Add a new partner to the program</p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => navigate('/partners')}>Cancel</Btn>
          <Btn variant="primary" disabled={busy || !canWrite} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create Partner'}
          </Btn>
        </div>
      </div>

      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-6">
        <Panel>
          <SectionTitle>Partner Details</SectionTitle>
          <div className="space-y-4">
            <Row>
              <div>
                <p className="mb-2 text-sm font-medium text-ink-secondary">Partner Photo</p>
                <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle text-sm text-ink-muted">
                  + Upload Photo
                </div>
              </div>
              <div className="space-y-4">
                <FormField label="Partner Name" required>
                  <Input value={form.fullName} onChange={set('fullName')} placeholder="Enter full name" />
                </FormField>
                <FormField label="Partner Type" required>
                  <Select value={form.partnerType} onChange={set('partnerType')}>
                    <option value="">Select partner type</option>
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                    <option value="cooperative">Cooperative</option>
                  </Select>
                </FormField>
              </div>
            </Row>
            <Row>
              <FormField label="Mobile Number" required>
                <Input value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" />
              </FormField>
              <FormField label="Email ID" required>
                <Input type="email" value={form.email} onChange={set('email')} placeholder="partner@email.com" />
              </FormField>
            </Row>
            <Row>
              <FormField label="Partner ID">
                <Input value="" disabled placeholder="Auto-generated" />
              </FormField>
              <FormField label="Partner Reference Code">
                <Input value="" disabled placeholder="Auto-generated" />
              </FormField>
            </Row>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Login &amp; App Access</SectionTitle>
          <div className="space-y-4">
            <div>
              <Label>Login ID</Label>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="loginIdType"
                    checked={form.loginIdType === 'mobile'}
                    onChange={() => setForm((p) => ({ ...p, loginIdType: 'mobile' }))}
                  />
                  Mobile Number
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="loginIdType"
                    checked={form.loginIdType === 'email'}
                    onChange={() => setForm((p) => ({ ...p, loginIdType: 'email' }))}
                  />
                  Email ID
                </label>
              </div>
            </div>
            <FormField label="Selected Login ID">
              <Input
                value={form.loginIdType === 'mobile' ? form.phone : form.email}
                disabled
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.createAppAccount}
                onChange={setBool('createAppAccount')}
              />
              Create Partner App Account
            </label>
            <Btn size="sm" disabled>
              Send Activation / Password Creation Link
            </Btn>
            <p className="text-xs text-ink-muted">
              Account Status: <Badge tone="neutral">Not Invited</Badge>
            </p>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>PAN / KYC</SectionTitle>
          <div className="space-y-4">
            <Row>
              <FormField label="PAN Number" required>
                <Input
                  value={form.panNumber}
                  onChange={set('panNumber')}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </FormField>
              <FormField label="Name as per PAN" required>
                <Input value={form.panName} onChange={set('panName')} placeholder="Name" />
              </FormField>
            </Row>
            <FormField label="PAN Card" required>
              <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle text-sm text-ink-muted">
                ↑ Upload PAN Card &nbsp;&nbsp; PDF / JPG / PNG
              </div>
            </FormField>
            <p className="text-xs text-ink-muted">
              KYC Status: <Badge tone="warn">Pending Verification</Badge>
            </p>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Address</SectionTitle>
          <div className="space-y-4">
            <FormField label="Address Line 1" required>
              <Input
                value={form.addressLine1}
                onChange={set('addressLine1')}
                placeholder="House / Building / Street"
              />
            </FormField>
            <FormField label="Address Line 2">
              <Input
                value={form.addressLine2}
                onChange={set('addressLine2')}
                placeholder="Area / Landmark"
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="State" required>
                <Select value={form.state} onChange={set('state')}>
                  <option value="">Select state</option>
                  <option value="Kerala">Kerala</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Maharashtra">Maharashtra</option>
                </Select>
              </FormField>
              <FormField label="District" required>
                <Input value={form.district} onChange={set('district')} placeholder="District" />
              </FormField>
              <FormField label="City / Town" required>
                <Input value={form.city} onChange={set('city')} placeholder="City" />
              </FormField>
            </div>
            <Row>
              <FormField label="Pincode" required>
                <Input value={form.pincode} onChange={set('pincode')} placeholder="673592" maxLength={6} />
              </FormField>
              <FormField label="Territory / Region" required>
                <Select value={form.territory} onChange={set('territory')}>
                  <option value="">Select territory</option>
                </Select>
              </FormField>
            </Row>
            <FormField label="Address Proof">
              <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle text-sm text-ink-muted">
                ↑ Upload Address Proof &nbsp;&nbsp; PDF / JPG / PNG
              </div>
            </FormField>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Bank Details</SectionTitle>
          <div className="space-y-4">
            <Row>
              <FormField label="Account Holder Name" required>
                <Input
                  value={form.bankAccountHolder}
                  onChange={set('bankAccountHolder')}
                />
              </FormField>
              <FormField label="Bank Name" required>
                <Select value={form.bankName} onChange={set('bankName')}>
                  <option value="">Select bank</option>
                  <option value="SBI">State Bank of India</option>
                  <option value="HDFC">HDFC Bank</option>
                  <option value="ICICI">ICICI Bank</option>
                  <option value="Axis">Axis Bank</option>
                  <option value="PNB">Punjab National Bank</option>
                  <option value="BOB">Bank of Baroda</option>
                  <option value="other">Other</option>
                </Select>
              </FormField>
            </Row>
            <Row>
              <FormField label="Account Number" required>
                <Input value={form.accountNumber} onChange={set('accountNumber')} />
              </FormField>
              <FormField label="Confirm Account Number" required>
                <Input value={form.confirmAccountNumber} onChange={set('confirmAccountNumber')} />
              </FormField>
            </Row>
            <Row>
              <FormField label="IFSC Code" required>
                <Input value={form.ifscCode} onChange={set('ifscCode')} />
              </FormField>
              <FormField label="Branch Name">
                <Input value={form.branchName} onChange={set('branchName')} />
              </FormField>
            </Row>
            <FormField label="Bank Proof / Cancelled Cheque" required>
              <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle text-sm text-ink-muted">
                ↑ Upload Bank Proof &nbsp;&nbsp; PDF / JPG / PNG
              </div>
            </FormField>
            <p className="text-xs text-ink-muted">
              Bank Verification: <Badge tone="warn">Pending</Badge>
            </p>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Assignment</SectionTitle>
          <Row>
            <FormField label="Crop Advisor" required>
              <Select value={form.cropAdvisor} onChange={set('cropAdvisor')}>
                <option value="">Select Crop Advisor</option>
              </Select>
            </FormField>
            <FormField label="Territory / Region" required>
              <Select value={form.territory} onChange={set('territory')}>
                <option value="">Select territory</option>
              </Select>
            </FormField>
          </Row>
        </Panel>

        <Panel>
          <SectionTitle>Documents</SectionTitle>
          <FormField label="Other Document">
            <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle text-sm text-ink-muted">
              ↑ Upload Document
            </div>
          </FormField>
        </Panel>

        <Panel>
          <SectionTitle>Notes</SectionTitle>
          <textarea
            className={textareaClass}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Add internal notes about this partner..."
            rows={3}
          />
        </Panel>

        <div className="flex justify-end gap-3 pb-8">
          <Btn disabled={busy}>Save Draft</Btn>
          <Btn variant="primary" disabled={busy || !canWrite} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create Partner'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
