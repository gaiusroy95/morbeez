import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import { Alert, DataTable, EmptyState, Loading, SearchSelect, TableWrap, inputClass } from '../ui';
import { CommerceRegistryBanner } from './CommerceRegistryBanner';
import { CommercePromoHeader } from './CommercePromoHeader';
import { CommercePromoTabs } from './CommercePromoTabs';
import { CommerceEditIcon } from './CommerceEditIcon';
type OfferTab = 'all' | 'active' | 'upcoming' | 'expired';

type Offer = {
  id: string;
  name: string;
  type: string;
  offerType: string;
  discount: string;
  minOrder: number;
  validity: string;
  status: string;
  description?: string | null;
};

type Coupon = {
  id: string;
  code: string;
  discount: string;
  minOrder: number;
  usageLabel: string;
  validTill: string;
  status: string;
};

const OFFER_TABS: Array<{ id: OfferTab; label: string }> = [
  { id: 'all', label: 'All Offers' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'expired', label: 'Expired' },
];

function discountDisplay(o: Offer): string {
  if (o.offerType === 'combo') return '—';
  return o.discount;
}

function statusPill(status: string): string {
  if (status === 'active') return 'commerce-promo__status-pill commerce-promo__status-pill--active';
  if (status === 'upcoming') return 'commerce-promo__status-pill commerce-promo__status-pill--upcoming';
  return 'commerce-promo__status-pill commerce-promo__status-pill--expired';
}

