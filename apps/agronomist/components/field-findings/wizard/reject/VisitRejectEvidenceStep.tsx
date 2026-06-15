import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  VISIT_AI_EVIDENCE_PHOTO_LABELS,
  VISIT_AI_EVIDENCE_PHOTO_TYPES,
  tokens,
  type VisitAiEvidenceRequest,
} from '@morbeez/shared';

type Props = {
  evidenceRequest: VisitAiEvidenceRequest;
  onChange: (next: VisitAiEvidenceRequest) => void;
};

const YES_NO = ['yes', 'no'] as const;

export function VisitRejectEvidenceStep({ evidenceRequest, onChange }: Props) {
  function togglePhoto(photoType: string) {
    const set = new Set(evidenceRequest.photoTypes);
    if (set.has(photoType)) set.delete(photoType);
    else set.add(photoType);
    onChange({ ...evidenceRequest, photoTypes: [...set] });
  }

  function setAnswer(key: string, answer: string) {
    onChange({
      ...evidenceRequest,
      questions: evidenceRequest.questions.map((q) => (q.key === key ? { ...q, answer } : q)),
    });
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Request photos from farmer</Text>
      <View style={styles.chips}>
        {VISIT_AI_EVIDENCE_PHOTO_TYPES.map((photoType) => {
          const active = evidenceRequest.photoTypes.includes(photoType);
          return (
            <Pressable
              key={photoType}
              onPress={() => togglePhoto(photoType)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {VISIT_AI_EVIDENCE_PHOTO_LABELS[photoType]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.title}>Evidence questions</Text>
      {evidenceRequest.questions.map((q) => (
        <View key={q.key} style={styles.question}>
          <Text style={styles.questionText}>{q.text}</Text>
          <View style={styles.chips}>
            {YES_NO.map((v) => (
              <Pressable
                key={v}
                onPress={() => setAnswer(q.key, v)}
                style={[styles.chip, q.answer === v && styles.chipActive]}
              >
                <Text style={[styles.chipText, q.answer === v && styles.chipTextActive]}>
                  {v === 'yes' ? 'Yes' : 'No'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.hint}>WhatsApp will be sent to the farmer. No recommendation until evidence is received.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 8 },
  title: { fontSize: 13, fontWeight: '600', color: tokens.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  chipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  chipText: { fontSize: 13, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '600' },
  question: { gap: 6 },
  questionText: { fontSize: 13, color: tokens.text },
  hint: { fontSize: 12, color: tokens.textMuted },
});
