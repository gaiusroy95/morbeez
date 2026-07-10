import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { telecallerClient, tokens } from '@morbeez/shared';
import {
  AlertBox,
  Btn,
  DynamicSelect,
  TextField,
  type DynamicSelectOption,
} from '@morbeez/ui-native';

type Props = {
  visible: boolean;
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
};

type BlockOption = { id: string; name: string; cropName?: string };
type WorkflowStatus = 'Active' | 'Closed' | 'Escalated';

const WORKFLOW_OPTIONS: DynamicSelectOption[] = [
  { key: 'Active', value: 'Active', label: 'Active' },
  { key: 'Closed', value: 'Closed', label: 'Closed' },
  { key: 'Escalated', value: 'Escalated', label: 'Escalated' },
];

const FINDING_TYPE_OPTIONS: DynamicSelectOption[] = [
  { key: 'disease', value: 'disease', label: 'Disease' },
  { key: 'pest', value: 'pest', label: 'Pest' },
  { key: 'nutrient_deficiency', value: 'nutrient_deficiency', label: 'Nutrient deficiency' },
  { key: 'irrigation', value: 'irrigation', label: 'Irrigation' },
  { key: 'weather_stress', value: 'weather_stress', label: 'Weather stress' },
  { key: 'growth_observation', value: 'growth_observation', label: 'Growth observation' },
  { key: 'other', value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS: DynamicSelectOption[] = [
  { key: 'mild', value: 'mild', label: 'Mild' },
  { key: 'moderate', value: 'moderate', label: 'Moderate' },
  { key: 'severe', value: 'severe', label: 'Severe' },
];

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function mastersToOptions(
  items: Array<{ id: string; name: string }>
): DynamicSelectOption[] {
  return items.map((item) => ({
    key: item.id,
    value: item.id,
    label: item.name,
  }));
}

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.checkRow}>
      <Text style={styles.checkLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: tokens.border, true: tokens.green400 }}
        thumbColor={value ? tokens.green700 : '#f4f4f4'}
      />
    </View>
  );
}

