import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ISSUE_STATUSES,
  RECORD_SEVERITIES,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_PRIORITIES,
  FIELD_REC_STATUSES,
  tokens,
  type IssueCategory,
  type IssueMasterRow,
  type IssueStatus,
  type RecordSeverity,
  type VisitPhotoInput,
  type VisitIssueDraft,
  type RecommendationPriority,
} from '@morbeez/shared';
import { Btn, DynamicSelect, Panel, TextField, MULTILINE_MIN_HEIGHT } from '@morbeez/ui-native';
import { SegmentedChips } from './SegmentedChips';
import {
  getFallbackIssueTypes,
  getIssueCategoryLabel,
  ISSUE_CATEGORY_OPTIONS,
  issueCategoryHint,
} from './wizard/visitIssueTypes';

function slugLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^\w]/g, '');
}

const SEVERITY_LABELS: Record<RecordSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

type PhotoPreview = { uri: string; filename: string; mimeType: string; dataBase64: string };

export type IssueDraft = Omit<VisitIssueDraft, 'photos'> & {
  categoryLabel?: string;
  photosPreview?: PhotoPreview[];
  photos?: (VisitPhotoInput & { uri?: string })[];
  aiDosage?: string;
  aiPriority?: RecommendationPriority;
};

type Props = {
  issue: IssueDraft;
  issueMaster: IssueMasterRow[];
  cropType: string;
  onChange: (next: IssueDraft) => void;
  onRemove?: () => void;
  onSuggestQuestions?: () => Promise<string[]>;
  onCreateIssueType?: (input: {
    category: IssueCategory;
    issueName: string;
    cropType: string;
  }) => Promise<IssueMasterRow | null>;
};

