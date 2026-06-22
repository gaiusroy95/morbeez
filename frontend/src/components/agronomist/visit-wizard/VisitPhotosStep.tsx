import { useRef, useState, useMemo } from 'react';
import {
  agronomistClient,
  resolveCapturePhotoType,
  suggestNextCapturePhotoType,
  type VisitPhotoValidationIssue,
} from '@morbeez/shared';
import { readFileAsBase64 } from '../../../lib/readFileAsBase64';
import { Panel } from '../../ui';
import type { VisitPhotoDraft } from './types';
import {
  formatCropPhotoGuidance,
  getDefaultSelectedPhotoTypes,
  getDetailPhotoTypes,
  getMandatoryPhotoTypes,
  getVisitPhotoTypeLabel,
  getVisitPhotoTypesForCrop,
} from './visitPhotoTypes';

type Props = {
  cropType: string;
  photos: VisitPhotoDraft[];
  captureType: string;
  onCaptureTypeChange: (type: string) => void;
  voiceNote?: string;
  onPhotosChange: (photos: VisitPhotoDraft[]) => void;
  onVoiceNoteChange?: (text: string) => void;
  validatePhoto?: (dataBase64: string, mimeType?: string) => Promise<{
    ok: boolean;
    issues: VisitPhotoValidationIssue[];
    retakeRecommended: boolean;
  }>;
  classifyPhoto?: typeof agronomistClient.classifyVisitPhoto;
};

const ISSUE_LABELS: Record<VisitPhotoValidationIssue, string> = {
  blur: 'Blurry',
  dark: 'Too dark',
  low_resolution: 'Low resolution',
  coverage: 'Poor coverage',
};

function toRawBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export { getDefaultSelectedPhotoTypes };

export function VisitPhotosStep({
  cropType,
  photos,
  captureType,
  onCaptureTypeChange,
  voiceNote,
  onPhotosChange,
  onVoiceNoteChange,
  validatePhoto = agronomistClient.validateVisitPhoto,
  classifyPhoto = agronomistClient.classifyVisitPhoto,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [captureLocked, setCaptureLocked] = useState(false);
  const photoTypes = getVisitPhotoTypesForCrop(cropType);
  const mandatoryTypes = getMandatoryPhotoTypes(cropType);
  const detailTypes = getDetailPhotoTypes(cropType);
  const availableTypeValues = photoTypes.map((t) => t.value);
  const cropLabel = cropType.replace(/_/g, ' ').trim() || 'crop';

  const qualitySummary = useMemo(() => {
    const capturedMandatory = new Set(
      photos.map((p) => p.photoType).filter((t) => mandatoryTypes.some((m) => m.value === t))
    );
    const retake = photos.filter((p) => p.retakeRecommended || (p.validationIssues?.length ?? 0) > 0).length;
    return {
      mandatoryDone: capturedMandatory.size,
      mandatoryTotal: mandatoryTypes.length,
      retake,
      total: photos.length,
    };
  }, [photos, mandatoryTypes]);

  function renderPhotoChips(types: typeof photoTypes) {
    return types.map((t) => {
      const active = captureType === t.value;
      const captured = photos.some((p) => p.photoType === t.value);
      return (
        <button
          key={t.value}
          type="button"
          className={[
            'vw-chip',
            active ? 'vw-chip--active' : '',
            t.recommended && !active ? 'vw-chip--recommended' : '',
            captured ? 'vw-chip--captured' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setActiveCaptureType(t.value)}
        >
          {t.label}
          {captured ? ' ✓' : ''}
        </button>
      );
    });
  }

  function setActiveCaptureType(type: string) {
    setCaptureLocked(true);
    onCaptureTypeChange(type);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const tagType =
      captureType ||
      resolveCapturePhotoType({
        captureType,
        selectedTypes: [captureType],
        availableTypes: availableTypeValues,
        existingPhotoTypes: photos.map((p) => p.photoType),
      });
    const remaining = Math.max(1, 12 - photos.length);
    const toAdd: VisitPhotoDraft[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i]!;
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readFileAsBase64(file);
      const dataBase64 = toRawBase64(dataUrl);
      let photoType = tagType;
      let aiTagged = false;
      try {
        const classified = await classifyPhoto({
          dataBase64,
          mimeType: file.type,
          cropType,
          availableTypes: availableTypeValues,
        });
        if (classified && classified.confidence >= 0.68 && !captureLocked) {
          photoType = classified.photoType;
          aiTagged = true;
        } else if (classified && classified.confidence >= 0.68 && captureLocked) {
          photoType = captureType || classified.photoType;
          aiTagged = photoType === classified.photoType;
        }
      } catch {
        // keep manual tag
      }
      const draft: VisitPhotoDraft = {
        filename: file.name || `photo-${Date.now()}-${i}.jpg`,
        mimeType: file.type || 'image/jpeg',
        dataBase64,
        photoType,
        previewUrl: dataUrl,
        aiTagged,
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
      const merged = [...photos, ...toAdd].slice(0, 12);
      onPhotosChange(merged);
      setCaptureLocked(false);
      onCaptureTypeChange(suggestNextCapturePhotoType(merged.map((p) => p.photoType), availableTypeValues));
    }
  }

  return (
    <div className="vw-stack">
      <div className="vw-photo-quality-strip">
        <span>
          Evidence: {qualitySummary.mandatoryDone}/{qualitySummary.mandatoryTotal} core shots
        </span>
        <span>{qualitySummary.total} photos</span>
        {qualitySummary.retake ? (
          <span className="vw-photo-quality-warn">{qualitySummary.retake} need retake</span>
        ) : (
          <span className="vw-photo-quality-ok">Quality OK</span>
        )}
      </div>
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

      <Panel title={`Photo evidence · ${cropLabel}`}>
        <p className="vw-hint">{formatCropPhotoGuidance(cropType)}</p>
        <p className="vw-hint">AI checks blur, lighting, and coverage after upload. Tag the next capture below.</p>
        <p className="vw-field-label">Core evidence (required)</p>
        <div className="vw-chip-row">{renderPhotoChips(mandatoryTypes)}</div>
        {detailTypes.length ? (
          <>
            <p className="vw-field-label" style={{ marginTop: 12 }}>
              Detail shots (crop-specific)
            </p>
            <div className="vw-chip-row">{renderPhotoChips(detailTypes)}</div>
          </>
        ) : null}
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
                <div className="vw-photo-meta">
                  {getVisitPhotoTypeLabel(cropType, p.photoType ?? 'other')}
                  {p.aiTagged ? ' · AI' : ''}
                </div>
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