export function AddInteractionModal({ visible, leadId, onClose, onSaved }: Props) {
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [typeOptions, setTypeOptions] = useState<DynamicSelectOption[]>([]);
  const [outcomeOptions, setOutcomeOptions] = useState<DynamicSelectOption[]>([]);
  const [nextActionOptions, setNextActionOptions] = useState<DynamicSelectOption[]>([]);
  const [activityOptions, setActivityOptions] = useState<DynamicSelectOption[]>([]);
  const [mastersLoading, setMastersLoading] = useState(false);

  const [interactionTypeId, setInteractionTypeId] = useState('');
  const [interactionTypeName, setInteractionTypeName] = useState('');
  const [interactionDate, setInteractionDate] = useState(todayYmd);
  const [blockId, setBlockId] = useState('');
  const [summary, setSummary] = useState('');

  const [addFieldFinding, setAddFieldFinding] = useState(false);
  const [findingType, setFindingType] = useState('');
  const [severity, setSeverity] = useState('');
  const [finalConfirmedIssue, setFinalConfirmedIssue] = useState('');

  const [addFieldActivity, setAddFieldActivity] = useState(false);
  const [fieldActivityTypeId, setFieldActivityTypeId] = useState('');
  const [fieldActivityLabel, setFieldActivityLabel] = useState('');
  const [fieldActivityDate, setFieldActivityDate] = useState('');

  const [escalate, setEscalate] = useState(false);
  const [recommendationCompleted, setRecommendationCompleted] = useState(false);
  const [recommendationSummary, setRecommendationSummary] = useState('');

  const [outcomeId, setOutcomeId] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextActionId, setNextActionId] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('Closed');
  const [nextActionAt, setNextActionAt] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === blockId) ?? null,
    [blocks, blockId]
  );

  const blockOptions = useMemo<DynamicSelectOption[]>(
    () => [
      { key: 'none', value: '', label: '— None —' },
      ...blocks.map((b) => ({
        key: b.id,
        value: b.id,
        label: b.cropName ? `${b.name} — ${b.cropName}` : b.name,
      })),
    ],
    [blocks]
  );

  const resetForm = useCallback(() => {
    setInteractionTypeId('');
    setInteractionTypeName('');
    setInteractionDate(todayYmd());
    setBlockId('');
    setSummary('');
    setAddFieldFinding(false);
    setFindingType('');
    setSeverity('');
    setFinalConfirmedIssue('');
    setAddFieldActivity(false);
    setFieldActivityTypeId('');
    setFieldActivityLabel('');
    setFieldActivityDate('');
    setEscalate(false);
    setRecommendationCompleted(false);
    setRecommendationSummary('');
    setOutcomeId('');
    setOutcome('');
    setNextActionId('');
    setNextAction('');
    setWorkflowStatus('Closed');
    setNextActionAt('');
    setError('');
  }, []);

  const loadMasters = useCallback(async () => {
    setMastersLoading(true);
    try {
      const [types, outcomes, nextActions, rawBlocks] = await Promise.all([
        telecallerClient.listMasters('interaction_type'),
        telecallerClient.listMasters('interaction_outcome'),
        telecallerClient.listMasters('interaction_next_action'),
        telecallerClient.listLeadBlocks(leadId),
      ]);
      setTypeOptions(mastersToOptions(types));
      setOutcomeOptions(mastersToOptions(outcomes));
      setNextActionOptions(mastersToOptions(nextActions));
      setBlocks(
        rawBlocks.map((b) => ({
          id: String(b.id),
          name: String(b.name ?? b.plotLabel ?? 'Block'),
          cropName: b.cropName
            ? String(b.cropName)
            : b.crop_name
              ? String(b.crop_name)
              : b.cropType
                ? String(b.cropType)
                : b.crop_type
                  ? String(b.crop_type)
                  : undefined,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load form options');
    } finally {
      setMastersLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!visible) return;
    resetForm();
    void loadMasters();
  }, [visible, loadMasters, resetForm]);

  useEffect(() => {
    if (!visible || !addFieldActivity || !blockId) {
      setActivityOptions([]);
      return;
    }
    const cropType = selectedBlock?.cropName ?? '';
    void telecallerClient
      .listFieldActivityTypes(leadId, { cropType, activeOnly: true })
      .then((types) => {
        setActivityOptions(
          types.map((t) => ({
            key: t.id,
            value: t.id,
            label: t.activity_name,
          }))
        );
      })
      .catch(() => setActivityOptions([]));
  }, [visible, addFieldActivity, blockId, selectedBlock?.cropName, leadId]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const save = async () => {
    setError('');
    if (!interactionTypeName.trim()) {
      setError('Interaction type is required');
      return;
    }
    if (!summary.trim()) {
      setError('Summary is required');
      return;
    }
    if ((addFieldFinding || addFieldActivity) && !blockId) {
      setError('Select a block for field finding or activity');
      return;
    }
    if (addFieldFinding) {
      if (!findingType) {
        setError('Finding type is required');
        return;
      }
      if (!severity) {
        setError('Severity is required');
        return;
      }
      if (!finalConfirmedIssue.trim()) {
        setError('Confirmed issue is required');
        return;
      }
    }
    if (addFieldActivity && !fieldActivityDate.trim()) {
      setError('Field activity date is required');
      return;
    }

    const effectiveWorkflow: WorkflowStatus = escalate
      ? 'Escalated'
      : workflowStatus === 'Closed' && nextAction.trim()
        ? 'Active'
        : workflowStatus;

    setSaving(true);
    try {
      await telecallerClient.createLeadInteraction(leadId, {
        interactionType: interactionTypeName.trim(),
        blockId: blockId || undefined,
        summary: summary.trim(),
        interactionAt: interactionDate
          ? new Date(`${interactionDate}T12:00:00`).toISOString()
          : undefined,
        outcome: outcome.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        nextActionAt: nextActionAt.trim()
          ? new Date(nextActionAt.includes('T') ? nextActionAt : `${nextActionAt}T12:00:00`).toISOString()
          : undefined,
        workflowStatus: effectiveWorkflow,
        addFieldFinding,
        ...(addFieldFinding
          ? {
              findingType,
              severity,
              finalConfirmedIssue: finalConfirmedIssue.trim(),
            }
          : {}),
        addFieldActivity,
        fieldActivityLabel: addFieldActivity
          ? fieldActivityLabel.trim() || undefined
          : undefined,
        fieldActivityTypeId: addFieldActivity ? fieldActivityTypeId || undefined : undefined,
        fieldActivityDate: addFieldActivity ? fieldActivityDate.trim() : undefined,
        recommendationCompleted,
        recommendationSummary: recommendationCompleted
          ? recommendationSummary.trim() || summary.trim()
          : undefined,
        escalate,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save interaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add interaction</Text>
          <Pressable onPress={handleClose} hitSlop={8} disabled={saving}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.modalBody}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <AlertBox>{error}</AlertBox> : null}

          <DynamicSelect
            label="Interaction type"
            placeholder="Select…"
            value={interactionTypeId}
            options={typeOptions}
            loading={mastersLoading}
            allowAdd
            addPlaceholder="New interaction type"
            onChange={(id, option) => {
              setInteractionTypeId(id);
              setInteractionTypeName(option?.label ?? '');
            }}
            onAdd={async (name) => {
              const item = await telecallerClient.createMaster({
                masterType: 'interaction_type',
                name,
              });
              setTypeOptions((prev) => [...prev, { key: item.id, value: item.id, label: item.name }]);
              setInteractionTypeId(item.id);
              setInteractionTypeName(item.name);
            }}
          />

          <TextField
            label="Interaction date"
            value={interactionDate}
            onChangeText={setInteractionDate}
            placeholder="YYYY-MM-DD"
          />

          <DynamicSelect
            label="Block"
            placeholder="— None —"
            value={blockId}
            options={blockOptions}
            onChange={(id) => setBlockId(id)}
          />

          <TextField
            label="Summary"
            value={summary}
            onChangeText={setSummary}
            multiline
            placeholder="Communication summary for this operational session…"
          />

          <View style={styles.checksBox}>
            <CheckRow label="Add field finding" value={addFieldFinding} onChange={setAddFieldFinding} />
            {addFieldFinding ? (
              <View style={styles.nested}>
                <DynamicSelect
                  label="Finding type"
                  placeholder="Select…"
                  value={findingType}
                  options={FINDING_TYPE_OPTIONS}
                  onChange={(v) => setFindingType(v)}
                />
                <DynamicSelect
                  label="Severity"
                  placeholder="Select…"
                  value={severity}
                  options={SEVERITY_OPTIONS}
                  onChange={(v) => setSeverity(v)}
                />
                <TextField
                  label="Confirmed issue"
                  value={finalConfirmedIssue}
                  onChangeText={setFinalConfirmedIssue}
                  placeholder="e.g. Leaf blight"
                />
              </View>
            ) : null}

            <CheckRow
              label="Add field activity"
              value={addFieldActivity}
              onChange={setAddFieldActivity}
            />
            {addFieldActivity ? (
              <View style={styles.nested}>
                <DynamicSelect
                  label="Field activity"
                  placeholder={blockId ? 'Select…' : 'Select a block first'}
                  value={fieldActivityTypeId}
                  options={activityOptions}
                  disabled={!blockId}
                  allowAdd={Boolean(blockId)}
                  addPlaceholder="New activity"
                  onChange={(id, option) => {
                    setFieldActivityTypeId(id);
                    setFieldActivityLabel(option?.label ?? '');
                  }}
                  onAdd={async (name) => {
                    const type = await telecallerClient.createFieldActivityType(leadId, {
                      activityName: name,
                      crop: selectedBlock?.cropName ?? null,
                    });
                    setActivityOptions((prev) => [
                      ...prev,
                      { key: type.id, value: type.id, label: type.activity_name },
                    ]);
                    setFieldActivityTypeId(type.id);
                    setFieldActivityLabel(type.activity_name);
                  }}
                />
                <TextField
                  label="Activity date"
                  value={fieldActivityDate}
                  onChangeText={setFieldActivityDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            ) : null}

            <CheckRow label="Escalate" value={escalate} onChange={setEscalate} />

            <CheckRow
              label="Recommendation completed"
              value={recommendationCompleted}
              onChange={setRecommendationCompleted}
            />
            {recommendationCompleted ? (
              <View style={styles.nested}>
                <TextField
                  label="Recommendation"
                  value={recommendationSummary}
                  onChangeText={setRecommendationSummary}
                  multiline
                  placeholder="Technical / product recommendation summary…"
                />
              </View>
            ) : null}
          </View>

          <DynamicSelect
            label="Interaction outcome"
            placeholder="Select…"
            value={outcomeId}
            options={outcomeOptions}
            loading={mastersLoading}
            allowAdd
            addPlaceholder="New outcome"
            onChange={(id, option) => {
              setOutcomeId(id);
              setOutcome(option?.label ?? '');
            }}
            onAdd={async (name) => {
              const item = await telecallerClient.createMaster({
                masterType: 'interaction_outcome',
                name,
              });
              setOutcomeOptions((prev) => [
                ...prev,
                { key: item.id, value: item.id, label: item.name },
              ]);
              setOutcomeId(item.id);
              setOutcome(item.name);
            }}
          />

          <DynamicSelect
            label="Next action"
            placeholder="Select…"
            value={nextActionId}
            options={nextActionOptions}
            loading={mastersLoading}
            allowAdd
            addPlaceholder="New next action"
            onChange={(id, option) => {
              setNextActionId(id);
              setNextAction(option?.label ?? '');
              if (option?.label?.trim() && workflowStatus === 'Closed') {
                setWorkflowStatus('Active');
              }
            }}
            onAdd={async (name) => {
              const item = await telecallerClient.createMaster({
                masterType: 'interaction_next_action',
                name,
              });
              setNextActionOptions((prev) => [
                ...prev,
                { key: item.id, value: item.id, label: item.name },
              ]);
              setNextActionId(item.id);
              setNextAction(item.name);
              if (workflowStatus === 'Closed') setWorkflowStatus('Active');
            }}
          />

          <DynamicSelect
            label="Workflow status"
            value={escalate ? 'Escalated' : workflowStatus}
            options={WORKFLOW_OPTIONS}
            disabled={escalate}
            onChange={(v) => setWorkflowStatus(v as WorkflowStatus)}
          />

          <TextField
            label="Next action due (optional)"
            value={nextActionAt}
            onChangeText={setNextActionAt}
            placeholder="YYYY-MM-DD or YYYY-MM-DDTHH:mm"
          />

          <View style={styles.footer}>
            <Btn
              label={saving ? 'Saving…' : 'Save'}
              onPress={() => void save()}
              disabled={saving}
            />
            <Btn label="Cancel" variant="secondary" onPress={handleClose} disabled={saving} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: tokens.bg, paddingTop: 48 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: tokens.text, flex: 1 },
  close: { fontSize: 15, fontWeight: '600', color: tokens.green700 },
  modalBody: { padding: 16, paddingBottom: 48, gap: 12 },
  checksBox: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.green100,
    padding: 12,
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkLabel: { flex: 1, fontSize: 14, color: tokens.text, fontWeight: '500' },
  nested: { gap: 10, paddingLeft: 4 },
  footer: { gap: 10, marginTop: 8 },
});
