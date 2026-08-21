import { Field, inputClass } from '../Modal';
import { DynamicMasterPicker } from '../DynamicMasterPicker';
import { useCrmMasters } from '../../lib/useCrmMasters';

export const CROP_PRESETS = [
  { key: 'ginger', label: 'Ginger' },
  { key: 'banana', label: 'Banana' },
  { key: 'pepper', label: 'Pepper' },
  { key: 'cardamom', label: 'Cardamom' },
  { key: '__other__', label: 'Others' },
] as const;

export type CropBlockFormValue = {
  id?: string;
  blockName: string;
  cropKey: string;
  customCropName: string;
  cropMasterId?: string;
  acreage: string;
  plantingDate: string;
  latitude: string;
  longitude: string;
};

export function emptyCropBlock(): CropBlockFormValue {
  return {
    blockName: '',
    cropKey: 'ginger',
    customCropName: '',
    acreage: '',
    plantingDate: '',
    latitude: '',
    longitude: '',
  };
}

export function cropNameFromBlock(b: CropBlockFormValue): string {
  if (b.cropKey === '__other__') return b.customCropName.trim();
  const preset = CROP_PRESETS.find((p) => p.key === b.cropKey);
  return preset?.label ?? b.cropKey;
}

export function cropKeyFromName(cropName: string): Pick<CropBlockFormValue, 'cropKey' | 'customCropName'> {
  const lower = cropName.trim().toLowerCase();
  if (!lower) return { cropKey: 'ginger', customCropName: '' };
  for (const p of CROP_PRESETS) {
    if (p.key === '__other__') continue;
    if (lower === p.key || lower === p.label.toLowerCase()) {
      return { cropKey: p.key, customCropName: '' };
    }
  }
  return { cropKey: '__other__', customCropName: cropName.trim() };
}

export function blockFromApi(row: {
  id?: string;
  blockName?: string;
  name?: string;
  cropName: string;
  acreage?: string | number | null;
  plantingDate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): CropBlockFormValue {
  const { cropKey, customCropName } = cropKeyFromName(row.cropName);
  const blockName = row.blockName ?? row.name ?? '';
  return {
    id: row.id,
    blockName: blockName === '—' ? '' : blockName,
    cropKey,
    customCropName,
    acreage: row.acreage != null && row.acreage !== '—' ? String(row.acreage) : '',
    plantingDate: row.plantingDate ?? '',
    latitude: row.latitude != null ? String(row.latitude) : '',
    longitude: row.longitude != null ? String(row.longitude) : '',
  };
}

export function toApiCropBlock(b: CropBlockFormValue): {
  id?: string;
  blockName: string;
  cropName: string;
  acreage?: number;
  plantingDate?: string;
  latitude?: number;
  longitude?: number;
} | null {
  const cropName = cropNameFromBlock(b);
  if (!cropName) return null;
  const blockName = b.blockName.trim() || `${cropName} Plot`;
  const lat = b.latitude.trim() ? Number(b.latitude) : undefined;
  const lon = b.longitude.trim() ? Number(b.longitude) : undefined;
  return {
    id: b.id,
    blockName,
    cropName,
    acreage: b.acreage.trim() ? Number(b.acreage) : undefined,
    plantingDate: b.plantingDate || undefined,
    latitude: lat != null && Number.isFinite(lat) ? lat : undefined,
    longitude: lon != null && Number.isFinite(lon) ? lon : undefined,
  };
}

type Props = {
  blocks: CropBlockFormValue[];
  onChange: (blocks: CropBlockFormValue[]) => void;
  showLabels?: boolean;
};

function resolveCropMasterId(block: CropBlockFormValue, cropItems: { id: string; name: string }[]): string {
  if (block.cropMasterId) return block.cropMasterId;
  const cropName = cropNameFromBlock(block);
  if (!cropName) return '';
  const match = cropItems.find((item) => item.name.trim().toLowerCase() === cropName.toLowerCase());
  return match?.id ?? '';
}

export function CropBlockFields({ blocks, onChange, showLabels = true }: Props) {
  const { items: cropItems } = useCrmMasters('crop');

  function hasValidGps(block: CropBlockFormValue): boolean {
    const lat = Number(block.latitude);
    const lon = Number(block.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon);
  }

  function normalizeGps(block: CropBlockFormValue): CropBlockFormValue {
    const lat = Number(block.latitude);
    const lon = Number(block.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return block;
    return {
      ...block,
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
    };
  }

  function updateAt(idx: number, patch: Partial<CropBlockFormValue>) {
    const next = [...blocks];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => (
        <div key={b.id ?? `new-${idx}`} className="rounded border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={showLabels ? 'Block name' : undefined}>
              <input
                className={inputClass}
                placeholder="e.g. Ginger Plot"
                value={b.blockName}
                onChange={(e) => updateAt(idx, { blockName: e.target.value })}
              />
            </Field>
            <div className="min-w-0">
              <DynamicMasterPicker
                masterType="crop"
                label={showLabels ? 'Crop' : 'Crop'}
                value={resolveCropMasterId(b, cropItems)}
                onChange={(id, item) =>
                  updateAt(idx, {
                    cropMasterId: id,
                    cropKey: '__other__',
                    customCropName: item?.name ?? '',
                  })
                }
              />
            </div>
            <Field label={showLabels ? 'Acre' : undefined}>
              <input
                className={inputClass}
                placeholder="Acreage"
                inputMode="decimal"
                value={b.acreage}
                onChange={(e) => updateAt(idx, { acreage: e.target.value })}
              />
            </Field>
            <Field label={showLabels ? 'Planted date' : undefined}>
              <input
                type="date"
                className={inputClass}
                value={b.plantingDate}
                onChange={(e) => updateAt(idx, { plantingDate: e.target.value })}
              />
            </Field>
            <Field label={showLabels ? 'Latitude' : undefined}>
              <input
                className={inputClass}
                placeholder="e.g. 11.6850"
                value={b.latitude}
                onChange={(e) => updateAt(idx, { latitude: e.target.value })}
              />
            </Field>
            <Field label={showLabels ? 'Longitude' : undefined}>
              <input
                className={inputClass}
                placeholder="e.g. 76.1320"
                value={b.longitude}
                onChange={(e) => updateAt(idx, { longitude: e.target.value })}
              />
            </Field>
          </div>
          {blocks.length > 1 ? (
            <button
              type="button"
              className="mt-2 text-xs text-red-600 hover:underline"
              onClick={() => onChange(blocks.filter((_, i) => i !== idx))}
            >
              Remove block
            </button>
          ) : null}
          <button
            type="button"
            className="mt-2 ml-3 text-xs font-medium text-ink-secondary hover:underline disabled:cursor-not-allowed disabled:text-ink-muted"
            disabled={!hasValidGps(b)}
            onClick={() => updateAt(idx, normalizeGps(b))}
            title="Save custom latitude/longitude for this block"
          >
            Update GPS
          </button>
        </div>
      ))}
    </div>
  );
}
