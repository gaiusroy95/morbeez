import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  agronomistClient,
  expandSeparateNutrientIssues,
  collectFarmerRecommendations,
  buildIssueDraftFromFarmerRecommendation,
  issueMatchesFarmerLabel,
  slugFarmerLabel,
  tokens,
  type AgronomistReviewAction,
  type IssueCategory,
  type IssueMasterRow,
} from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
import { type IssueDraft } from '../IssueCard';
import { getIssueCategoryLabel } from './visitIssueTypes';
import { AddIssueModal } from './AddIssueModal';
import {
  buildFarmerObservationText,
  type FarmerVisitFeedback,
  withFarmerObservation,
} from './farmerVisitFeedback';
import { newIssueDraft, pickDefaultCategory } from './types';

const REVIEW_ACTIONS: Array<{ value: AgronomistReviewAction; label: string }> = [
  { value: 'approve_ai', label: 'Approve' },
  { value: 'correct_ai', label: 'Modify' },
  { value: 'partial_match', label: 'Partial' },
  { value: 'reject_recommendation', label: 'Reject' },
];

function normalizeSavedIssue(issue: IssueDraft): IssueDraft {
  const dx = issue.finalDiagnosis?.trim() || issue.issueName.trim();
  return {
    ...issue,
    finalDiagnosis: dx,
    selectedHypothesisLabel: dx || issue.selectedHypothesisLabel,
  };
}

type Props = {
  issues: IssueDraft[];
  issueMaster: IssueMasterRow[];
  cropType: string;
  blockDap?: number | null;
  blockAutoApprove?: boolean;
  farmerFeedback?: FarmerVisitFeedback | null;
  onChange: (issues: IssueDraft[]) => void;
  onSuggestQuestions: (issue: IssueDraft) => Promise<string[]>;
  onCreateIssueType?: (input: {
    category: IssueCategory;
    issueName: string;
    cropType: string;
  }) => Promise<IssueMasterRow | null>;
};

