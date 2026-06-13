import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@morbeez/shared';
import { MorbeezLogo } from './MorbeezLogo';

/** Android native-stack headers often drop onPress; onPressOut is reliable on real devices. */
export function androidPressHandlers(onPress: () => void, disabled?: boolean) {
  if (disabled) return { disabled: true as const };
  if (Platform.OS === 'android') {
    return { onPressOut: () => onPress() };
  }
  return { onPress };
}

export function useMobileTabBarStyle() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);
  return {
    borderTopColor: tokens.border,
    backgroundColor: '#fff',
    paddingBottom: bottom,
    paddingTop: 6,
    height: 56 + bottom,
  };
}

export function useMobileTabScreenOptions() {
  const tabBarStyle = useMobileTabBarStyle();
  return {
    headerStyle: { backgroundColor: tokens.green800 },
    headerTintColor: '#fff' as const,
    headerTitleStyle: { fontWeight: '600' as const },
    headerLeft: () => (
      <MorbeezLogo variant="onDark" height={22} style={{ marginLeft: 12 }} />
    ),
    tabBarActiveTintColor: tokens.green700,
    tabBarInactiveTintColor: tokens.textMuted,
    tabBarStyle,
    sceneStyle: { flex: 1, backgroundColor: tokens.bg },
  };
}

export function HeaderPressable({
  onPress,
  children,
  style,
  accessibilityLabel,
  disabled,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
      hitSlop={8}
      {...androidPressHandlers(onPress, disabled)}
    >
      {children}
    </Pressable>
  );
}

export function ScrollableHubTabs<T extends string>({
  tabs,
  active,
  onChange,
  style,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
  style?: ViewStyle;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      style={style}
      contentContainerStyle={styles.scrollTabsContent}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          hitSlop={4}
          {...androidPressHandlers(() => onChange(tab.id))}
          style={[styles.tab, active === tab.id && styles.tabActive]}
        >
          <Text style={[styles.tabText, active === tab.id && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollTabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  tabActive: {
    backgroundColor: tokens.green100,
    borderColor: tokens.green500,
  },
  tabText: {
    fontSize: 13,
    color: tokens.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: tokens.green800,
    fontWeight: '600',
  },
});
