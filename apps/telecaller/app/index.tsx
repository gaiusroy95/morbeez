import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { useStaffAuth } from '@/context/StaffAuth';

export default function Index() {
  const { ready, authed } = useStaffAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg }}>
        <ActivityIndicator color={tokens.green700} />
      </View>
    );
  }

  return <Redirect href={authed ? '/(tabs)/dashboard' : '/(auth)/login'} />;
}
