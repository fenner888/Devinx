/**
 * ErrorBoundary — catches render crashes and shows a fallback UI
 * with a restart button. Reports to Sentry.
 */

import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView className="flex-1 bg-surface0" edges={['top', 'bottom']}>
          <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6">
            <Text className="font-mono text-failed text-text14 mb-4">{'X_X'}</Text>
            <Text className="text-text-hi text-text17 text-center mb-2">Something went wrong</Text>
            <Text className="text-text-mid text-text13 text-center mb-6">
              The app encountered an unexpected error. Your data is safe.
            </Text>
            {this.state.error && (
              <View className="bg-surface1 rounded-card px-4 py-3 mb-6 w-full max-w-sm">
                <Text className="text-text-low text-text12 mb-1">Error details</Text>
                <Text className="text-text-mid text-text13" numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </View>
            )}
            <Pressable
              className="bg-brand rounded-button px-buttonPrimaryX py-buttonPrimaryY"
              onPress={this.handleRestart}
            >
              <Text className="text-text-always-white text-text14 font-medium">Try again</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
