import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { LeadDetailTabs } from '@/components/LeadDetailTabs';
import { useStaffAuth } from '@/context/StaffAuth';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canWrite } = useStaffAuth();

  if (!id) return null;

  return (
    <View style={styles.root}>
      <LeadDetailTabs leadId={id} canWrite={canWrite} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
});
