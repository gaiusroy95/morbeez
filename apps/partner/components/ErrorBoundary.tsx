import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';

type Props = { children: ReactNode; onReset?: () => void };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Partner app error boundary', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap} accessibilityRole="alert">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>{this.state.error.message}</Text>
          <Btn
            label="Try again"
            onPress={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
            accessibilityLabel="Try again"
          />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: tokens.bg, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.text },
  body: { fontSize: 14, color: tokens.textMuted, lineHeight: 20 },
});
