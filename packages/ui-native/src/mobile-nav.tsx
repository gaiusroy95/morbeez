import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens, shadow } from '@morbeez/shared';
import { HeaderMorbeezLogo } from './MorbeezLogo';

/** Android 3-button / gesture nav bar — use when insets.bottom is 0 on real devices. */
export const ANDROID_NAV_BAR_MIN = 48;

/** Bottom inset that clears the system navigation bar on all devices. */
export function useDeviceBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, Platform.OS === 'android' ? ANDROID_NAV_BAR_MIN : 0);
}

/** Padding for sticky footers: content padding + device bottom inset. */
export function useStickyFooterPadding(contentPadding = 16): number {
  return contentPadding + useDeviceBottomInset();
}

/** Scroll content padding so lists are not hidden behind a sticky footer. */
export function useStickyFooterScrollPadding(options?: { rows?: number; gap?: number }): number {
  const rows = options?.rows ?? 1;
  const gap = options?.gap ?? 8;
  const topPad = 16;
  const rowHeight = 52;
  return topPad + rows * rowHeight + Math.max(0, rows - 1) * gap + topPad + useDeviceBottomInset();
}

/** Ignore press when finger moved farther than this (scroll vs tap). */
const ANDROID_TAP_SLOP = 12;

/** Android native-stack headers often drop onPress; onPressOut is reliable on real devices. */
export function androidPressHandlers(onPress: () => void, disabled?: boolean) {
  if (disabled) return { disabled: true as const };
  if (Platform.OS === 'android') {
    let startX = 0;
    let startY = 0;
    return {
      onPressIn: (event: GestureResponderEvent) => {
        startX = event.nativeEvent.pageX;
        startY = event.nativeEvent.pageY;
      },
      onPressOut: (event: GestureResponderEvent) => {
        const dx = Math.abs(event.nativeEvent.pageX - startX);
        const dy = Math.abs(event.nativeEvent.pageY - startY);
        if (dx <= ANDROID_TAP_SLOP && dy <= ANDROID_TAP_SLOP) {
          onPress();
        }
      },
    };
  }
  return { onPress };
}

/** Shared stack header styling for all Morbeez mobile apps. */
export const MOBILE_STACK_HEADER_OPTIONS = {
  headerStyle: {
    backgroundColor: tokens.green800,
    ...shadow.sm,
  },
  headerTintColor: tokens.textOnPrimary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerShadowVisible: false,
} as const;

export function useMobileTabBarStyle() {
  const bottomInset = useDeviceBottomInset();
  return {
    borderTopColor: tokens.border,
    backgroundColor: tokens.card,
    paddingBottom: bottomInset,
    paddingTop: 8,
    height: 58 + bottomInset,
    ...shadow.sm,
  };
}

export function StickyScreenFooter({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const paddingBottom = useStickyFooterPadding(16);
  return (
    <View style={[stickyFooterStyles.root, { paddingBottom }, style]}>
      {children}
    </View>
  );
}

export function useMobileTabScreenOptions() {
  const tabBarStyle = useMobileTabBarStyle();
  return {
    headerStyle: {
      backgroundColor: tokens.green800,
      ...shadow.sm,
    },
    headerTintColor: tokens.textOnPrimary,
    headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
    headerShadowVisible: false,
    headerLeft: () => <HeaderMorbeezLogo style={{ marginLeft: 12 }} />,
    tabBarActiveTintColor: tokens.primary,
    tabBarInactiveTintColor: tokens.textMuted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
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
      style={[styles.hubTabsScroll, style]}
      contentContainerStyle={styles.scrollTabsContent}
    >
      {tabs.map((tab, index) => {
        const isActive = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            {...androidPressHandlers(() => onChange(tab.id))}
            style={[
              styles.tab,
              index < tabs.length - 1 ? styles.tabSpacer : null,
              isActive && styles.tabActive,
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const stickyFooterStyles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: tokens.bg,
  },
});

const styles = StyleSheet.create({
  hubTabsScroll: {
    flexGrow: 0,
    backgroundColor: tokens.bg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  scrollTabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  tabSpacer: { marginRight: 8 },
  tabActive: {
    backgroundColor: tokens.green100,
    borderColor: tokens.green700,
  },
  tabText: {
    fontSize: 14,
    lineHeight: 18,
    color: tokens.text,
    fontWeight: '600',
  },
  tabTextActive: {
    color: tokens.green800,
  },
});
