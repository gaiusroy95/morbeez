import { useRef } from 'react';
import { agronomistClient, type VisitPhotoValidationIssue } from '@morbeez/shared';
import { readFileAsBase64 } from '../../../lib/readFileAsBase64';
import { Panel } from '../../ui';
import type { VisitPhotoDraft } from './types';
import {
  formatCropPhotoGuidance,
  getDefaultSelectedPhotoTypes,
  getVisitPhotoTypeLabel,
  getVisitPhotoTypesForCrop,
} from './visitPhotoTypes';

type Props = {
  cropType: string;
  photos: VisitPhotoDraft[];
  selectedTypes: string[];
  voiceNote?: string;
  onPhotosChange: (photos: VisitPhotoDraft[]) => void;
  onTypesChange: (types: string[]) => void;
  onVoiceNoteChange?: (text: string) => void;
  validatePhoto?: (dataBase64: string, mimeType?: string) => Promise<{
    ok: boolean;
    issues: VisitPhotoValidationIssue[];
    retakeRecommended: boolean;
  }>;
};

const ISSUE_LABELS: Record<VisitPhotoValidationIssue, string> = {
  blur: 'Blurry',
  dark: 'Too dark',
  low_resolution: 'Low resolution',
};

function toRawBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export { getDefaultSelectedPhotoTypes };

export function VisitPhotosStep({
  cropType,
  photos,
  selectedTypes,
  voiceNote,
  onPhotosChange,
  onTypesChange,
  onVoiceNoteChange,
  validatePhoto = agronomistClient.validateVisitPhoto,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photoTypes = getVisitPhotoTypesForCrop(cropType);
  const cropLabel = cropType.replace(/_/g, ' ').trim() || 'crop';

  function toggleType(type: string) {
    onTypesChange(
      selectedTypes.includes(type) ? selectedTypes.filter((t) => t !== type) : [...selectedTypes, type]
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const photoType = selectedTypes[0] ?? photoTypes[0]?.value ?? 'other';
    const remaining = Math.max(1, 12 - photos.length);
    const toAdd: VisitPhotoDraft[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i]!;
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readFileAsBase64(file);
      const dataBase64 = toRawBase64(dataUrl);
      const draft: VisitPhotoDraft = {
        filename: file.name || `photo-${Date.now()}-${i}.jpg`,
        mimeType: file.type || 'image/jpeg',
        dataBase64,
        photoType,
        previewUrl: dataUrl,
      };
      try {
        const result = await validatePhoto(dataBase64, draft.mimeType);
        toAdd.push({
          ...draft,
          validationIssues: result.issues,
          retakeRecommended: result.retakeRecommended,
        });
      } catch {
        toAdd.push(draft);
      }
    }

    if (toAdd.length) {
      onPhotosChange([...photos, ...toAdd].slice(0, 12));
    }
  }

  return (
    <div className="vw-stack">
      <div className="vw-upload-row">
        <button type="button" className="vw-upload-card" onClick={() => inputRef.current?.click()}>
          <span aria-hidden>📷</span>
          Add photos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="vw-file-input"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <Panel title={`Photo types · ${cropLabel}`}>
        <p className="vw-hint">{formatCropPhotoGuidance(cropType)}</p>
        <div className="vw-chip-row">
          {photoTypes.map((t) => {
            const active = selectedTypes.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                className={[
                  'vw-chip',
                  active ? 'vw-chip--active' : '',
                  t.recommended && !active ? 'vw-chip--recommended' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => toggleType(t.value)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title={`Photos added (${photos.length})`}>
        {photos.length ? (
          <div className="vw-photo-gallery">
            {photos.map((p, i) => (
              <div key={`${p.filename}-${i}`} className="vw-photo-thumb">
                <img
                  src={p.previewUrl ?? `data:${p.mimeType};base64,${p.dataBase64}`}
                  alt={p.filename}
                />
                <button
                  type="button"
                  className="vw-photo-remove"
                  aria-label="Remove photo"
                  onClick={() => onPhotosChange(photos.filter((_, j) => j !== i))}
                >
                  ×
                </button>
                <div className="vw-photo-meta">{getVisitPhotoTypeLabel(cropType, p.photoType ?? 'other')}</div>
                {p.retakeRecommended && p.validationIssues?.length ? (
                  <div className="vw-photo-retake">
                    Retake: {p.validationIssues.map((issue) => ISSUE_LABELS[issue]).join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="vw-hint" style={{ textAlign: 'center', padding: '12px 0' }}>
            No photos yet. Use the button above to add images.
          </p>
        )}
        {onVoiceNoteChange ? (
          <>
            <p className="vw-hint" style={{ marginTop: 12 }}>
              Field voice note (optional transcript)
            </p>
            <textarea
              className="vw-textarea"
              placeholder="Speak observations; paste transcript here until STT is enabled"
              value={voiceNote ?? ''}
              onChange={(e) => onVoiceNoteChange(e.target.value)}
            />
          </>
        ) : null}
      </Panel>
    </div>
  );
}