function toIsoFromLocal(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

type Props = { canWrite: boolean };

export function CommerceOffersPanel({ canWrite }: Props) {
  const [tab, setTab] = useState<OfferTab>('all');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offerModal, setOfferModal] = useState(false);
  const [couponModal, setCouponModal] = useState(false);
  const [viewOffer, setViewOffer] = useState<Offer | null>(null);
  const [saving, setSaving] = useState(false);

  const [offerForm, setOfferForm] = useState({
    name: '',
    offerType: 'percentage' as 'percentage' | 'combo' | 'flat',
    discountLabel: '',
    minOrderAmount: 0,
    startsAt: '',
    endsAt: '',
    description: '',
  });

  const [couponForm, setCouponForm] = useState({
    code: '',
    discountLabel: '',
    minOrderAmount: 0,
    usageLimit: 500,
    validUntil: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [offersRes, couponsRes] = await Promise.all([
        api<{ ok: boolean; offers: Offer[] }>(`/morbeez-staff/api/v1/offers?tab=${tab}`),
        api<{ ok: boolean; coupons: Coupon[] }>('/morbeez-staff/api/v1/coupons'),
      ]);
      setOffers(offersRes.offers ?? []);
      setCoupons(couponsRes.coupons ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOffer() {
    setSaving(true);
    setError('');
    try {
      await api('/morbeez-staff/api/v1/offers', {
        method: 'POST',
        body: JSON.stringify({
          name: offerForm.name.trim(),
          offerType: offerForm.offerType,
          discountLabel: offerForm.discountLabel.trim(),
          minOrderAmount: Number(offerForm.minOrderAmount) || 0,
          startsAt: toIsoFromLocal(offerForm.startsAt),
          endsAt: toIsoFromLocal(offerForm.endsAt),
          description: offerForm.description.trim() || undefined,
        }),
      });
      setOfferModal(false);
      setOfferForm({
        name: '',
        offerType: 'percentage',
        discountLabel: '',
        minOrderAmount: 0,
        startsAt: '',
        endsAt: '',
        description: '',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create offer');
    } finally {
      setSaving(false);
    }
  }

  async function createCoupon() {
    setSaving(true);
    try {
      await api('/morbeez-staff/api/v1/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code.trim().toUpperCase(),
          discountLabel: couponForm.discountLabel.trim(),
          minOrderAmount: Number(couponForm.minOrderAmount) || 0,
          usageLimit: Number(couponForm.usageLimit) || 500,
          validUntil: toIsoFromLocal(couponForm.validUntil),
        }),
      });
      setCouponModal(false);
      setCouponForm({
        code: '',
        discountLabel: '',
        minOrderAmount: 0,
        usageLimit: 500,
        validUntil: '',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create coupon');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="commerce-promo route-offers offers-page">
      <CommerceRegistryBanner />
      <div className="commerce-promo__registry">
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>

      <CommercePromoHeader
        title="Offers"
        createLabel="+ Create Offer"
        onCreate={() => setOfferModal(true)}
        canWrite={canWrite}
      />

      <CommercePromoTabs tabs={OFFER_TABS} active={tab} onChange={setTab} />

      {loading ? (
        <Loading />
      ) : (
        <div className="commerce-promo__table-card" style={{ marginTop: 0 }}>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Offer Name</th>
                  <th>Type</th>
                  <th>Discount</th>
                  <th>Validity</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {offers.length ? (
                  offers.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span className="commerce-promo__name">{o.name}</span>
                      </td>
                      <td>{o.type}</td>
                      <td className="commerce-promo__discount">{discountDisplay(o)}</td>
                      <td className="commerce-promo__validity">{o.validity}</td>
                      <td>
                        <span className={statusPill(o.status)}>
                          {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <CommerceEditIcon onClick={() => setViewOffer(o)} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="commerce-promo__empty">
                        <EmptyState>No offers in this tab.</EmptyState>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </TableWrap>
        </div>
      )}

      {!loading && coupons.length > 0 ? (
        <section className="commerce-promo__coupons-section">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="commerce-promo__coupons-title">Coupon codes</h3>
            {canWrite ? (
              <button
                type="button"
                className="commerce-promo__btn-primary"
                onClick={() => setCouponModal(true)}
              >
                + Add coupon
              </button>
            ) : null}
          </div>
          <div className="commerce-promo__table-card">
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Usage</th>
                    <th>Valid till</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="commerce-promo__name">{c.code}</span>
                      </td>
                      <td className="commerce-promo__discount">{c.discount}</td>
                      <td>{c.usageLabel}</td>
                      <td className="commerce-promo__validity">{c.validTill}</td>
                      <td>
                        <span className="commerce-promo__status-pill commerce-promo__status-pill--active">
                          {c.status === 'active' ? 'Active' : 'Expired'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </div>
        </section>
      ) : null}

      {offerModal ? (
        <Modal
          title="Create offer"
          onClose={() => setOfferModal(false)}
          onSave={createOffer}
          saving={saving}
        >
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700">
              Offer name
              <input
                className={inputClass}
                value={offerForm.name}
                onChange={(e) => setOfferForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Type
              <SearchSelect
                className={inputClass}
                value={offerForm.offerType}
                onChange={(value) =>
                  setOfferForm((f) => ({
                    ...f,
                    offerType: value as 'percentage' | 'combo' | 'flat',
                  }))
                }
                options={[
                  { value: 'percentage', label: 'Percentage' },
                  { value: 'flat', label: 'Flat' },
                  { value: 'combo', label: 'Combo' },
                ]}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Discount label (e.g. 10% or ₹100 Off)
              <input
                className={inputClass}
                value={offerForm.discountLabel}
                onChange={(e) => setOfferForm((f) => ({ ...f, discountLabel: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Min order (₹)
              <input
                type="number"
                min={0}
                className={inputClass}
                value={offerForm.minOrderAmount}
                onChange={(e) =>
                  setOfferForm((f) => ({ ...f, minOrderAmount: Number(e.target.value) }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Starts
              <input
                type="datetime-local"
                className={inputClass}
                value={offerForm.startsAt}
                onChange={(e) => setOfferForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Ends
              <input
                type="datetime-local"
                className={inputClass}
                value={offerForm.endsAt}
                onChange={(e) => setOfferForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {viewOffer ? (
        <Modal title="Offer details" onClose={() => setViewOffer(null)}>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-semibold">{viewOffer.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd>{viewOffer.type}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Discount</dt>
              <dd>{discountDisplay(viewOffer)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Validity</dt>
              <dd>{viewOffer.validity}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Min order</dt>
              <dd>₹{viewOffer.minOrder.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>{viewOffer.status}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Offer editing is not available yet; create a new offer to replace an expired campaign.
          </p>
        </Modal>
      ) : null}

      {couponModal ? (
        <Modal title="New coupon" onClose={() => setCouponModal(false)} onSave={createCoupon} saving={saving}>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700">
              Code
              <input
                className={inputClass}
                value={couponForm.code}
                onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Discount label
              <input
                className={inputClass}
                value={couponForm.discountLabel}
                onChange={(e) => setCouponForm((f) => ({ ...f, discountLabel: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Valid until
              <input
                type="datetime-local"
                className={inputClass}
                value={couponForm.validUntil}
                onChange={(e) => setCouponForm((f) => ({ ...f, validUntil: e.target.value }))}
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
