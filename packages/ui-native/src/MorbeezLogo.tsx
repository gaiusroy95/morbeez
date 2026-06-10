import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

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
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel="Morbeez">
      <Image
        source={LOGOS[variant]}
        style={{ height, width: height * 4.2 }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
