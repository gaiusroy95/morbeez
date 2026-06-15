import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

/** Wordmark height in green app bars (tabs + stack headers). */
export const MORBEEZ_HEADER_LOGO_HEIGHT = 32;

const LOGOS = {
  /** Light background — dark green wordmark */
  default: require('../assets/logo.png'),
  /** Dark / green header — light wordmark */
  onDark: require('../assets/logo1.png'),
} as const;

export type MorbeezLogoVariant = keyof typeof LOGOS;

type Props = {
  variant?: MorbeezLogoVariant;
  /** Logo height; width scales from asset aspect ratio */
  height?: number;
  style?: ViewStyle;
};

export function MorbeezLogo({ variant = 'default', height = 44, style }: Props) {
  return (
    <View style={[styles.wrap, style]} pointerEvents="none" accessibilityRole="image" accessibilityLabel="Morbeez">
      <Image
        source={LOGOS[variant]}
        style={{ height, width: height * 4.2 }}
        resizeMode="contain"
      />
    </View>
  );
}

/** Logo for navigation headers on dark green bars. */
export function HeaderMorbeezLogo({ style }: { style?: ViewStyle }) {
  return <MorbeezLogo variant="onDark" height={MORBEEZ_HEADER_LOGO_HEIGHT} style={style} />;
}

/** Stack header title: logo + screen title (used across staff/farmer apps). */
export function BrandedHeaderTitle({ title }: { title: string }) {
  return (
    <View style={styles.brandedRow}>
      <HeaderMorbeezLogo />
      <Text style={styles.brandedTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  brandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
  },
  brandedTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
});
