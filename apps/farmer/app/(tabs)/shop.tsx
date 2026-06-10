import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import { tokens } from '@morbeez/shared';

const shopUrl =
  (Constants.expoConfig?.extra?.shopUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_SHOP_URL ||
  'https://morbeez-india.myshopify.com';

export default function ShopScreen() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: `${shopUrl.replace(/\/$/, '')}/collections/all` }}
        startInLoadingState
        allowsBackForwardNavigationGestures
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg },
});
