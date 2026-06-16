import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens, type RecommendationGroupDraft } from '@morbeez/shared';
import { AlertBox, Btn, Panel } from '@morbeez/ui-native';

type Props = {
  groups: RecommendationGroupDraft[];
  approved: boolean;
  overrideReason?: string;
  onApprovedChange: (approved: boolean, overrideReason?: string) => void;
  checkCompatibility?: typeof agronomistClient.checkRecommendationCompatibility;
};

type CompatPair = {
  productA: string;
  productB: string;
  status: string;
  message?: string;
};

export function VisitRecApprovalStep({
  groups,
  approved,
  overrideReason,
  onApprovedChange,
  checkCompatibility = agronomistClient.checkRecommendationCompatibility,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<CompatPair[]>([]);
  const [hasIncompatible, setHasIncompatible] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const materials = groups.flatMap((g) =>
      g.materials.map((m) => ({ technicalName: m.technicalName.trim() })).filter((m) => m.technicalName)
    );
    if (materials.length < 2) {
      setPairs([]);
      setHasIncompatible(false);
      return;
    }
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError('');
      try {
        const r = await checkCompatibility({ materials });
        if (cancelled) return;
        setHasIncompatible(Boolean(r.hasIncompatiblePair));
        setPairs(
          (r.pairs ?? []).map((p) => ({
            productA: String(p.productA ?? ''),
            productB: String(p.productB ?? ''),
            status: String(p.status ?? 'unknown'),
            message: p.message ? String(p.message) : undefined,
          }))
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Compatibility check failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [groups, checkCompatibility]);

  return (
    <View style={styles.root}>
      <Panel title="Recommendation groups">
        {groups.map((g, i) => (
          <View key={g.localId} style={styles.groupRow}>
            <Text style={styles.groupTitle}>
              Group {i + 1}: {g.applicationType.replace(/_/g, ' ')} · Day {g.applicationDay}
            </Text>
            {g.materials.map((m) => (
              <Text key={m.localId} style={styles.materialLine}>
                • {m.technicalName || 'Unnamed'} {m.dose ? `(${m.dose})` : ''}
              </Text>
            ))}
          </View>
        ))}
      </Panel>

      <Panel title="Compatibility check">
        {loading ? <Text style={styles.muted}>Checking product compatibility…</Text> : null}
        {error ? <AlertBox>{error}</AlertBox> : null}
        {!pairs.length && !loading ? (
          <Text style={styles.muted}>Add at least two materials to run compatibility checks.</Text>
        ) : null}
        {pairs.map((p) => (
          <View key={`${p.productA}-${p.productB}`} style={styles.compatRow}>
            <Text style={styles.compatProducts}>
              {p.productA} + {p.productB}
            </Text>
            <Text
              style={[
                styles.compatStatus,
                p.status === 'not_recommended' ? styles.bad : p.status === 'ok' ? styles.good : styles.warn,
              ]}
            >
              {p.status.replace(/_/g, ' ')}
            </Text>
          </View>
        ))}
        {hasIncompatible && !approved ? (
          <Text style={styles.warnText}>
            Some products are not recommended together. Approve with override reason if you proceed.
          </Text>
        ) : null}
      </Panel>

      <View style={styles.actions}>
        <Btn
          label={approved ? 'Approved ✓' : 'Approve recommendations'}
          onPress={() => onApprovedChange(true, hasIncompatible ? overrideReason : undefined)}
          disabled={hasIncompatible && !overrideReason?.trim()}
        />
        <Btn label="Modify plan" variant="secondary" onPress={() => onApprovedChange(false)} />
      </View>
      {hasIncompatible ? (
        <Text style={styles.muted}>
          Override reason required when incompatible pairs exist (set on modify, then re-approve from review step notes).
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  groupRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.border },
  groupTitle: { fontSize: 14, fontWeight: '700', color: tokens.text },
  materialLine: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
  muted: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  compatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  compatProducts: { fontSize: 13, color: tokens.text, flex: 1, marginRight: 8 },
  compatStatus: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  good: { color: tokens.green700 },
  warn: { color: tokens.warning },
  bad: { color: tokens.danger },
  warnText: { fontSize: 13, color: tokens.warning, marginTop: 8 },
  actions: { gap: 8 },
});
