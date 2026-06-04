import type { ReactNode } from 'react';
import type { ReactNode } from 'react';
import { WizardField, pwInputClass } from '../WizardField';
import type { WizardFormState } from '../types';

type Props = {
  state: WizardFormState;
  onChange: (next: WizardFormState) => void;
  productId: string | null;
};

function MediaCard({
  title,
  hint,
  icon,
  preview,
  children,
}: {
  title: string;
  hint: string;
  icon: string;
  preview?: ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="pw-media-card">
      <h4>{title}</h4>
      <div className="pw-media-card-body">
        <label className="pw-media-upload">
          <span className="pw-media-upload-icon" aria-hidden>
            {icon}
          </span>
          {children}
          <small>{hint}</small>
        </label>
        {preview ? <div className="pw-media-preview">{preview}</div> : null}
      </div>
    </div>
  );
}

export function Step4Media({ state, onChange, productId }: Props) {
  const primary = state.images[0];

  return (
    <div className="pw-step-panel">
      <h2 className="pw-section-title">Media Upload</h2>
      {!productId ? (
        <p className="pw-hint">
          Save a draft from step 2 to enable direct image uploads to Shopify. You can also add
          media URLs below.
        </p>
      ) : null}
      <div className="pw-media-grid">
        <MediaCard
          title="Product Images"
          icon="☁"
          hint="JPG, PNG (Max 5MB)"
          preview={
            primary ? (
              <img src={primary.src} alt="" className="pw-media-preview-img" />
            ) : state.pendingImages[0] ? (
              <img
                src={state.pendingImages[0].previewUrl}
                alt=""
                className="pw-media-preview-img"
              />
            ) : null
          }
        >
          <span>Upload Images</span>
          <input type="file" accept="image/*" className="pw-dropzone-input" />
        </MediaCard>
        <MediaCard title="Product Video" icon="▶" hint="MP4, YouTube Link">
          <span>Upload video</span>
          <input type="file" accept="video/mp4" className="pw-dropzone-input" />
        </MediaCard>
        <MediaCard title="Label / Sticker" icon="👁" hint="JPG, PNG (Max 5MB)">
          <span>Upload Image</span>
          <input type="file" accept="image/*" className="pw-dropzone-input" />
        </MediaCard>
        <MediaCard title="SDS / Technical Sheet" icon="📄" hint="PDF (Max 10MB)">
          <span>Upload PDF</span>
          <input type="file" accept="application/pdf" className="pw-dropzone-input" />
        </MediaCard>
      </div>

      <div className="pw-media-urls">
        <WizardField label="Product video URL" full>
          <input
            className={pwInputClass()}
            value={state.media.videoUrl}
            onChange={(e) =>
              onChange({ ...state, media: { ...state.media, videoUrl: e.target.value } })
            }
            placeholder="https://…"
          />
        </WizardField>
        <WizardField label="YouTube link" full>
          <input
            className={pwInputClass()}
            value={state.media.youtubeUrl}
            onChange={(e) =>
              onChange({ ...state, media: { ...state.media, youtubeUrl: e.target.value } })
            }
          />
        </WizardField>
        <WizardField label="Label / brochure URL" full>
          <input
            className={pwInputClass()}
            value={state.media.labelUrl}
            onChange={(e) =>
              onChange({ ...state, media: { ...state.media, labelUrl: e.target.value } })
            }
          />
        </WizardField>
        <WizardField label="SDS PDF URL" full>
          <input
            className={pwInputClass()}
            value={state.media.sdsUrl}
            onChange={(e) =>
              onChange({ ...state, media: { ...state.media, sdsUrl: e.target.value } })
            }
          />
        </WizardField>
      </div>

      <label className="pw-brochure-row">
        <span className="pw-brochure-icon">📄</span>
        <span>Brochure (Optional) — PDF (Max 10MB)</span>
        <input type="file" accept="application/pdf" className="pw-dropzone-input" />
      </label>
    </div>
  );
}
