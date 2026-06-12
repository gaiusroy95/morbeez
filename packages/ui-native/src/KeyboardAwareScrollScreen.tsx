import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Keep form vertically centered when the keyboard is closed; spacers collapse when it opens. */
  centered?: boolean;
} & Omit<ScrollViewProps, 'contentContainerStyle' | 'children'>;

export function KeyboardAwareScrollScreen({
  children,
  contentContainerStyle,
  centered = false,
  ...scrollProps
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) },
          contentContainerStyle,
        ]}
        {...scrollProps}
      >
        {centered ? (
          <>
            <View style={styles.flexSpacer} />
            {children}
            <View style={styles.flexSpacer} />
          </>
        ) : (
          children
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  flexSpacer: {
    flex: 1,
    minHeight: 0,
  },
});