export function VisitAgronomistReviewStep({
  issues,
  issueMaster,
  cropType,
  blockDap,
  blockAutoApprove,
  farmerFeedback,
  onChange,
  onSuggestQuestions,
  onCreateIssueType,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<IssueDraft | null>(null);
  const [explainText, setExplainText] = useState('');

  useEffect(() => {
    const expanded = expandSeparateNutrientIssues(issues);
    const changed =
      expanded.length !== issues.length ||
      expanded.some((row, i) => row.issueName !== issues[i]?.issueName);
    if (changed) onChange(expanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function explainIssue(issue: IssueDraft) {
    try {
      const r = await agronomistClient.explainDiagnosis({
        issueName: issue.issueName,
        finalDiagnosis: issue.finalDiagnosis ?? undefined,
        observation: issue.observation ?? undefined,
        severity: issue.severity ?? undefined,
      });
      setExplainText(r.agronomistText || r.farmerText);
    } catch (e) {
      setExplainText(e instanceof Error ? e.message : 'Explain failed');
    }
  }

  function patchIssue(localId: string, patch: Partial<IssueDraft>) {
    onChange(issues.map((i) => (i.localId === localId ? { ...i, ...patch } : i)));
  }

  function openIssueDetails(issue: IssueDraft | null) {
    const base = issue ?? newIssueDraft(pickDefaultCategory(), `new-${Date.now()}`);
    setEditing(withFarmerObservation(base, farmerFeedback));
    setModalVisible(true);
  }

  function setReviewAction(localId: string, action: AgronomistReviewAction) {
    const issue = issues.find((i) => i.localId === localId);
    if (!issue) return;
    const keepModifyFields = action === 'correct_ai' || action === 'partial_match';
    const farmerDx = farmerDxForIssue(issue) ?? farmerFeedback?.suggestedDiagnosis?.trim();
    const updated = {
      ...issue,
      ...(keepModifyFields && farmerDx
        ? {
            finalDiagnosis: farmerDx,
            observation: buildFarmerObservationText(farmerFeedback) || issue.observation,
          }
        : {}),
      agronomistReview: {
        action,
        finalDiagnosis: keepModifyFields && farmerDx ? farmerDx : issue.finalDiagnosis,
        finalRecommendation: issue.finalRecommendation,
        modificationReason: keepModifyFields
          ? issue.agronomistReview?.modificationReason ||
            (farmerDx ? `Farmer suggestion: ${farmerDx}` : undefined)
          : undefined,
      },
    };
    patchIssue(localId, updated);
    if (keepModifyFields) {
      openIssueDetails(updated);
    }
  }

  function applyFarmerSuggestion(localId: string, farmerDx: string) {
    if (!farmerDx.trim()) return;
    const issue = issues.find((i) => i.localId === localId);
    if (!issue) return;
    const updated: IssueDraft = {
      ...issue,
      finalDiagnosis: farmerDx,
      issueName: farmerDx,
      observation: buildFarmerObservationText(farmerFeedback) || issue.observation,
      agronomistReview: {
        action: 'correct_ai',
        finalDiagnosis: farmerDx,
        finalRecommendation: issue.finalRecommendation,
        modificationReason: `Farmer suggestion: ${farmerDx}`,
      },
    };
    patchIssue(localId, updated);
    openIssueDetails(updated);
  }

  function saveIssue(issue: IssueDraft) {
    const normalized = normalizeSavedIssue(issue);
    const exists = issues.some((i) => i.localId === normalized.localId);
    onChange(
      exists
        ? issues.map((i) => (i.localId === normalized.localId ? normalized : i))
        : [...issues, normalized]
    );
    setModalVisible(false);
    setEditing(null);
  }

  function addIssueFromFarmerRecommendation(label: string, reason?: string) {
    const already = issues.some((i) =>
      issueMatchesFarmerLabel(i.issueName, label, i.finalDiagnosis)
    );
    if (already) return;

    const base = buildIssueDraftFromFarmerRecommendation({
      label,
      reason,
      localId: `farmer-${slugFarmerLabel(label)}-${Date.now()}`,
      observation: buildFarmerObservationText(farmerFeedback),
    });
    const draft: IssueDraft = {
      ...newIssueDraft(base.category, base.localId),
      ...base,
      photosPreview: [],
    };
    onChange([...issues, draft]);
  }

  const farmerRecommendations = collectFarmerRecommendations(farmerFeedback ?? undefined);
  const farmerExperience = farmerFeedback?.priorExperience?.trim() || null;
  const farmerProduct = farmerFeedback?.priorProduct?.trim() || null;

  function farmerDxForIssue(issue: IssueDraft): string | null {
    const labels = farmerRecommendations.map((r) => r.label);
    if (!labels.length) return null;
    const hay = `${issue.issueName} ${issue.finalDiagnosis ?? ''}`.toLowerCase();
    for (const d of labels) {
      if (issueMatchesFarmerLabel(issue.issueName, d, issue.finalDiagnosis)) return d;
      const dl = d.toLowerCase();
      if (dl.includes('iron') && /iron|ferrous|\bfe\b/i.test(hay)) return d;
      if (dl.includes('zinc') && /zinc|\bzn\b/i.test(hay)) return d;
      if (dl.includes('magnesium') && /magnesium|\bmg\b/i.test(hay)) return d;
      if (dl.includes('nitrogen') && /nitrogen|\bn\b/i.test(hay)) return d;
      if (dl.includes('calcium') && /calcium|\bca\b/i.test(hay)) return d;
      if (hay.includes(dl.replace(' deficiency', '').slice(0, 8))) return d;
    }
    return labels.length === 1 ? labels[0]! : null;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Review each AI issue. Approve, modify, or reject — then tap Edit issue details to confirm category, type, and
        observation.
        {blockAutoApprove ? ' L4 critical — auto-approve is blocked; modify or escalate.' : ''}
      </Text>

      {farmerRecommendations.length || farmerExperience || farmerProduct ? (
        <View style={styles.farmerBanner}>
          <Text style={styles.farmerBannerTitle}>Farmer recommendation (WhatsApp)</Text>
          <Text style={styles.farmerBannerHint}>Tap a condition to add it to the issues list below.</Text>
          {farmerRecommendations.map((rec) => {
            const added = issues.some((i) =>
              issueMatchesFarmerLabel(i.issueName, rec.label, i.finalDiagnosis)
            );
            return (
              <Pressable
                key={rec.label}
                style={[styles.farmerChip, added && styles.farmerChipAdded]}
                onPress={() => addIssueFromFarmerRecommendation(rec.label, rec.reason)}
                disabled={added}
              >
                <View style={styles.farmerChipRow}>
                  <Text style={[styles.farmerBannerDx, added && styles.farmerBannerDxAdded]}>
                    {added ? '✓ ' : '+ '}
                    {rec.label}
                  </Text>
                  <Text style={styles.farmerChipAction}>{added ? 'Added' : 'Add issue'}</Text>
                </View>
                {rec.reason ? (
                  <Text style={styles.farmerChipReason} numberOfLines={3}>
                    {rec.reason}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {farmerProduct ? (
            <Text style={styles.farmerBannerMeta}>Prior products: {farmerProduct}</Text>
          ) : null}
          {farmerExperience ? (
            <Text style={styles.farmerBannerMeta} numberOfLines={6}>
              Field experience: {farmerExperience}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Btn label="+ Add issue" onPress={() => openIssueDetails(null)} />

      {issues.map((issue) => {
        const action = issue.agronomistReview?.action;
        const issueFarmerDx = farmerDxForIssue(issue);
        return (
          <View key={issue.localId} style={styles.card}>
            <Pressable onPress={() => openIssueDetails(issue)}>
              <Text style={styles.category}>{getIssueCategoryLabel(issue.category)}</Text>
              <Text style={styles.title}>{issue.issueName}</Text>
              {issue.finalDiagnosis ? <Text style={styles.dx}>AI: {issue.finalDiagnosis}</Text> : null}
              {issueFarmerDx ? <Text style={styles.farmerDx}>Farmer: {issueFarmerDx}</Text> : null}
              {!issueFarmerDx && farmerRecommendations.length > 1 ? (
                <Text style={styles.farmerDxMuted}>
                  Farmer named {farmerRecommendations.length} issues — tap above to add any missing
                </Text>
              ) : null}
            </Pressable>
            <View style={styles.actions}>
              {REVIEW_ACTIONS.map((a) => {
                const active = action === a.value;
                const disabled = blockAutoApprove && a.value === 'approve_ai';
                return (
                  <Pressable
                    key={a.value}
                    style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                    onPress={() => !disabled && setReviewAction(issue.localId, a.value)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive, disabled && styles.chipTextDisabled]}>
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Btn label="Edit issue details" variant="secondary" onPress={() => openIssueDetails(issue)} />
            {issueFarmerDx ? (
              <Btn
                label="Use farmer suggestion"
                variant="secondary"
                onPress={() => applyFarmerSuggestion(issue.localId, issueFarmerDx)}
              />
            ) : null}
            <Btn label="Explain diagnosis" variant="secondary" onPress={() => void explainIssue(issue)} />
          </View>
        );
      })}

      {explainText ? (
        <View style={styles.explainBox}>
          <Text style={styles.explainText}>{explainText}</Text>
        </View>
      ) : null}

      <AddIssueModal
        visible={modalVisible}
        issue={editing}
        issueMaster={issueMaster}
        cropType={cropType}
        blockDap={blockDap}
        farmerFeedback={farmerFeedback}
        onSave={saveIssue}
        onRemove={editing ? () => onChange(issues.filter((i) => i.localId !== editing.localId)) : undefined}
        onClose={() => {
          setModalVisible(false);
          setEditing(null);
        }}
        onSuggestQuestions={onSuggestQuestions}
        onCreateIssueType={onCreateIssueType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  farmerBanner: {
    backgroundColor: tokens.warningBg,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.warning,
    padding: 12,
    gap: 6,
  },
  farmerBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.warning,
    textTransform: 'uppercase',
  },
  farmerBannerHint: { fontSize: 11, color: tokens.textSecondary, marginBottom: 2 },
  farmerChip: {
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.warning,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  farmerChipAdded: {
    borderColor: tokens.green700,
    backgroundColor: tokens.green100,
    opacity: 0.92,
  },
  farmerChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  farmerChipAction: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.green800,
    textTransform: 'uppercase',
  },
  farmerChipReason: { fontSize: 11, color: tokens.textMuted, lineHeight: 15 },
  farmerBannerDx: { fontSize: 15, fontWeight: '700', color: tokens.text, lineHeight: 20, flex: 1 },
  farmerBannerDxAdded: { color: tokens.green800 },
  farmerBannerMeta: { fontSize: 12, color: tokens.textSecondary, lineHeight: 17 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 8,
    shadowColor: tokens.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  category: { fontSize: 12, fontWeight: '700', color: tokens.green800, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '700', color: tokens.text },
  dx: { fontSize: 12, color: tokens.green800, marginTop: 4 },
  farmerDx: { fontSize: 12, fontWeight: '700', color: tokens.warning, marginTop: 4 },
  farmerDxMuted: { fontSize: 11, color: tokens.textMuted, marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 12, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '700' },
  chipTextDisabled: { color: tokens.textMuted },
  explainBox: {
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  explainText: { fontSize: 13, color: tokens.text, lineHeight: 18 },
});
