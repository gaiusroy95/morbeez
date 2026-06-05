import { matchRouteMeta } from '@/lib/routes';
import { theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DrawerNavigation = { openDrawer: () => void };

export function ConsoleScreenLayout({
  title,
  children,
  headerRight,
  scroll = true,
}: {
  title?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  scroll?: boolean;
}) {
  const navigation = useNavigation() as DrawerNavigation;
  const pathname = usePathname();
  const meta = matchRouteMeta(pathname);
  const pageTitle = title ?? meta.title;

  const body = scroll ? (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, styles.bodyContent]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          style={styles.menuBtn}
          onPress={() => navigation.openDrawer()}
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu" size={24} color={theme.green} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {pageTitle}
        </Text>
        <View style={styles.headerRight}>{headerRight}</View>
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.greenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2ef',
  },
  menuBtn: { padding: 6, marginRight: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.text },
  headerRight: { minWidth: 32, alignItems: 'flex-end' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32 },
});