export function IssueCard({
  issue,
  issueMaster,
  cropType,
  onChange,
  onRemove,
  onSuggestQuestions,
  onCreateIssueType,
}: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [extraCategories, setExtraCategories] = useState<Array<{ value: IssueCategory; label: string }>>([]);
  const [extraTypes, setExtraTypes] = useState<Array<{ key: string; value: string; label: string }>>([]);

  const categoryOptions = useMemo(() => {
    const base = ISSUE_CATEGORY_OPTIONS.map((o) => ({
      key: o.value,
      value: o.value,
      label: o.label,
    }));
    const extras = extraCategories.map((o) => ({
      key: `custom-cat:${o.label}`,
      value: `other:${o.label}`,
      label: o.label,
    }));
    return [...base, ...extras];
  }, [extraCategories]);

  const categoryValue = issue.categoryLabel ? `other:${issue.categoryLabel}` : issue.category;

  function applyCategoryValue(value: string) {
    if (value.startsWith('other:')) {
      const label = value.slice(6);
      onChange({ ...issue, category: 'other', categoryLabel: label, issueName: '', issueMasterId: undefined });
      return;
    }
    onChange({
      ...issue,
      category: value as IssueCategory,
      categoryLabel: undefined,
      issueName: '',
      issueMasterId: undefined,
    });
  }

  async function addCategory(name: string) {
    const label = name.trim();
    if (!label) return;
    setExtraCategories((prev) => (prev.some((c) => c.label === label) ? prev : [...prev, { value: 'other', label }]));
    onChange({ ...issue, category: 'other', categoryLabel: label, issueName: '', issueMasterId: undefined });
  }

  const nameOptions = useMemo(() => {
    const filtered = issueMaster.filter(
      (m) => m.category === issue.category && (!m.cropType || m.cropType === cropType)
    );
    const fromMaster =
      filtered.length > 0
        ? filtered.map((m) => ({ key: m.id, value: m.issueName, label: m.issueName }))
        : getFallbackIssueTypes(cropType, issue.category).map((name, index) => ({
            key: `fallback-${issue.category}-${index}`,
            value: name,
            label: name,
          }));
    return [...fromMaster, ...extraTypes];
  }, [issueMaster, issue.category, cropType, extraTypes]);

  async function addIssueType(name: string) {
    const issueName = name.trim();
    if (!issueName) return;
    if (onCreateIssueType) {
      const row = await onCreateIssueType({ category: issue.category, issueName, cropType });
      if (row) {
        onChange({ ...issue, issueName: row.issueName, issueMasterId: row.id });
        return;
      }
    }
    const key = `local-type:${slugLabel(issueName)}`;
    setExtraTypes((prev) =>
      prev.some((t) => t.value === issueName) ? prev : [...prev, { key, value: issueName, label: issueName }]
    );
    onChange({ ...issue, issueName, issueMasterId: undefined });
  }

  async function addPhotos(source: 'camera' | 'library') {
    const count = issue.photosPreview?.length ?? 0;
    if (count >= 4) return;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsMultipleSelection: source === 'library',
      selectionLimit: 4 - count,
    };
    const pick =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (pick.canceled) return;
    const next = pick.assets
      .filter((a) => a.base64)
      .map((a) => ({
        uri: a.uri,
        filename: a.fileName ?? 'photo.jpg',
        mimeType: a.mimeType ?? 'image/jpeg',
        dataBase64: a.base64!,
      }));
    onChange({
      ...issue,
      photosPreview: [...(issue.photosPreview ?? []), ...next].slice(0, 4),
      photos: [...(issue.photos ?? []), ...next.map((p) => ({
        filename: p.filename,
        mimeType: p.mimeType,
        dataBase64: p.dataBase64,
      }))].slice(0, 4),
    });
  }

  async function loadQuestions() {
    if (!onSuggestQuestions) return;
    const q = await onSuggestQuestions();
    setQuestions(q);
  }

  return (
    <Panel title="Issue details">
      <Text style={styles.hint}>{issueCategoryHint(cropType)}</Text>

      <DynamicSelect
        label="Issue category"
        placeholder="Select category"
        value={categoryValue}
        options={categoryOptions}
        allowAdd
        addPlaceholder="New category label"
        addButtonLabel="Add"
        onChange={(value) => applyCategoryValue(value)}
        onAdd={addCategory}
      />

      <DynamicSelect
        label="Issue type"
        placeholder={`Select ${getIssueCategoryLabel(issue.category).toLowerCase()} type`}
        value={issue.issueName}
        options={nameOptions}
        allowAdd
        addPlaceholder="New issue type"
        addButtonLabel="Add"
        onChange={(name, option) =>
          onChange({
            ...issue,
            issueName: name,
            issueMasterId: option && !option.key.startsWith('fallback-') && !option.key.startsWith('local-type:') ? option.key : undefined,
          })
        }
        onAdd={addIssueType}
      />
      <Text style={styles.label}>Severity</Text>
      <SegmentedChips
        options={RECORD_SEVERITIES.map((v) => ({ value: v, label: SEVERITY_LABELS[v] }))}
        value={issue.severity}
        onChange={(severity) => onChange({ ...issue, severity })}
      />
      <Text style={styles.label}>Status</Text>
      <SegmentedChips
        options={ISSUE_STATUSES.map((v) => ({ value: v, label: STATUS_LABELS[v] }))}
        value={issue.status ?? 'open'}
        onChange={(status) => onChange({ ...issue, status })}
      />
      <Text style={styles.label}>Observation</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={issue.observation ?? ''}
        onChangeText={(observation) => onChange({ ...issue, observation })}
        multiline
        placeholder="What you see on this issue…"
        placeholderTextColor={tokens.textMuted}
      />
      {onSuggestQuestions ? (
        <>
          <Btn label="Suggest follow-up questions" variant="secondary" onPress={() => void loadQuestions()} />
          {questions.length ? (
            <View style={styles.questions}>
              {questions.map((q) => (
                <Pressable
                  key={q}
                  style={styles.questionChip}
                  onPress={() =>
                    onChange({
                      ...issue,
                      observation: [issue.observation?.trim(), q].filter(Boolean).join('\n'),
                    })
                  }
                >
                  <Text style={styles.questionText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <Text style={styles.label}>Photos (up to 4)</Text>
      <View style={styles.photoActions}>
        <Pressable style={styles.photoActionBtn} onPress={() => void addPhotos('camera')}>
          <Text style={styles.photoActionText}>Camera</Text>
        </Pressable>
        <Pressable style={styles.photoActionBtn} onPress={() => void addPhotos('library')}>
          <Text style={styles.photoActionText}>Gallery</Text>
        </Pressable>
      </View>
      <View style={styles.photoRow}>
        {(issue.photosPreview ?? []).map((p, i) => (
          <View key={`${p.uri}-${i}`} style={styles.photoWrap}>
            <Image source={{ uri: p.uri }} style={styles.photo} />
            <Pressable
              style={styles.photoRemove}
              onPress={() => {
                const previews = (issue.photosPreview ?? []).filter((_, j) => j !== i);
                const photos = (issue.photos ?? []).filter((_, j) => j !== i);
                onChange({ ...issue, photosPreview: previews, photos });
              }}
            >
              <Text style={styles.photoRemoveText}>×</Text>
            </Pressable>
          </View>
        ))}
        {(issue.photosPreview?.length ?? 0) < 4 ? (
          <Pressable style={styles.photoAdd} onPress={() => void addPhotos('library')}>
            <Text style={styles.photoAddText}>+</Text>
          </Pressable>
        ) : null}
      </View>
      {onRemove ? <Btn label="Remove issue" variant="secondary" onPress={onRemove} /> : null}
      <InlineRecommendations issue={issue} onChange={onChange} />
    </Panel>
  );
}

function InlineRecommendations({ issue, onChange }: { issue: IssueDraft; onChange: (next: IssueDraft) => void }) {
  const recs = issue.recommendations ?? [];

  function updateRec(index: number, patch: Partial<NonNullable<IssueDraft['recommendations']>[number]>) {
    const next = [...recs];
    next[index] = { ...next[index], ...patch };
    onChange({ ...issue, recommendations: next });
  }

  function addRec() {
    onChange({
      ...issue,
      recommendations: [
        ...recs,
        { text: '', recommendationType: 'other', priority: 'normal', status: 'open', reviewAfterDays: 7 },
      ],
    });
  }

  function removeRec(index: number) {
    onChange({ ...issue, recommendations: recs.filter((_, i) => i !== index) });
  }

  return (
    <View style={styles.recSection}>
      <Text style={styles.label}>Recommendations for this issue</Text>
      {recs.map((rec, index) => (
        <View key={`rec-${index}`} style={styles.recCard}>
          <Text style={styles.fieldLabel}>Type</Text>
          <SegmentedChips
            options={RECOMMENDATION_TYPES.slice(0, 4).map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))}
            value={rec.recommendationType ?? 'other'}
            onChange={(recommendationType) => updateRec(index, { recommendationType })}
          />
          <TextField
            label="Recommendation text"
            value={rec.text}
            onChangeText={(text) => updateRec(index, { text })}
            multiline
            placeholder="Spray copper oxychloride…"
          />
          <Text style={styles.fieldLabel}>Priority</Text>
          <SegmentedChips
            options={RECOMMENDATION_PRIORITIES.map((v) => ({ value: v, label: v }))}
            value={rec.priority ?? 'normal'}
            onChange={(priority) => updateRec(index, { priority })}
          />
          <Text style={styles.fieldLabel}>Status</Text>
          <SegmentedChips
            options={FIELD_REC_STATUSES.map((v) => ({ value: v, label: v }))}
            value={rec.status ?? 'open'}
            onChange={(status) => updateRec(index, { status })}
          />
          <Btn label="Remove recommendation" variant="secondary" onPress={() => removeRec(index)} />
        </View>
      ))}
      <Btn label="Add recommendation" variant="secondary" onPress={addRec} />
    </View>
  );
}

export function IssueCategoryPicker({
  selected,
  onToggle,
}: {
  selected: IssueCategory[];
  onToggle: (category: IssueCategory) => void;
}) {
  return (
    <Panel title="Issues present">
      <Text style={styles.hint}>Select categories to add issue cards.</Text>
      <View style={styles.row}>
        {ISSUE_CATEGORY_OPTIONS.map((option) => {
          const active = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => onToggle(option.value)}
              style={[styles.catChip, active && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6, marginTop: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10 },
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
  textArea: { minHeight: MULTILINE_MIN_HEIGHT, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  catChipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  catChipText: { fontSize: 13, color: tokens.textMuted },
  catChipTextActive: { color: tokens.green800, fontWeight: '600' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  photoActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green500,
    backgroundColor: tokens.green100,
  },
  photoActionText: { fontSize: 13, fontWeight: '600', color: tokens.green800 },
  photoWrap: { position: 'relative' },
  photo: { width: 72, height: 72, borderRadius: 8 },
  photoRemove: { position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6 },
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
  questions: { gap: 6, marginTop: 8, marginBottom: 8 },
  questionChip: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: tokens.green100,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  questionText: { fontSize: 13, color: tokens.text, lineHeight: 18 },
  recSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.border },
  recCard: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: tokens.border },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6, marginTop: 8 },
});
