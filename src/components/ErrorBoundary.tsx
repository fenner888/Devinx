/**
 * ErrorBoundary — catches render crashes and shows a fallback UI
 * with a restart button. The current release keeps diagnostics on-device.
 */

import { Component, type ReactNode } from 'react';
import { Text, Pressable, ScrollView } from 'react-native';
import { captureDiagnostic } from '@lib/diagnostics';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    captureDiagnostic(error);
  }

  handleRestart = () => {
    this.setState({ hasError: false });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView className="flex-1 bg-surface0" edges={['top', 'bottom']}>
          <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6">
            <Text className="font-mono text-failed text-text14 mb-4">{'X_X'}</Text>
            <Text className="text-text-hi text-text17 text-center mb-2">Something went wrong</Text>
            <Text className="text-text-mid text-text13 text-center mb-6">
              The app encountered an unexpected error. Close and reopen DevinX if retrying does
              not help.
            </Text>
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
