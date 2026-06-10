import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { STAFF_API_V1, staffApi, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

const FIELD = `${STAFF_API_V1}/os/field`;

type Question = {
  id: string;
  questionKey: string;
  labelEn: string;
  inputType: string;
  options: string[];
  required: boolean;
};

type PhotoPreview = { uri: string; filename: string; mimeType: string; dataBase64: string };

const TONES = ['healthy', 'warning', 'danger'] as const;

export default function VisitScreen() {
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const params = useLocalSearchParams<{
    farmerId: string;
    blockId: string;
    blockName: string;
    cropType: string;
    farmerName: string;
  }>();

  const farmerId = String(params.farmerId ?? '');
  const blockId = String(params.blockId ?? '');
  const blockName = String(params.blockName ?? '');
  const cropType = String(params.cropType ?? '');
  const farmerName = String(params.farmerName ?? '');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [observations, setObservations] = useState('');
  const [diseasePest, setDiseasePest] = useState('');
  const [diseaseTone, setDiseaseTone] = useState<(typeof TONES)[number]>('warning');
  const [actionTaken, setActionTaken] = useState('');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLon, setGpsLon] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cropType) {
      setLoading(false);
      setError('Missing crop type for this block.');
      return;
    }
    staffApi<{ ok: boolean; questions: Question[] }>(
      `${FIELD}/questionnaire/${encodeURIComponent(cropType)}`
    )
      .then((d) => setQuestions(d.questions ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load form'))
      .finally(() => setLoading(false));
  }, [cropType]);

  function setAnswer(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function addPhotos() {
    if (photos.length >= 8) return;
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsMultipleSelection: true,
      selectionLimit: 8 - photos.length,
    });
    if (pick.canceled) return;
    const next = pick.assets
      .filter((a: ImagePicker.ImagePickerAsset) => a.base64)
      .map((a: ImagePicker.ImagePickerAsset) => ({
        uri: a.uri,
        filename: a.fileName ?? 'photo.jpg',
        mimeType: a.mimeType ?? 'image/jpeg',
        dataBase64: a.base64!,
      }));
    setPhotos((p) => [...p, ...next].slice(0, 8));
  }

  async function captureGps() {
    setGpsLoading(true);
    setGpsStatus('Getting location…');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('Location permission denied.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsLat(pos.coords.latitude);
      setGpsLon(pos.coords.longitude);
      setGpsStatus(
        `Captured ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
      );
      if (blockId && farmerId) {
        await staffApi(`${FIELD}/blocks/${blockId}/location`, {
          method: 'POST',
          body: JSON.stringify({
            farmerId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        });
      }
    } catch (e) {
      setGpsStatus(e instanceof Error ? e.message : 'Could not get GPS');
    } finally {
      setGpsLoading(false);
    }
  }

  async function submit() {
    if (!canWrite || !farmerId || !blockId) return;
    for (const q of questions) {
      if (q.required && !answers[q.questionKey]?.trim()) {
        setError(`Required: ${q.labelEn}`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const answerRows = questions.map((q) => ({
        questionKey: q.questionKey,
        label: q.labelEn,
        value: answers[q.questionKey] ?? '',
      }));
      const photoPayload = photos.map((p) => ({
        filename: p.filename,
        mimeType: p.mimeType,
        dataBase64: p.dataBase64,
      }));

      await staffApi(`${FIELD}/visits`, {
        method: 'POST',
        body: JSON.stringify({
          farmerId,
          blockId,
          blockName,
          cropType,
          observations: observations.trim() || undefined,
          diseasePest: diseasePest.trim() || undefined,
          diseaseTone,
          actionTaken: actionTaken.trim() || undefined,
          answers: answerRows,
          photos: photoPayload.length ? photoPayload : undefined,
          latitude: gpsLat ?? undefined,
          longitude: gpsLon ?? undefined,
        }),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading questionnaire…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{blockName || 'Block'}</Text>
      <Text style={styles.subheading}>
        {[farmerName, cropType].filter(Boolean).join(' · ')}
      </Text>

      {error ? <AlertBox>{error}</AlertBox> : null}

      {questions.length > 0 ? (
        <Panel title="Visit checklist">
          {questions.map((q) => (
            <View key={q.id} style={styles.question}>
              <Text style={styles.qLabel}>
                {q.labelEn}
                {q.required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              {q.inputType === 'select' && q.options.length > 0 ? (
                <View style={styles.optionRow}>
                  {q.options.map((o) => (
                    <Pressable
                      key={o}
                      onPress={() => setAnswer(q.questionKey, o)}
                      style={[
                        styles.optionChip,
                        answers[q.questionKey] === o && styles.optionChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          answers[q.questionKey] === o && styles.optionChipTextActive,
                        ]}
                      >
                        {o}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : q.inputType === 'boolean' ? (
                <View style={styles.optionRow}>
                  {['Yes', 'No'].map((o) => (
                    <Pressable
                      key={o}
                      onPress={() => setAnswer(q.questionKey, o)}
                      style={[
                        styles.optionChip,
                        answers[q.questionKey] === o && styles.optionChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          answers[q.questionKey] === o && styles.optionChipTextActive,
                        ]}
                      >
                        {o}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={answers[q.questionKey] ?? ''}
                  onChangeText={(v) => setAnswer(q.questionKey, v)}
                  keyboardType={q.inputType === 'number' ? 'numeric' : 'default'}
                  placeholderTextColor={tokens.textMuted}
                />
              )}
            </View>
          ))}
        </Panel>
      ) : null}

      <Panel title="Plot GPS">
        <Text style={styles.hint}>Stand at the plot and capture GPS for accurate weather advice.</Text>
        {gpsStatus ? <Text style={styles.gpsStatus}>{gpsStatus}</Text> : null}
        <Btn
          label={gpsLoading ? 'Getting location…' : gpsLat != null ? 'Update GPS' : 'Capture plot GPS'}
          onPress={captureGps}
          disabled={!canWrite || gpsLoading}
          variant="secondary"
        />
      </Panel>

      <Panel title="Observations">
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What you see in the field…"
          placeholderTextColor={tokens.textMuted}
          value={observations}
          onChangeText={setObservations}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Disease / pest (if any)"
          placeholderTextColor={tokens.textMuted}
          value={diseasePest}
          onChangeText={setDiseasePest}
        />
        <Text style={styles.qLabel}>Severity</Text>
        <View style={styles.optionRow}>
          {TONES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setDiseaseTone(t)}
              style={[styles.optionChip, diseaseTone === t && styles.optionChipActive]}
            >
              <Text
                style={[
                  styles.optionChipText,
                  diseaseTone === t && styles.optionChipTextActive,
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Action taken on visit (optional)"
          placeholderTextColor={tokens.textMuted}
          value={actionTaken}
          onChangeText={setActionTaken}
        />
      </Panel>

      <Panel title="Photos">
        <Text style={styles.hint}>Up to 8 images</Text>
        <View style={styles.photoRow}>
          {photos.map((p, i) => (
            <View key={`${p.uri}-${i}`} style={styles.photoWrap}>
              <Image source={{ uri: p.uri }} style={styles.photo} />
              <Pressable style={styles.photoRemove} onPress={() => setPhotos((x) => x.filter((_, j) => j !== i))}>
                <Text style={styles.photoRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
          {photos.length < 8 ? (
            <Pressable style={styles.photoAdd} onPress={addPhotos}>
              <Text style={styles.photoAddText}>+</Text>
            </Pressable>
          ) : null}
        </View>
      </Panel>

      <Btn
        label={saving ? 'Uploading…' : 'Submit field visit'}
        onPress={submit}
        disabled={saving || !canWrite || loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 20, fontWeight: '700', color: tokens.text },
  subheading: { fontSize: 14, color: tokens.textMuted, marginBottom: 12 },
  question: { marginBottom: 14 },
  qLabel: { fontSize: 13, color: tokens.text, marginBottom: 6 },
  required: { color: tokens.danger },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.text,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  optionChipActive: {
    backgroundColor: tokens.green100,
    borderColor: tokens.green500,
  },
  optionChipText: { fontSize: 13, color: tokens.textMuted },
  optionChipTextActive: { color: tokens.green800, fontWeight: '600' },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  gpsStatus: { fontSize: 13, color: tokens.green700, marginBottom: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 72, height: 72, borderRadius: 8 },
  photoRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
  },
  photoRemoveText: { color: '#fff', fontSize: 14 },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.green500,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.green100,
  },
  photoAddText: { fontSize: 28, color: tokens.green700 },
});
