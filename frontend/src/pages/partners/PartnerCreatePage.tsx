import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { readFileAsBase64 } from '../../lib/readFileAsBase64';
import {
  Alert,
  Badge,
  Btn,
  FileDropzone,
  FormField,
  FormRow,
  FormSection,
  Input,
  Label,
  PageHeader,
  Panel,
  ReadOnlyBanner,
  Select,
  textareaClass,
  type PendingUpload,
} from '../../components/ui';

const base = '/morbeez-staff/api/v1/partners';
const mediaUpload = '/morbeez-staff/api/v1/products/media/upload';

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

async function uploadPartnerFile(file: File, folder: string) {
  const dataBase64 = await readFileAsBase64(file);
  const res = await api<{ ok: boolean; url: string }>(mediaUpload, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      productId: 'partners',
      folder,
    }),
  });
  return res.url;
}

export function PartnerCreatePage({ canWrite }: { canWrite: boolean }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdPartnerId, setCreatedPartnerId] = useState<string | null>(null);
  const [activationInfo, setActivationInfo] = useState<{
    sent: boolean;
    message: string;
    deliveryError?: string | null;
  } | null>(null);
  const [partnerPhoto, setPartnerPhoto] = useState<PendingUpload | null>(null);
  const [panCard, setPanCard] = useState<PendingUpload | null>(null);
  const [addressProof, setAddressProof] = useState<PendingUpload | null>(null);
  const [bankProof, setBankProof] = useState<PendingUpload | null>(null);
  const [otherDocument, setOtherDocument] = useState<PendingUpload | null>(null);

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
      const uploads: Record<string, string> = {};
      if (partnerPhoto) uploads.photoUrl = await uploadPartnerFile(partnerPhoto.file, 'photos');
      if (panCard) uploads.panCardUrl = await uploadPartnerFile(panCard.file, 'kyc');
      if (addressProof) uploads.addressProofUrl = await uploadPartnerFile(addressProof.file, 'address');
      if (bankProof) uploads.bankProofUrl = await uploadPartnerFile(bankProof.file, 'bank');
      if (otherDocument) uploads.otherDocumentUrl = await uploadPartnerFile(otherDocument.file, 'documents');

      const res = await api<{
        ok: boolean;
        partner?: { id: string; partnerCode?: string; fullName?: string };
        activation?: { sent: boolean; message: string; deliveryError?: string | null };
      }>(base, {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          state: form.state || undefined,
          district: form.district || undefined,
          village: form.city || undefined,
          experienceNotes: form.notes || undefined,
          createAppAccount: form.createAppAccount,
          sendActivation: form.createAppAccount,
          metadata: {
            partnerType: form.partnerType || undefined,
            panNumber: form.panNumber || undefined,
            panName: form.panName || undefined,
            territory: form.territory || undefined,
            cropAdvisor: form.cropAdvisor || undefined,
            addressLine1: form.addressLine1 || undefined,
            addressLine2: form.addressLine2 || undefined,
            pincode: form.pincode || undefined,
            bankDetails: form.accountNumber
              ? {
                  accountHolder: form.bankAccountHolder,
                  bankName: form.bankName,
                  ifscCode: form.ifscCode,
                  branchName: form.branchName || undefined,
                }
              : undefined,
            uploads: Object.keys(uploads).length ? uploads : undefined,
          },
        }),
      });
      setCreatedPartnerId(res.partner?.id ?? null);
      setActivationInfo(
        res.activation
          ? {
              sent: res.activation.sent,
              message: res.activation.message,
              deliveryError: res.activation.deliveryError,
            }
          : null
      );
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create partner');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          Partner created successfully and is now active in the Partners list.
          {activationInfo?.sent
            ? ' An activation message was sent on WhatsApp.'
            : activationInfo
              ? ' WhatsApp delivery failed — copy the invite message below and send it manually.'
              : ''}
        </Alert>
        {activationInfo && !activationInfo.sent ? (
          <Panel title="Activation message (send manually)">
            {activationInfo.deliveryError ? (
              <p className="mb-2 text-xs text-ink-muted">Delivery error: {activationInfo.deliveryError}</p>
            ) : null}
            <pre className="whitespace-pre-wrap rounded border border-border bg-surface-subtle p-3 text-sm text-ink">
              {activationInfo.message}
            </pre>
          </Panel>
        ) : null}
        <div className="flex gap-3">
          <Btn
            variant="primary"
            onClick={() =>
              navigate(createdPartnerId ? `/partners/${createdPartnerId}` : '/partners?tab=partners')
            }
          >
            {createdPartnerId ? 'Open Partner' : 'Back to Partners'}
          </Btn>
          <Btn
            onClick={() => {
              setForm(initial);
              setPartnerPhoto(null);
              setPanCard(null);
              setAddressProof(null);
              setBankProof(null);
              setOtherDocument(null);
              setCreatedPartnerId(null);
              setActivationInfo(null);
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
    <div className="space-y-5 sm:space-y-6">
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

      <PageHeader
        title="Create Partner"
        description="Add a new partner to the program"
        showTitleOnDesktop
        actions={
          <>
            <Btn onClick={() => navigate('/partners')}>Cancel</Btn>
            <Btn variant="primary" disabled={busy || !canWrite} onClick={() => void submit()}>
              {busy ? 'Creating…' : 'Create Partner'}
            </Btn>
          </>
        }
      />

      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-5">
        <FormSection title="Partner Details">
          <div className="space-y-4">
            <FormRow>
              <div>
                <p className="mb-2 text-sm font-medium text-ink-secondary">Partner Photo</p>
                <FileDropzone
                  accept="image/jpeg,image/png,image/webp"
                  label="+ Upload Photo"
                  value={partnerPhoto}
                  onChange={setPartnerPhoto}
                  imagePreview
                  disabled={!canWrite || busy}
                  className="h-28 w-28"
                />
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
            </FormRow>
            <FormRow>
              <FormField label="Mobile Number" required>
                <Input value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" />
              </FormField>
              <FormField label="Email ID" required>
                <Input type="email" value={form.email} onChange={set('email')} placeholder="partner@email.com" />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Partner ID">
                <Input value="" disabled placeholder="Auto-generated" />
              </FormField>
              <FormField label="Partner Reference Code">
                <Input value="" disabled placeholder="Auto-generated" />
              </FormField>
            </FormRow>
          </div>
        </FormSection>

        <FormSection title="Login & App Access">
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
              Create Partner App Account &amp; send activation WhatsApp
            </label>
            <p className="text-xs text-ink-muted">
              On create, the partner becomes <Badge tone="active">active</Badge> and can sign in to
              the Partner app with their mobile number via OTP. Activation is sent automatically when
              this box is checked.
            </p>
          </div>
        </FormSection>

        <FormSection title="PAN / KYC">
          <div className="space-y-4">
            <FormRow>
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
            </FormRow>
            <FormField label="PAN Card" required>
              <FileDropzone
                accept="image/jpeg,image/png,image/webp,application/pdf"
                label="↑ Upload PAN Card"
                hint="PDF / JPG / PNG"
                value={panCard}
                onChange={setPanCard}
                disabled={!canWrite || busy}
              />
            </FormField>
            <p className="text-xs text-ink-muted">
              KYC Status: <Badge tone="warn">Pending Verification</Badge>
            </p>
          </div>
        </FormSection>

        <FormSection title="Address">
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
            <FormRow>
              <FormField label="Pincode" required>
                <Input value={form.pincode} onChange={set('pincode')} placeholder="673592" maxLength={6} />
              </FormField>
              <FormField label="Territory / Region" required>
                <Select value={form.territory} onChange={set('territory')}>
                  <option value="">Select territory</option>
                </Select>
              </FormField>
            </FormRow>
            <FormField label="Address Proof">
              <FileDropzone
                accept="image/jpeg,image/png,image/webp,application/pdf"
                label="↑ Upload Address Proof"
                hint="PDF / JPG / PNG"
                value={addressProof}
                onChange={setAddressProof}
                disabled={!canWrite || busy}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Bank Details">
          <div className="space-y-4">
            <FormRow>
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
            </FormRow>
            <FormRow>
              <FormField label="Account Number" required>
                <Input value={form.accountNumber} onChange={set('accountNumber')} />
              </FormField>
              <FormField label="Confirm Account Number" required>
                <Input value={form.confirmAccountNumber} onChange={set('confirmAccountNumber')} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="IFSC Code" required>
                <Input value={form.ifscCode} onChange={set('ifscCode')} />
              </FormField>
              <FormField label="Branch Name">
                <Input value={form.branchName} onChange={set('branchName')} />
              </FormField>
            </FormRow>
            <FormField label="Bank Proof / Cancelled Cheque" required>
              <FileDropzone
                accept="image/jpeg,image/png,image/webp,application/pdf"
                label="↑ Upload Bank Proof"
                hint="PDF / JPG / PNG"
                value={bankProof}
                onChange={setBankProof}
                disabled={!canWrite || busy}
              />
            </FormField>
            <p className="text-xs text-ink-muted">
              Bank Verification: <Badge tone="warn">Pending</Badge>
            </p>
          </div>
        </FormSection>

        <FormSection title="Assignment">
          <FormRow>
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
          </FormRow>
        </FormSection>

        <FormSection title="Documents">
          <FormField label="Other Document">
            <FileDropzone
              accept="image/jpeg,image/png,image/webp,application/pdf"
              label="↑ Upload Document"
              value={otherDocument}
              onChange={setOtherDocument}
              disabled={!canWrite || busy}
            />
          </FormField>
        </FormSection>

        <FormSection title="Notes">
          <textarea
            className={textareaClass}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Add internal notes about this partner..."
            rows={3}
          />
        </FormSection>

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
