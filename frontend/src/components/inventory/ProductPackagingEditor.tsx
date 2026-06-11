import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSuperAdminConfirm } from '../../hooks/useSuperAdminConfirm';
import { Modal, Field, inputClass } from '../Modal';
import { Alert, Btn, StaticSelect } from '../ui';
import { WMS_API } from '../warehouse/warehouse-api';

export type ProductPackagingProfile = {
  itemWeightKg: number | null;
  unitsPerBox: number | null;
  packagingCategoryId: string | null;
  packagingCategoryName: string | null;
  preferredBoxId: string | null;
  preferredBoxCode: string | null;
  preferredBoxName: string | null;
  isFragile: boolean;
  isLiquid: boolean;
  stackable: boolean;
};

type PackagingCategory = { id: string; name: string; active: boolean };
type ShippingBox = { id: string; code: string; name: string; active: boolean };

type Props = {
  inventoryItemId: string;
  productTitle: string;
  sku: string;
  packaging: ProductPackagingProfile | null;
  open: boolean;
  onClose: () => void;
  onSaved: (packaging: ProductPackagingProfile) => void;
};

export function ProductPackagingEditor({
  inventoryItemId,
  productTitle,
  sku,
  packaging,
  open,
  onClose,
  onSaved,
}: Props) {
  const { requestConfirm, confirmModal } = useSuperAdminConfirm();
  const [categories, setCategories] = useState<PackagingCategory[]>([]);
  const [boxes, setBoxes] = useState<ShippingBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [weightKg, setWeightKg] = useState('');
  const [unitsPerBox, setUnitsPerBox] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [boxId, setBoxId] = useState('');
  const [isFragile, setIsFragile] = useState(false);
  const [isLiquid, setIsLiquid] = useState(false);
  const [stackable, setStackable] = useState(true);

  const loadMasters = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, b] = await Promise.all([
        api<{ ok: boolean; categories: PackagingCategory[] }>(`${WMS_API}/packaging/categories`),
        api<{ ok: boolean; boxes: ShippingBox[] }>(`${WMS_API}/shipping-boxes`),
      ]);
      setCategories((c.categories ?? []).filter((x) => x.active));
      setBoxes((b.boxes ?? []).filter((x) => x.active));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packaging options');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadMasters();
    const p = packaging;
    setWeightKg(p?.itemWeightKg != null ? String(p.itemWeightKg) : '');
    setUnitsPerBox(p?.unitsPerBox != null ? String(p.unitsPerBox) : '');
    setCategoryId(p?.packagingCategoryId ?? '');
    setBoxId(p?.preferredBoxId ?? '');
    setIsFragile(Boolean(p?.isFragile));
    setIsLiquid(Boolean(p?.isLiquid));
    setStackable(p?.stackable !== false);
  }, [open, packaging, loadMasters]);

  function save() {
    requestConfirm('edit', productTitle, async (confirmPassword) => {
      setSaving(true);
      setError('');
      try {
        const weight = weightKg.trim() ? Number(weightKg) : null;
        const units = unitsPerBox.trim() ? Number(unitsPerBox) : null;
        const r = await api<{
          ok: boolean;
          item: {
            id: string;
            packaging: ProductPackagingProfile | null;
          };
        }>(`${WMS_API}/inventory-items/${inventoryItemId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            itemWeightKg: weight,
            unitsPerBox: units,
            packagingCategoryId: categoryId || null,
            preferredBoxId: boxId || null,
            isFragile,
            isLiquid,
            stackable,
            confirmPassword,
          }),
        });
        const saved = r.item.packaging ?? {
          itemWeightKg: weight,
          unitsPerBox: units,
          packagingCategoryId: categoryId || null,
          packagingCategoryName:
            categories.find((c) => c.id === categoryId)?.name ?? null,
          preferredBoxId: boxId || null,
          preferredBoxCode: boxes.find((b) => b.id === boxId)?.code ?? null,
          preferredBoxName: boxes.find((b) => b.id === boxId)?.name ?? null,
          isFragile,
          isLiquid,
          stackable,
        };
        onSaved(saved);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save packaging');
        throw e;
      } finally {
        setSaving(false);
      }
    });
  }

  if (!open) return null;

  return (
    <>
      {confirmModal}
      <Modal
        title="Product packaging"
        onClose={onClose}
        onSave={save}
        saveLabel="Save packaging"
        saving={saving}
      >
        <p className="mb-3 text-sm text-slate-600">
          <strong>{productTitle}</strong>
          <span className="mono text-slate-500"> · {sku}</span>
        </p>
        <p className="mb-4 text-xs text-slate-500">
          Used by the package rule engine for automatic box selection and courier dimensions.
        </p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {loading ? <p className="text-sm text-slate-500">Loading options…</p> : null}
        {!loading ? (
          <>
            <Field label="Dead weight (kg per unit)">
              <input
                className={inputClass}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 0.113 for 1 L liquid"
                inputMode="decimal"
              />
            </Field>
            <Field label="Units per shipping box">
              <input
                className={inputClass}
                value={unitsPerBox}
                onChange={(e) => setUnitsPerBox(e.target.value)}
                placeholder="e.g. 10 (10 L per box → 100 L order = 10 boxes)"
                inputMode="decimal"
              />
            </Field>
            <Field label="Packaging category">
              <StaticSelect
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  { value: '', label: '— Select category —' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
            <Field label="Preferred box (optional)">
              <StaticSelect
                value={boxId}
                onChange={setBoxId}
                options={[
                  { value: '', label: '— Use package rules —' },
                  ...boxes.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
                ]}
              />
            </Field>
            <div className="product-packaging-flags">
              <label className="product-packaging-flag">
                <input type="checkbox" checked={isFragile} onChange={(e) => setIsFragile(e.target.checked)} />
                Fragile
              </label>
              <label className="product-packaging-flag">
                <input type="checkbox" checked={isLiquid} onChange={(e) => setIsLiquid(e.target.checked)} />
                Liquid
              </label>
              <label className="product-packaging-flag">
                <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} />
                Stackable
              </label>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}

export function packagingSummaryLabel(p: ProductPackagingProfile | null | undefined): string {
  if (!p) return 'Not set';
  const parts: string[] = [];
  if (p.itemWeightKg != null) parts.push(`${p.itemWeightKg} kg`);
  if (p.packagingCategoryName) parts.push(p.packagingCategoryName);
  if (p.preferredBoxCode) parts.push(`→ ${p.preferredBoxCode}`);
  return parts.length ? parts.join(' · ') : 'Not set';
}
