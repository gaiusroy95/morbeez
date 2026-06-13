import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, Panel, TextField, MULTILINE_MIN_HEIGHT } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function AddRecommendationScreen() {
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const params = useLocalSearchParams<{
    farmerId: string;
    leadId?: string;
    blockId?: string;
    findingId?: string;
    recommendationId?: string;
    linkedIssueName?: string;
    visitIssueId?: string;
  }>();

  const farmerId = String(params.farmerId ?? '');
  const leadId = params.leadId ? String(params.leadId) : undefined;
  const blockId = params.blockId ? String(params.blockId) : undefined;
  const findingId = params.findingId ? String(params.findingId) : undefined;

  const [issueDetected, setIssueDetected] = useState(params.linkedIssueName ? String(params.linkedIssueName) : '');
  const [recommendationText, setRecommendationText] = useState('');
  const [dosage, setDosage] = useState('');
  const [weatherWarning, setWeatherWarning] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(params.recommendationId ? String(params.recommendationId) : '');

  async function saveDraft(): Promise<string | null> {
    if (!canWrite || !farmerId) return null;
    if (!recommendationText.trim()) {
      setError('Recommendation text is required');
      return null;
    }
    setSaving(true);
    setError('');
    try {
      if (findingId) {
        const d = (await agronomistClient.saveDraft({
          findingId,
          farmerId,
          blockId,
          leadId,
          recommendationId: savedId || undefined,
          issueDetected: issueDetected.trim() || undefined,
          recommendationText: recommendationText.trim(),
          dosage: dosage.trim() || undefined,
          weatherWarning: weatherWarning.trim() || undefined,
        })) as { ok: boolean; recommendation: { id: string } };
        setSavedId(d.recommendation.id);
        return d.recommendation.id;
      }
      const d = await agronomistClient.createFarmerRecommendation(farmerId, {
        blockId,
        leadId,
        issueDetected: issueDetected.trim() || undefined,
        recommendationText: recommendationText.trim(),
        dosage: dosage.trim() || undefined,
        weatherWarning: weatherWarning.trim() || undefined,
      });
      setSavedId(String(d.recommendation.id));
      return String(d.recommendation.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save recommendation');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval() {
    const id = savedId || (await saveDraft());
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await agronomistClient.submitRecommendation(id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAwareScrollScreen contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Add recommendation">
        <Text style={styles.hint}>Describe the issue and what the farmer should do next.</Text>
        <TextField
          label="Issue / problem"
          value={issueDetected}
          onChangeText={setIssueDetected}
          placeholder="e.g. Early blight on lower leaves"
        />
        <Text style={styles.fieldLabel}>Recommendation *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={recommendationText}
          onChangeText={setRecommendationText}
          multiline
          placeholder="Treatment, cultural practice, or follow-up steps…"
          placeholderTextColor={tokens.textMuted}
        />
        <TextField label="Dosage" value={dosage} onChangeText={setDosage} placeholder="Product, rate, method" />
        <TextField
          label="Weather warning"
          value={weatherWarning}
          onChangeText={setWeatherWarning}
          placeholder="Optional spray window or rain alert"
        />
      </Panel>

      <Btn label={saving ? 'Saving…' : 'Save draft'} onPress={() => void saveDraft()} disabled={saving || !canWrite} variant="secondary" />
      <Btn
        label={saving ? 'Submitting…' : 'Submit for approval'}
        onPress={submitForApproval}
        disabled={saving || !canWrite || !recommendationText.trim()}
      />
    </KeyboardAwareScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 12, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6 },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    fontSize: 15,
    color: tokens.text,
    marginBottom: 12,
  },
  textArea: { minHeight: MULTILINE_MIN_HEIGHT, textAlignVertical: 'top' },
});
