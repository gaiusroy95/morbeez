import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  tokens,
  isFieldLevelPhotoType,
  isSymptomPhotoType,
  photoRequirementHint,
  resolveCapturePhotoType,
  suggestNextCapturePhotoType,
  type VisitPhotoValidationIssue,
} from '@morbeez/shared';
import { agronomistClient } from '@morbeez/shared';
import { DynamicSelect, Panel } from '@morbeez/ui-native';
import type { VisitPhotoDraft } from './types';
import {
  formatCropPhotoGuidance,
  getVisitPhotoTypeLabel,
  getVisitPhotoTypesForCrop,
  type VisitPhotoTypeOption,
} from './visitPhotoTypes';

function slugLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^\w]/g, '') || 'other';
}

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
  strictPhotoQc?: boolean;
};

const ISSUE_LABELS: Record<VisitPhotoValidationIssue, string> = {
  blur: 'Blurry',
  dark: 'Too dark',
  low_resolution: 'Low resolution',
  coverage: 'Poor coverage',
};

async function pickImages(
  source: 'camera' | 'library',
  captureType: string,
  existingPhotos: VisitPhotoDraft[]
): Promise<VisitPhotoDraft[]> {
  const remaining = Math.max(1, 12 - existingPhotos.length);
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
    allowsMultipleSelection: source === 'library',
    selectionLimit: remaining,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({ ...options, selectionLimit: 12 });

  if (result.canceled) return [];

  return result.assets
    .filter((a) => a.base64)
    .map((a, i) => ({
      uri: a.uri,
      filename: a.fileName ?? `photo-${Date.now()}-${i}.jpg`,
      mimeType: a.mimeType ?? 'image/jpeg',
      dataBase64: a.base64!,
      photoType: captureType,
    }));
}

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
  strictPhotoQc = false,
}: Props) {
  const [customPhotoTypes, setCustomPhotoTypes] = useState<VisitPhotoTypeOption[]>([]);
  const [captureLocked, setCaptureLocked] = useState(false);
  const basePhotoTypes = getVisitPhotoTypesForCrop(cropType);
  const photoTypes = useMemo(() => {
    const seen = new Set(basePhotoTypes.map((t) => t.value));
    const merged = [...basePhotoTypes];
    for (const t of customPhotoTypes) {
      if (!seen.has(t.value)) {
        merged.push(t);
        seen.add(t.value);
      }
    }
    return merged;
  }, [basePhotoTypes, customPhotoTypes]);

  const availableTypeValues = photoTypes.map((t) => t.value);
  const nextCaptureType = resolveCapturePhotoType({
    captureType,
    selectedTypes: [captureType],
    availableTypes: availableTypeValues,
    existingPhotoTypes: photos.map((p) => p.photoType),
  });
  const requirementCopy = photoRequirementHint(availableTypeValues);
  const cropLabel = cropType.replace(/_/g, ' ').trim() || 'crop';

  function updatePhotoType(index: number, photoType: string) {
    onPhotosChange(photos.map((p, i) => (i === index ? { ...p, photoType, aiTagged: false } : p)));
  }

  function setActiveCaptureType(type: string) {
    setCaptureLocked(true);
    onCaptureTypeChange(type);
  }

  async function addPhotoType(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const value = slugLabel(trimmed);
    const entry = { value, label: trimmed };
    setCustomPhotoTypes((prev) => (prev.some((t) => t.value === value) ? prev : [...prev, entry]));
    setActiveCaptureType(value);
  }

  async function addFrom(source: 'camera' | 'library') {
    const picked = await pickImages(source, captureType || nextCaptureType, photos);
    if (!picked.length) return;

    const validated: VisitPhotoDraft[] = [];
    for (const photo of picked) {
      let photoType = photo.photoType;
      let aiTagged = false;
      try {
        const classified = await classifyPhoto({
          dataBase64: photo.dataBase64,
          mimeType: photo.mimeType,
          cropType,
          availableTypes: availableTypeValues,
        });
        if (classified && classified.confidence >= 0.68 && (!captureLocked || !captureType)) {
          photoType = classified.photoType;
          aiTagged = true;
        } else if (classified && classified.confidence >= 0.68 && captureLocked) {
          photoType = captureType || classified.photoType;
          aiTagged = photoType === classified.photoType;
        } else if (!captureLocked && classified) {
          photoType = classified.photoType;
          aiTagged = classified.confidence >= 0.55;
        }
      } catch {
        // Keep manual / default tag
      }

      try {
        const result = await validatePhoto(photo.dataBase64, photo.mimeType);
        validated.push({
          ...photo,
          photoType,
          aiTagged,
          validationIssues: result.issues,
          retakeRecommended: result.retakeRecommended,
        });
      } catch {
        validated.push({ ...photo, photoType, aiTagged });
      }
    }

    const merged = [...photos, ...validated].slice(0, 12);
    onPhotosChange(merged);
    setCaptureLocked(false);
    onCaptureTypeChange(
      suggestNextCapturePhotoType(
        merged.map((p) => p.photoType),
        availableTypeValues
      )
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.captureRow}>
        <Pressable style={styles.captureCard} onPress={() => void addFrom('camera')}>
          <Ionicons name="camera-outline" size={36} color={tokens.green700} />
          <Text style={styles.captureLabel}>Camera</Text>
        </Pressable>
        <Pressable style={styles.captureCard} onPress={() => void addFrom('library')}>
          <Ionicons name="images-outline" size={36} color={tokens.green700} />
          <Text style={styles.captureLabel}>Gallery</Text>
        </Pressable>
      </View>

      <Panel title={`Photo types · ${cropLabel}`}>
        <Text style={styles.hint}>{formatCropPhotoGuidance(cropType)}</Text>
        <Text style={styles.requirement}>{requirementCopy}</Text>
        <Text style={styles.captureActive}>
          Next capture tags as: {getVisitPhotoTypeLabel(cropType, captureType || nextCaptureType)}
        </Text>
        <Text style={styles.aiHint}>AI auto-tags each photo after capture; tap a type below to override.</Text>
        <View style={styles.typeRow}>
          {photoTypes.map((t) => {
            const isCaptureType = captureType === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setActiveCaptureType(t.value)}
                style={[
                  styles.typeChip,
                  isCaptureType && styles.typeChipCapture,
                  t.recommended && !isCaptureType ? styles.typeChipRecommended : null,
                ]}
              >
                <Text style={[styles.typeChipText, isCaptureType && styles.typeChipTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <DynamicSelect
          label="Photo type for capture"
          placeholder="Select type for next photo"
          value={captureType}
          options={photoTypes.map((t) => ({ key: t.value, value: t.value, label: t.label }))}
          allowAdd
          addPlaceholder="New photo type label"
          addButtonLabel="Add type"
          onChange={(value) => setActiveCaptureType(value)}
          onAdd={addPhotoType}
        />
      </Panel>

      <Panel title={`Photos added (${photos.length})`}>
        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {photos.map((p, i) => (
              <View key={`${p.uri}-${i}`} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => onPhotosChange(photos.filter((_, j) => j !== i))}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
                <DynamicSelect
                  label=""
                  placeholder="Retag"
                  value={p.photoType}
                  options={photoTypes.map((t) => ({ key: t.value, value: t.value, label: t.label }))}
                  onChange={(value) => updatePhotoType(i, value)}
                />
                <Text style={styles.thumbMeta} numberOfLines={1}>
                  {getVisitPhotoTypeLabel(cropType, p.photoType)}
                  {p.aiTagged ? ' · AI' : ''}
                  {isFieldLevelPhotoType(p.photoType) ? ' · field' : isSymptomPhotoType(p.photoType) ? ' · symptom' : ''}
                </Text>
                {p.retakeRecommended && p.validationIssues?.length ? (
                  <Text style={styles.retakeBanner}>
                    Retake: {p.validationIssues.map((issue) => ISSUE_LABELS[issue]).join(', ')}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>No photos yet. Use camera or gallery above.</Text>
        )}
        {onVoiceNoteChange ? (
          <>
            <Text style={[styles.hint, { marginTop: 12 }]}>Field voice note (optional transcript)</Text>
            <TextInput
              style={styles.voiceInput}
              multiline
              placeholder="Speak observations; paste transcript here until STT is enabled"
              value={voiceNote ?? ''}
              onChangeText={onVoiceNoteChange}
            />
          </>
        ) : null}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  captureRow: { flexDirection: 'row', gap: 12 },
  captureCard: {
    flex: 1,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  captureLabel: { fontSize: 15, fontWeight: '600', color: tokens.green800 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10, lineHeight: 18 },
  requirement: { fontSize: 12, color: tokens.green800, marginBottom: 6, lineHeight: 16 },
  captureActive: { fontSize: 12, fontWeight: '600', color: tokens.text, marginBottom: 4 },
  aiHint: { fontSize: 11, color: tokens.textMuted, marginBottom: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bg,
  },
  typeChipRecommended: { borderColor: tokens.green500, borderStyle: 'dashed' },
  typeChipCapture: { borderWidth: 2, borderColor: tokens.green700, backgroundColor: tokens.green100 },
  typeChipText: { fontSize: 12, color: tokens.textMuted },
  typeChipTextActive: { color: tokens.green800, fontWeight: '600' },
  gallery: { gap: 10, paddingVertical: 4 },
  thumbWrap: { width: 120, alignItems: 'center' },
  thumb: { width: 112, height: 80, borderRadius: 8 },
  removeBtn: {
    position: 'absolute',
    top: 0,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  thumbMeta: { fontSize: 10, color: tokens.textMuted, marginTop: 4, maxWidth: 80 },
  retakeBanner: { fontSize: 9, color: tokens.danger, marginTop: 2, maxWidth: 80, fontWeight: '600' },
  empty: { fontSize: 13, color: tokens.textMuted, textAlign: 'center', paddingVertical: 12 },
  voiceInput: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    minHeight: 72,
    fontSize: 14,
    color: tokens.text,
    backgroundColor: tokens.bg,
    textAlignVertical: 'top',
  },
});
