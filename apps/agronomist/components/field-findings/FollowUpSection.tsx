import { StyleSheet, Text, View } from 'react-native';
import {
  RECOMMENDATION_FOLLOWED,
  VISIT_FOLLOWUP_OUTCOMES,
  tokens,
  type RecommendationFollowed,
  type VisitFollowupOutcome,
} from '@morbeez/shared';
import { Panel, TextField } from '@morbeez/ui-native';
import { SegmentedChips } from './SegmentedChips';

export type FollowUpDraft = {
  recommendationId: string;
  label: string;
  followed: RecommendationFollowed;
  outcome: VisitFollowupOutcome;
  notes: string;
};

const FOLLOWED_LABELS: Record<RecommendationFollowed, string> = {
  yes: 'Yes',
  partially: 'Partially',
  no: 'No',
  not_applicable: 'N/A',
};

const OUTCOME_LABELS: Record<VisitFollowupOutcome, string> = {
  improved: 'Improved',
  no_change: 'No change',
  worsened: 'Worsened',
  not_reviewed: 'Not reviewed',
};

type Props = {
  items: FollowUpDraft[];
  onChange: (index: number, next: FollowUpDraft) => void;
};

export function FollowUpSection({ items, onChange }: Props) {
  if (!items.length) return null;

  return (
    <Panel title="Follow-up on prior recommendations">
      <Text style={styles.hint}>Record outcomes from the farmer's last recommendations.</Text>
      {items.map((item, index) => (
        <View key={item.recommendationId} style={styles.card}>
          <Text style={styles.recLabel}>{item.label}</Text>
          <Text style={styles.fieldLabel}>Followed?</Text>
          <SegmentedChips
            options={RECOMMENDATION_FOLLOWED.map((v) => ({ value: v, label: FOLLOWED_LABELS[v] }))}
            value={item.followed}
            onChange={(followed) => onChange(index, { ...item, followed })}
          />
          <Text style={styles.fieldLabel}>Outcome</Text>
          <SegmentedChips
            options={VISIT_FOLLOWUP_OUTCOMES.map((v) => ({ value: v, label: OUTCOME_LABELS[v] }))}
            value={item.outcome}
            onChange={(outcome) => onChange(index, { ...item, outcome })}
          />
          <TextField
            label="Notes"
            value={item.notes}
            onChangeText={(notes) => onChange(index, { ...item, notes })}
            multiline
            placeholder="Farmer feedback or field observation"
          />
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 12 },
  card: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  recLabel: { fontSize: 14, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6, marginTop: 8 },
});
