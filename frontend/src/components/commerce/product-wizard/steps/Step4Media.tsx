import { useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../../../lib/api';
import { readFileAsBase64 } from '../../../../lib/readFileAsBase64';
import { WizardField, pwInputClass } from '../WizardField';
import type { WizardFormState } from '../types';

type Props = {
  state: WizardFormState;
  onChange: (next: WizardFormState) => void;
  productId: string | null;
  onUploadServerImage?: (file: File, alt?: string) => Promise<void>;
  onError?: (message: string) => void;
};

function MediaCard({
  title,
  hint,
  icon,
  preview,
  accept,
  busy,
  onFile,
  uploadLabel,
}: {
  title: string;
  hint: string;
  icon: string;
  preview?: ReactNode;
  accept: string;
  busy?: boolean;
  uploadLabel: string;
  onFile: (file: File) => void | Promise<void>;
}) {
  return (
    <div className="pw-media-card">
      <h4>{title}</h4>
      <div className="pw-media-card-body">
        <label className={`pw-media-upload${busy ? ' pw-media-upload--busy' : ''}`}>
          <span className="pw-media-upload-icon" aria-hidden>
            {icon}
          </span>
          <span>{busy ? 'Uploading…' : uploadLabel}</span>
          <small>{hint}</small>
          <input
            type="file"
            accept={accept}
            className="pw-dropzone-input"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onFile(file);
            }}
          />
        </label>
        {preview ? <div className="pw-media-preview">{preview}</div> : null}
      </div>
    </div>
  );
}

export function Step4Media({ state, onChange, productId, onUploadServerImage, onError }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const primary = state.images[0];
  const pendingPrimary = state.pendingImages[0];

  async function uploadAsset(key: string, file: File, folder: 'video' | 'label' | 'sds' | 'brochure') {
    setBusyKey(key);
    try {
      const dataBase64 = await readFileAsBase64(file);
      const res = await api<{ ok: boolean; url: string }>(
        '/morbeez-staff/api/v1/products/media/upload',
        {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataBase64,
            productId: productId ?? undefined,
            folder,
          }),
        }
      );
      onChange({
        ...state,
        media: { ...state.media, ...mapPatchFromFolder(folder, res.url) },
      });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusyKey(null);
    }
  }

  function mapPatchFromFolder(
    folder: 'video' | 'label' | 'sds' | 'brochure',
    url: string
  ): Partial<WizardFormState['media']> {
    if (folder === 'video') return { videoUrl: url };
    if (folder === 'label') return { labelUrl: url };
    if (folder === 'sds') return { sdsUrl: url };
    return { brochureUrl: url };
  }

  async function onProductImages(file: File) {
    if (!file.type.startsWith('image/')) {
      onError?.('Please choose a JPG or PNG image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError?.('Image must be 5MB or smaller');
      return;
    }

    setBusyKey('images');
    try {
      if (productId && onUploadServerImage) {
        await onUploadServerImage(file, state.basic.tradeName || undefined);
        return;
      }

      const dataBase64 = await readFileAsBase64(file);
      onChange({
        ...state,
        pendingImages: [
          ...state.pendingImages,
          {
            id: `pending-${Date.now()}-${Math.random()}`,
            previewUrl: URL.createObjectURL(file),
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            dataBase64,
            isPrimary: state.pendingImages.length === 0 && state.images.length === 0,
          },
        ],
      });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setBusyKey(null);
    }
  }

  async function onProductVideo(file: File) {
    if (!file.type.startsWith('video/')) {
      onError?.('Please choose an MP4 video file');
      return;
    }
    await uploadAsset('video', file, 'video');
  }

  async function onLabelImage(file: File) {
    if (!file.type.startsWith('image/')) {
      onError?.('Please choose a JPG or PNG image');
      return;
    }
    await uploadAsset('label', file, 'label');
  }

  async function onSdsPdf(file: File) {
    if (file.type !== 'application/pdf') {
      onError?.('Please choose a PDF file');
      return;
    }
    await uploadAsset('sds', file, 'sds');
  }

  async function onBrochurePdf(file: File) {
    if (file.type !== 'application/pdf') {
      onError?.('Please choose a PDF file');
      return;
    }
    await uploadAsset('brochure', file, 'brochure');
  }

  const imagePreview = primary ? (
    <img src={primary.src} alt="" className="pw-media-preview-img" />
  ) : pendingPrimary ? (
    <img src={pendingPrimary.previewUrl} alt="" className="pw-media-preview-img" />
  ) : null;

  const labelPreview =
    state.media.labelUrl && state.media.labelUrl.match(/\.(png|jpe?g|webp|gif)(\?|$)/i) ? (
      <img src={state.media.labelUrl} alt="" className="pw-media-preview-img" />
    ) : state.media.labelUrl ? (
      <a href={state.media.labelUrl} target="_blank" rel="noreferrer" className="pw-media-file-link">
        Label uploaded
      </a>
    ) : null;

  return (
    <div className="pw-step-panel">
      <h2 className="pw-section-title">Media Upload</h2>
      {!productId ? (
        <p className="pw-hint">
          Product images are queued until you save a draft (step 2 → Next). Videos and documents
          upload immediately and are saved when you publish.
        </p>
      ) : null}
      <div className="pw-media-grid">
        <MediaCard
          title="Product Images"
          icon="☁"
          hint="JPG, PNG (Max 5MB)"
          accept="image/jpeg,image/png,image/webp"
          uploadLabel="Upload Images"
          busy={busyKey === 'images'}
          onFile={onProductImages}
          preview={imagePreview}
        />
        <MediaCard
          title="Product Video"
          icon="▶"
          hint="MP4 (Max 50MB)"
          accept="video/mp4,video/quicktime"
          uploadLabel="Upload video"
          busy={busyKey === 'video'}
          onFile={onProductVideo}
          preview={
            state.media.videoUrl ? (
              <video
                src={state.media.videoUrl}
                className="pw-media-preview-video"
                controls
                preload="metadata"
              />
            ) : null
          }
        />
        <MediaCard
          title="Label / Sticker"
          icon="👁"
          hint="JPG, PNG (Max 5MB)"
          accept="image/jpeg,image/png,image/webp"
          uploadLabel="Upload Image"
          busy={busyKey === 'label'}
          onFile={onLabelImage}
          preview={labelPreview}
        />
        <MediaCard
          title="SDS / Technical Sheet"
          icon="📄"
          hint="PDF (Max 10MB)"
          accept="application/pdf"
          uploadLabel="Upload PDF"
          busy={busyKey === 'sds'}
          onFile={onSdsPdf}
          preview={
            state.media.sdsUrl ? (
              <a href={state.media.sdsUrl} target="_blank" rel="noreferrer" className="pw-media-file-link">
                SDS uploaded
              </a>
            ) : null
          }
        />
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

      <label className={`pw-brochure-row${busyKey === 'brochure' ? ' pw-media-upload--busy' : ''}`}>
        <span className="pw-brochure-icon">📄</span>
        <span>{busyKey === 'brochure' ? 'Uploading brochure…' : 'Brochure (Optional) — PDF (Max 10MB)'}</span>
        {state.media.brochureUrl ? (
          <a href={state.media.brochureUrl} target="_blank" rel="noreferrer" className="pw-media-file-link">
            View brochure
          </a>
        ) : null}
        <input
          type="file"
          accept="application/pdf"
          className="pw-dropzone-input"
          disabled={busyKey === 'brochure'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onBrochurePdf(file);
          }}
        />
      </label>
    </div>
  );
}
