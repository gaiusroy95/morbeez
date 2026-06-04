import { WizardField, pwInputClass, pwTextareaClass } from '../WizardField';
import type { WizardFormState } from '../types';

type Props = {
  state: WizardFormState;
  onChange: (next: WizardFormState) => void;
};

export function Step5ReviewPublish({ state, onChange }: Props) {
  const s = state.seo;
  const title =
    s.seoTitle ||
    state.basic.tradeName ||
    state.basic.technicalName ||
    'Your Product Name';
  const slug = s.urlSlug || 'your-product';
  const desc =
    s.seoDescription ||
    state.basic.shortDescription ||
    'High quality product for better crop protection and higher yield.';

  function patchSeo(partial: Partial<typeof s>) {
    onChange({ ...state, seo: { ...s, ...partial } });
  }

  return (
    <div className="pw-step-panel">
      <h2 className="pw-section-title">SEO information</h2>
      <div className="pw-seo-layout">
        <div className="pw-seo-form">
          <WizardField
            label="SEO Title"
            counter={`${s.seoTitle.length} / 60`}
          >
            <input
              className={pwInputClass()}
              maxLength={60}
              value={s.seoTitle}
              onChange={(e) => patchSeo({ seoTitle: e.target.value })}
              placeholder="Enter SEO title"
            />
          </WizardField>
          <WizardField
            label="SEO Description"
            counter={`${s.seoDescription.length} / 160`}
          >
            <textarea
              className={pwTextareaClass()}
              rows={4}
              maxLength={160}
              value={s.seoDescription}
              onChange={(e) => patchSeo({ seoDescription: e.target.value })}
              placeholder="Enter SEO description"
            />
          </WizardField>
          <WizardField label="URL Slug">
            <input
              className={pwInputClass()}
              value={s.urlSlug}
              onChange={(e) => patchSeo({ urlSlug: e.target.value })}
              placeholder="Enter url slug"
            />
          </WizardField>
        </div>
        <div className="pw-seo-preview-card">
          <h3>Preview</h3>
          <div className="pw-seo-preview">
            <p className="pw-seo-preview-url">
              https://morbeez.com/products/{slug || 'your-product'}
            </p>
            <p className="pw-seo-preview-title">
              {title} - Morbeez Agriculture
            </p>
            <p className="pw-seo-preview-desc">{desc}</p>
          </div>
        </div>
      </div>

      <h3 className="pw-subtitle">Publish Settings</h3>
      <div className="pw-publish-toggles">
        <label className="pw-toggle-row">
          <span>Status</span>
          <span className="pw-toggle">
            <input
              type="checkbox"
              checked={state.basic.active}
              onChange={(e) =>
                onChange({
                  ...state,
                  basic: { ...state.basic, active: e.target.checked },
                })
              }
            />
            <span className="pw-toggle-ui" />
            <span className="pw-toggle-label">
              {state.basic.active ? 'Active' : 'Draft'}
            </span>
          </span>
        </label>
        <label className="pw-toggle-row">
          <span>Featured Product</span>
          <span className="pw-toggle">
            <input
              type="checkbox"
              checked={s.featuredProduct}
              onChange={(e) => patchSeo({ featuredProduct: e.target.checked })}
            />
            <span className="pw-toggle-ui" />
          </span>
        </label>
        <label className="pw-toggle-row">
          <span>Best Seller</span>
          <span className="pw-toggle">
            <input
              type="checkbox"
              checked={s.bestSellerFlag}
              onChange={(e) => patchSeo({ bestSellerFlag: e.target.checked })}
            />
            <span className="pw-toggle-ui" />
          </span>
        </label>
      </div>
    </div>
  );
}
