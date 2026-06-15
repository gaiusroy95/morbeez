import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@morbeez/shared';
import { Panel } from '@morbeez/ui-native';
import type { VisitPhotoDraft } from './types';
import {
  formatCropPhotoGuidance,
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
};

async function pickImages(
  source: 'camera' | 'library',
  selectedTypes: string[],
  availableTypes: string[],
  existingCount: number
): Promise<VisitPhotoDraft[]> {
  const photoType = selectedTypes[0] ?? availableTypes[0] ?? 'other';
  const remaining = Math.max(1, 12 - existingCount);
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
      photoType,
    }));
}

export function VisitPhotosStep({
  cropType,
  photos,
  selectedTypes,
  voiceNote,
  onPhotosChange,
  onTypesChange,
  onVoiceNoteChange,
}: Props) {
  const photoTypes = getVisitPhotoTypesForCrop(cropType);
  const cropLabel = cropType.replace(/_/g, ' ').trim() || 'crop';

  function toggleType(type: string) {
    onTypesChange(
      selectedTypes.includes(type) ? selectedTypes.filter((t) => t !== type) : [...selectedTypes, type]
    );
  }

  async function addFrom(source: 'camera' | 'library') {
    const next = await pickImages(
      source,
      selectedTypes,
      photoTypes.map((t) => t.value),
      photos.length
    );
    if (next.length) onPhotosChange([...photos, ...next].slice(0, 12));
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
        <View style={styles.typeRow}>
          {photoTypes.map((t) => {
            const active = selectedTypes.includes(t.value);
            return (
              <Pressable
                key={t.value}
                onPress={() => toggleType(t.value)}
                style={[
                  styles.typeChip,
                  active && styles.typeChipActive,
                  t.recommended && !active ? styles.typeChipRecommended : null,
                ]}
              >
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
                <Text style={styles.thumbMeta} numberOfLines={1}>
                  {getVisitPhotoTypeLabel(cropType, p.photoType)}
                </Text>
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
  typeChipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500, borderStyle: 'solid' },
  typeChipText: { fontSize: 12, color: tokens.textMuted },
  typeChipTextActive: { color: tokens.green800, fontWeight: '600' },
  gallery: { gap: 10, paddingVertical: 4 },
  thumbWrap: { width: 88, alignItems: 'center' },
  thumb: { width: 80, height: 80, borderRadius: 8 },
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
