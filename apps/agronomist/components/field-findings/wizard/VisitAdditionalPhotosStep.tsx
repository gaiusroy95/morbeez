import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { tokens, type VisitPhotoInput } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

type IssuePhoto = VisitPhotoInput & { uri?: string };

type Props = {
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
};

async function capturePhoto(photoType: string): Promise<IssuePhoto[]> {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled) return [];
  const a = result.assets[0];
  if (!a?.base64) return [];
  return [
    {
      filename: a.fileName ?? `extra-${Date.now()}.jpg`,
      mimeType: a.mimeType ?? 'image/jpeg',
      dataBase64: a.base64,
      photoType,
      uri: a.uri,
    },
  ];
}

export function VisitAdditionalPhotosStep({ issues, onChange }: Props) {
  const [capturing, setCapturing] = useState<string | null>(null);
  const requests = issues.flatMap((issue) =>
    (issue.photoRequests ?? []).map((req) => ({ issue, req }))
  );

  if (!requests.length) {
    return <Text style={styles.hint}>No additional photos requested.</Text>;
  }

  async function attach(issueLocalId: string, photoType: string) {
    setCapturing(`${issueLocalId}-${photoType}`);
    try {
      const shots = await capturePhoto(photoType);
      if (!shots.length) return;
      onChange(
        issues.map((issue) =>
          issue.localId === issueLocalId
            ? { ...issue, photos: [...(issue.photos ?? []), ...shots] }
            : issue
        )
      );
    } finally {
      setCapturing(null);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>Capture photos requested during follow-up Q&A.</Text>
      {requests.map(({ issue, req }) => {
        const attached = (issue.photos ?? []).filter((p) => p.photoType === req.photoType).length;
        const key = `${issue.localId}-${req.photoType}`;
        return (
          <View key={key} style={styles.card}>
            <Text style={styles.title}>{req.label}</Text>
            <Text style={styles.sub}>{req.reason ?? issue.issueName}</Text>
            {attached > 0 ? (
              <Text style={styles.ok}>{attached} photo(s) attached</Text>
            ) : null}
            <Btn
              label={capturing === key ? 'Opening camera…' : 'Capture photo'}
              onPress={() => void attach(issue.localId, req.photoType)}
              disabled={capturing === key}
            />
            {(issue.photos ?? [])
              .filter((p) => p.photoType === req.photoType && p.uri)
              .map((p, i) => (
                <Image key={`${key}-img-${i}`} source={{ uri: p.uri! }} style={styles.thumb} />
              ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: { fontSize: 13, color: tokens.textMuted },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 12, color: tokens.textMuted },
  ok: { fontSize: 12, color: tokens.green800, fontWeight: '600' },
  thumb: { width: 72, height: 72, borderRadius: tokens.radiusSm },
});
