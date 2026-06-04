import {
  BRANDS,
  CATEGORIES,
  FORMULATION_TYPES,
  MODE_OF_ENTRY,
  PACK_MATERIALS,
  PACKING_TYPES,
  PRODUCT_TYPES,
  SHELF_LIFE_OPTIONS,
  STORAGE_OPTIONS,
  SUB_CATEGORIES,
} from '../constants';
import { WizardField, pwInputClass, pwSelectClass, pwTextareaClass } from '../WizardField';
import type { WizardFormState } from '../types';
import { readFileAsBase64 } from '../../../../lib/readFileAsBase64';

type Props = {
  state: WizardFormState;
  onChange: (next: WizardFormState) => void;
  productId: string | null;
  onUploadServerImage: (file: File, alt?: string) => Promise<void>;
};

export function Step1BasicInformation({ state, onChange, productId, onUploadServerImage }: Props) {
  const b = state.basic;

  function patchBasic(partial: Partial<typeof b>) {
    onChange({ ...state, basic: { ...b, ...partial } });
  }

  function patchBenefit(idx: number, value: string) {
    const benefits = [...b.benefits];
    benefits[idx] = value;
    patchBasic({ benefits });
  }

  async function onImageFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = [...state.pendingImages];
    for (const file of Array.from(files)) {
      const dataBase64 = await readFileAsBase64(file);
      added.push({
        id: `pending-${Date.now()}-${Math.random()}`,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        dataBase64,
        isPrimary: added.length === 0,
      });
    }
    onChange({ ...state, pendingImages: added });
  }

  async function uploadPending(imgId: string) {
    const img = state.pendingImages.find((i) => i.id === imgId);
    if (!img || !productId) return;
    const file = await fetch(img.previewUrl)
      .then((r) => r.blob())
      .then((blob) => new File([blob], img.fileName, { type: img.mimeType }));
    await onUploadServerImage(file, img.alt);
    onChange({
      ...state,
      pendingImages: state.pendingImages.filter((i) => i.id !== imgId),
    });
  }

  const shortLen = b.shortDescription.length;
  const longLen = b.longDescription.length;
  const safetyLen = b.safetyInstructions.length;

  const allImages = [
    ...state.images.map((img) => ({ kind: 'server' as const, img })),
    ...state.pendingImages.map((img) => ({ kind: 'pending' as const, img })),
  ];

  return (
    <div className="pw-step1-layout">
      <div className="pw-step1-main">
        <h2 className="pw-section-title">Basic Information</h2>
        <div className="pw-grid pw-grid--3">
          <WizardField label="Brand Name" required>
            <select
              className={pwSelectClass()}
              value={b.brandName}
              onChange={(e) => patchBasic({ brandName: e.target.value })}
            >
              {BRANDS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Trade Name" required>
            <input
              className={pwInputClass()}
              value={b.tradeName}
              onChange={(e) => patchBasic({ tradeName: e.target.value })}
              placeholder="Chakraveer"
            />
          </WizardField>
          <WizardField label="Technical Name" required>
            <input
              className={pwInputClass()}
              value={b.technicalName}
              onChange={(e) => patchBasic({ technicalName: e.target.value })}
              placeholder="Chlorantraniliprole 18.5 SC"
            />
          </WizardField>
          <WizardField label="Category" required>
            <select
              className={pwSelectClass()}
              value={b.category}
              onChange={(e) => patchBasic({ category: e.target.value })}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Sub Category" required>
            <select
              className={pwSelectClass()}
              value={b.subCategory}
              onChange={(e) => patchBasic({ subCategory: e.target.value })}
            >
              <option value="">Select sub category</option>
              {SUB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Formulation Type" required>
            <select
              className={pwSelectClass()}
              value={b.formulationType}
              onChange={(e) => patchBasic({ formulationType: e.target.value })}
            >
              <option value="">Select formulation</option>
              {FORMULATION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Technical Content" required>
            <input
              className={pwInputClass()}
              value={b.technicalContent}
              onChange={(e) => patchBasic({ technicalContent: e.target.value })}
              placeholder="Chlorantraniliprole 18.5 % w/w"
            />
          </WizardField>
          <WizardField label="CAS Number">
            <input
              className={pwInputClass()}
              value={b.casNumber}
              onChange={(e) => patchBasic({ casNumber: e.target.value })}
              placeholder="736994-63-1"
            />
          </WizardField>
          <WizardField label="HSN Code">
            <input
              className={pwInputClass()}
              value={b.hsnCode}
              onChange={(e) => patchBasic({ hsnCode: e.target.value })}
              placeholder="3808"
            />
          </WizardField>
          <WizardField label="Product Type">
            <select
              className={pwSelectClass()}
              value={b.productType}
              onChange={(e) => patchBasic({ productType: e.target.value })}
            >
              <option value="">Select type</option>
              {PRODUCT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Mode of Action" required>
            <input
              className={pwInputClass()}
              value={b.modeOfAction}
              onChange={(e) => patchBasic({ modeOfAction: e.target.value })}
              placeholder="Activates ryanodine receptors"
            />
          </WizardField>
          <WizardField label="Mode of Entry" required>
            <select
              className={pwSelectClass()}
              value={b.modeOfEntry}
              onChange={(e) => patchBasic({ modeOfEntry: e.target.value })}
            >
              <option value="">Select mode</option>
              {MODE_OF_ENTRY.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Country of Origin">
            <input
              className={pwInputClass()}
              value={b.countryOfOrigin}
              onChange={(e) => patchBasic({ countryOfOrigin: e.target.value })}
            />
          </WizardField>
          <WizardField label="GST %" required>
            <input
              className={pwInputClass()}
              value={b.gstPercent}
              onChange={(e) => patchBasic({ gstPercent: e.target.value })}
            />
          </WizardField>
        </div>

        <WizardField label="Short Description" required full counter={`${shortLen} / 160`}>
          <input
            className={pwInputClass()}
            maxLength={160}
            value={b.shortDescription}
            onChange={(e) => patchBasic({ shortDescription: e.target.value })}
          />
        </WizardField>

        <WizardField label="Long Description" required full counter={`${longLen} / 1000`}>
          <div className="pw-rte-toolbar">
            <button type="button" className="pw-rte-btn" title="Bold">
              B
            </button>
            <button type="button" className="pw-rte-btn" title="Italic">
              I
            </button>
            <button type="button" className="pw-rte-btn" title="Underline">
              U
            </button>
            <span className="pw-rte-divider" />
            <button type="button" className="pw-rte-btn" title="Bullet list">
              •
            </button>
            <button type="button" className="pw-rte-btn" title="Numbered list">
              1.
            </button>
          </div>
          <textarea
            className={pwTextareaClass()}
            rows={6}
            maxLength={1000}
            value={b.longDescription}
            onChange={(e) => patchBasic({ longDescription: e.target.value })}
          />
        </WizardField>

        <div className="pw-flags">
          <label className="pw-check">
            <input
              type="checkbox"
              checked={b.featured}
              onChange={(e) => patchBasic({ featured: e.target.checked })}
            />
            Featured Product
          </label>
          <label className="pw-check">
            <input
              type="checkbox"
              checked={b.bestSeller}
              onChange={(e) => patchBasic({ bestSeller: e.target.checked })}
            />
            Best Seller
          </label>
          <label className="pw-check">
            <input
              type="checkbox"
              checked={b.trending}
              onChange={(e) => patchBasic({ trending: e.target.checked })}
            />
            Trending Product
          </label>
          <label className="pw-check">
            <input
              type="checkbox"
              checked={b.active}
              onChange={(e) => patchBasic({ active: e.target.checked })}
            />
            Active
          </label>
        </div>

        <section className="pw-subsection">
          <div className="pw-subsection-head">
            <h3>Key Benefits (USP)</h3>
            <button
              type="button"
              className="pw-btn pw-btn--outline-sm"
              onClick={() => patchBasic({ benefits: [...b.benefits, ''] })}
            >
              + Add Benefit
            </button>
          </div>
          {b.benefits.map((line, idx) => (
            <div key={idx} className="pw-benefit-row">
              <span className="pw-drag" aria-hidden>
                ⋮⋮
              </span>
              <input
                className={pwInputClass()}
                value={line}
                onChange={(e) => patchBenefit(idx, e.target.value)}
                placeholder="Benefit description"
              />
              <button
                type="button"
                className="pw-icon-btn"
                aria-label="Remove benefit"
                onClick={() =>
                  patchBasic({
                    benefits: b.benefits.filter((_, i) => i !== idx),
                  })
                }
              >
                🗑
              </button>
            </div>
          ))}
        </section>

        <section className="pw-subsection">
          <h3>Packaging Information</h3>
          <div className="pw-grid pw-grid--3">
            <WizardField label="Shelf Life">
              <select
                className={pwSelectClass()}
                value={b.shelfLife}
                onChange={(e) => patchBasic({ shelfLife: e.target.value })}
              >
                {SHELF_LIFE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </WizardField>
            <WizardField label="Storage Conditions">
              <select
                className={pwSelectClass()}
                value={b.storageConditions}
                onChange={(e) => patchBasic({ storageConditions: e.target.value })}
              >
                {STORAGE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </WizardField>
            <WizardField label="Packing Type">
              <select
                className={pwSelectClass()}
                value={b.packingType}
                onChange={(e) => patchBasic({ packingType: e.target.value })}
              >
                {PACKING_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </WizardField>
            <WizardField label="Pack Material">
              <select
                className={pwSelectClass()}
                value={b.packMaterial}
                onChange={(e) => patchBasic({ packMaterial: e.target.value })}
              >
                {PACK_MATERIALS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </WizardField>
          </div>
          <WizardField label="Safety Instructions" full counter={`${safetyLen} / 200`}>
            <textarea
              className={pwTextareaClass()}
              rows={3}
              maxLength={200}
              value={b.safetyInstructions}
              onChange={(e) => patchBasic({ safetyInstructions: e.target.value })}
            />
          </WizardField>
        </section>
      </div>

      <aside className="pw-step1-aside">
        <div className="pw-aside-card">
          <h3>Product Status</h3>
          <label className="pw-toggle-row">
            <span>Status *</span>
            <span className="pw-toggle">
              <input
                type="checkbox"
                checked={b.active}
                onChange={(e) => patchBasic({ active: e.target.checked })}
              />
              <span className="pw-toggle-ui" />
              <span className="pw-toggle-label">{b.active ? 'Active' : 'Draft'}</span>
            </span>
          </label>
          <WizardField label="Publish On">
            <input
              type="datetime-local"
              className={pwInputClass()}
              value={b.publishOn}
              onChange={(e) => patchBasic({ publishOn: e.target.value })}
            />
          </WizardField>
        </div>

        <div className="pw-aside-card">
          <h3>Product Images</h3>
          <label className="pw-dropzone">
            <input
              type="file"
              accept="image/*"
              multiple
              className="pw-dropzone-input"
              onChange={(e) => void onImageFiles(e.target.files)}
            />
            <span className="pw-dropzone-icon">☁</span>
            <span>Drag &amp; drop images here or Upload Images</span>
            <small>Recommended: 800 × 800 px (1:1)</small>
          </label>
          <div className="pw-thumb-row">
            {allImages.map((item, idx) => {
              if (item.kind === 'server') {
                return (
                  <div
                    key={item.img.id}
                    className={`pw-thumb ${idx === 0 ? 'pw-thumb--primary' : ''}`}
                  >
                    <img src={item.img.src} alt="" />
                    {idx === 0 ? <span className="pw-thumb-tag">Primary</span> : null}
                  </div>
                );
              }
              return (
                <div
                  key={item.img.id}
                  className={`pw-thumb ${item.img.isPrimary ? 'pw-thumb--primary' : ''}`}
                >
                  <img src={item.img.previewUrl} alt="" />
                  {productId ? (
                    <button
                      type="button"
                      className="pw-thumb-upload"
                      onClick={() => void uploadPending(item.img.id)}
                    >
                      Upload
                    </button>
                  ) : (
                    <span className="pw-thumb-tag">Pending</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pw-aside-card">
          <h3>Product Videos</h3>
          <p className="pw-aside-hint">MP4 upload or YouTube link</p>
          <input
            className={pwInputClass()}
            placeholder="https://youtube.com/…"
            value={state.media.youtubeUrl}
            onChange={(e) =>
              onChange({ ...state, media: { ...state.media, youtubeUrl: e.target.value } })
            }
          />
        </div>

        <div className="pw-aside-card">
          <h3>Documents (Label / Brochure / SDS)</h3>
          <label className="pw-dropzone pw-dropzone--compact">
            <input type="file" accept="application/pdf" className="pw-dropzone-input" />
            <span>Upload PDF (Max 5MB each)</span>
          </label>
        </div>
      </aside>
    </div>
  );
}
