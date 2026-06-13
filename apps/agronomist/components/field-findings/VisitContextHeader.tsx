import { StyleSheet, Text, View } from 'react-native';
import { formatDate, tokens } from '@morbeez/shared';

type Props = {
  farmerName: string;
  blockName: string;
  cropType: string;
  dap?: number | null;
  stage?: string | null;
  agronomistName?: string | null;
};

export function VisitContextHeader({ farmerName, blockName, cropType, dap, stage, agronomistName }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{blockName || 'Block'}</Text>
      <Text style={styles.sub}>{[farmerName, cropType].filter(Boolean).join(' · ')}</Text>
      <Text style={styles.meta}>
        {formatDate(new Date().toISOString())}
        {dap != null ? ` · DAP ${dap}` : ''}
        {stage ? ` · ${stage}` : ''}
        {agronomistName ? ` · ${agronomistName}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 14, color: tokens.textMuted, marginTop: 2 },
  meta: { fontSize: 13, color: tokens.textMuted, marginTop: 6 },
});
