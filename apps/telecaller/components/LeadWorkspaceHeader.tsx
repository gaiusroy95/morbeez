import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { telecallerClient, tokens, type TelecallerWorkspaceSummary } from '@morbeez/shared';
import { AlertBox, Btn, Panel } from '@morbeez/ui-native';
import { useState } from 'react';

type Props = {
  summary: TelecallerWorkspaceSummary;
};

function dialPhone(phone: string | null | undefined) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits) void Linking.openURL(`tel:${digits}`);
}

function openWhatsApp(phone: string | null | undefined) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits) void Linking.openURL(`https://wa.me/${digits}`);
}

export function LeadWorkspaceHeader({ summary }: Props) {
  const [clickLoading, setClickLoading] = useState(false);
  const [clickError, setClickError] = useState('');

  const handleClickToCall = async () => {
    if (!summary.farmer.phone) return;
    setClickLoading(true);
    setClickError('');
    try {
      const result = await telecallerClient.clickToCall(summary.leadId, summary.farmer.phone);
      if (result.mode === 'native') {
        dialPhone(result.dialPhone ?? summary.farmer.phone);
      }
    } catch (e) {
      setClickError(e instanceof Error ? e.message : 'Click-to-call failed');
    } finally {
      setClickLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Panel title={summary.farmer.name}>
        <Text style={styles.subtitle}>
          {[summary.farmer.village, summary.farmer.district].filter(Boolean).join(' · ') || '—'}
        </Text>
        {summary.farmer.phone ? <Text style={styles.phone}>{summary.farmer.phone}</Text> : null}
        <View style={styles.badges}>
          <Text style={styles.stageBadge}>{summary.lead.stageLabel}</Text>
          {summary.intelligence.opportunityScore != null ? (
            <Text style={styles.scoreBadge}>Score {summary.intelligence.opportunityScore}</Text>
          ) : null}
        </View>
      </Panel>

      {clickError ? <AlertBox>{clickError}</AlertBox> : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => dialPhone(summary.farmer.phone)}
          disabled={!summary.farmer.phone}
        >
          <Ionicons name="call-outline" size={22} color={tokens.green700} />
          <Text style={styles.actionLabel}>Call</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => openWhatsApp(summary.farmer.phone)}
          disabled={!summary.farmer.phone}
        >
          <Ionicons name="logo-whatsapp" size={22} color={tokens.green700} />
          <Text style={styles.actionLabel}>WhatsApp</Text>
        </Pressable>
        <View style={styles.clickToCall}>
          <Btn
            label={clickLoading ? 'Calling…' : 'Click to call'}
            onPress={() => void handleClickToCall()}
            disabled={!summary.farmer.phone || clickLoading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  subtitle: { fontSize: 14, color: tokens.textMuted, marginBottom: 4 },
  phone: { fontSize: 15, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  stageBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.green800,
    backgroundColor: tokens.green100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  scoreBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text,
    backgroundColor: tokens.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  actionBtn: { alignItems: 'center', padding: 8, minWidth: 64 },
  actionLabel: { fontSize: 11, color: tokens.textMuted, marginTop: 2 },
  clickToCall: { flex: 1 },
});
