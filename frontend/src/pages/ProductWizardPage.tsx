import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { readFileAsBase64 } from '../lib/readFileAsBase64';
import { paths, toPath } from '../lib/routes';
import { buildWizardPayload } from '../components/commerce/product-wizard/buildPayload';
import { ProductWizardHeader } from '../components/commerce/product-wizard/ProductWizardHeader';
import {
  defaultWizardState,
  emptyVariant,
  loadFromProduct,
  mergeIntelligence,
} from '../components/commerce/product-wizard/state';
import { Step1BasicInformation } from '../components/commerce/product-wizard/steps/Step1BasicInformation';
import { Step2VariantsPricing } from '../components/commerce/product-wizard/steps/Step2VariantsPricing';
import { Step3UsageDetails } from '../components/commerce/product-wizard/steps/Step3UsageDetails';
import { Step4Media } from '../components/commerce/product-wizard/steps/Step4Media';
import { Step5ReviewPublish } from '../components/commerce/product-wizard/steps/Step5ReviewPublish';
import type { ProductImage, WizardFormState } from '../components/commerce/product-wizard/types';
import '../styles/product-wizard.css';

type Props = {
  canWrite: boolean;
};

export function ProductWizardPage({ canWrite }: Props) {
  const { productId: routeProductId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(routeProductId);

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardFormState>(() => defaultWizardState());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('route-product-wizard');
    return () => document.body.classList.remove('route-product-wizard');
  }, []);

  const loadProduct = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const [pRes, iRes] = await Promise.all([
        api<{ ok: boolean; product: Record<string, unknown> }>(
          `/morbeez-staff/api/v1/products/${id}`
        ),
        api<{ ok: boolean; intelligence: Record<string, unknown> | null }>(
          `/morbeez-staff/api/v1/products/${id}/intelligence`
        ).catch(() => ({ ok: true, intelligence: null })),
      ]);
      let next = defaultWizardState();
      next = mergeIntelligence(next, iRes.intelligence);
      next = loadFromProduct(next, pRes.product);
      next.productId = id;
      if (!next.seo.seoTitle) {
        next.seo.seoTitle = next.basic.tradeName || next.basic.technicalName;
      }
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load product');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routeProductId) void loadProduct(routeProductId);
  }, [routeProductId, loadProduct]);

  function goCommerce() {
    navigate(toPath(paths.commerce));
  }

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!state.basic.tradeName.trim()) return 'Trade name is required';
      if (!state.basic.technicalName.trim()) return 'Technical name is required';
      if (!state.basic.category) return 'Category is required';
    }
    if (n === 2) {
      const ok = state.basic.variants.some(
        (v) => v.packSize.trim() && v.sellingPrice.trim()
      );
      if (!ok) return 'Add at least one variant with pack size and selling price';
    }
    if (n === 3) {
      const mappings = state.usage.cropMappings;
      if (!mappings.length) return 'Add at least one crop mapping';
      for (let i = 0; i < mappings.length; i++) {
        const m = mappings[i];
        if (!m.crop.trim()) return `Select a crop for mapping ${i + 1}`;
        if (!m.dosageAcre.trim()) return `Dosage per acre is required for mapping ${i + 1}`;
      }
    }
    return null;
  }

  async function persist(status: 'draft' | 'active') {
    const payload = buildWizardPayload(state, status);
    if (!payload.variants.length) {
      payload.variants = [
        {
          ...emptyVariant(),
          packSize: '1',
          unit: 'L',
          mrp: '0',
          sellingPrice: '0',
          dealerPrice: '',
          stock: 0,
        },
      ];
    }

    if (state.productId) {
      const res = await api<{ ok: boolean; product: { id: string; images?: ProductImage[] } }>(
        `/morbeez-staff/api/v1/products/${state.productId}/wizard`,
        { method: 'PUT', body: JSON.stringify(payload) }
      );
      return res.product;
    }

    const res = await api<{ ok: boolean; product: { id: string; images?: ProductImage[] } }>(
      '/morbeez-staff/api/v1/products/wizard',
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return res.product;
  }

  async function uploadPendingImages(productId: string) {
    for (const img of state.pendingImages) {
      await api(`/morbeez-staff/api/v1/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: img.fileName,
          mimeType: img.mimeType,
          dataBase64: img.dataBase64,
          alt: img.alt,
        }),
      });
    }
  }

  async function saveDraft(): Promise<string | null> {
    if (!canWrite) return null;
    const err = validateStep(1);
    if (err) {
      setError(err);
      setStep(1);
      return null;
    }
    setSaving(true);
    setError('');
    try {
      const pending = state.pendingImages;
      const product = await persist('draft');
      const id = product.id;
      if (pending.length) {
        for (const img of pending) {
          await api(`/morbeez-staff/api/v1/products/${id}/images`, {
            method: 'POST',
            body: JSON.stringify({
              fileName: img.fileName,
              mimeType: img.mimeType,
              dataBase64: img.dataBase64,
              alt: img.alt,
            }),
          });
        }
      }
      const refreshed = await api<{ ok: boolean; product: Record<string, unknown> }>(
        `/morbeez-staff/api/v1/products/${id}`
      );
      setState((s) => {
        const next = loadFromProduct(
          { ...s, productId: id, pendingImages: [] },
          refreshed.product
        );
        return next;
      });
      if (!routeProductId) {
        navigate(toPath(`${paths.commerce}/products/${id}/edit`), { replace: true });
      }
      return id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save draft');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!canWrite) return;
    for (let s = 1; s <= 3; s++) {
      const err = validateStep(s);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const active = state.basic.active;
      const product = await persist(active ? 'active' : 'draft');
      const id = product.id;
      if (state.pendingImages.length) {
        await uploadPendingImages(id);
      }
      goCommerce();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish product');
    } finally {
      setSaving(false);
    }
  }

  async function onUploadServerImage(file: File, alt?: string) {
    if (!state.productId) return;
    const dataBase64 = await readFileAsBase64(file);
    await api(`/morbeez-staff/api/v1/products/${state.productId}/images`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        dataBase64,
        alt,
      }),
    });
    const refreshed = await api<{ ok: boolean; product: Record<string, unknown> }>(
      `/morbeez-staff/api/v1/products/${state.productId}`
    );
    setState((s) => loadFromProduct(s, refreshed.product));
  }

  async function onNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    if (step === 2 && !state.productId) {
      const id = await saveDraft();
      if (!id) return;
    }
    if (step < 5) setStep(step + 1);
  }

  function onBack() {
    setError('');
    if (step > 1) setStep(step - 1);
  }

  function onGoToStep(n: number) {
    if (n < step) {
      setError('');
      setStep(n);
    }
  }

  if (!canWrite) {
    return (
      <div className="pw-page">
        <p className="pw-error">You do not have permission to edit products.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pw-page">
        <p className="pw-loading">Loading product…</p>
      </div>
    );
  }

  return (
    <div className="pw-page">
      <ProductWizardHeader
        step={step}
        saving={saving}
        canWrite={canWrite}
        onCancel={goCommerce}
        onSaveDraft={() => void saveDraft()}
        onPublish={() => void publish()}
        onGoToStep={onGoToStep}
      />

      {error ? (
        <div className="pw-error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="pw-body">
        {step === 1 ? (
          <Step1BasicInformation
            state={state}
            onChange={setState}
            productId={state.productId}
            onUploadServerImage={onUploadServerImage}
            canWrite={canWrite}
          />
        ) : null}
        {step === 2 ? <Step2VariantsPricing state={state} onChange={setState} /> : null}
        {step === 3 ? <Step3UsageDetails state={state} onChange={setState} /> : null}
        {step === 4 ? (
          <Step4Media
            state={state}
            onChange={setState}
            productId={state.productId}
            onUploadServerImage={onUploadServerImage}
            onError={setError}
          />
        ) : null}
        {step === 5 ? <Step5ReviewPublish state={state} onChange={setState} /> : null}
      </div>

      <footer className="pw-footer">
        {step > 1 ? (
          <button type="button" className="pw-btn pw-btn--ghost" onClick={onBack}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < 5 ? (
          <button
            type="button"
            className="pw-btn pw-btn--primary"
            disabled={saving}
            onClick={() => void onNext()}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="pw-btn pw-btn--primary"
            disabled={saving}
            onClick={() => void publish()}
          >
            Publish
          </button>
        )}
      </footer>
    </div>
  );
}
