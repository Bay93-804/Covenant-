/**
 * A last-resort render-error boundary for the whole app.
 *
 * React Native has no built-in top-level error boundary — an uncaught
 * render error anywhere in the tree used to just show a red screen (dev) or
 * a blank/frozen screen (release) with no way for the athlete to recover
 * short of force-quitting. This catches that, logs it (locally only — see
 * src/lib/logger.ts), and offers a "Try again" reset rather than a dead
 * screen. It cannot catch errors in event handlers or async code — those
 * are handled separately by the global handlers installed in
 * src/lib/globalErrorHandlers.ts.
 */
import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '../design-system/Text';
import { Button } from '../design-system/Button';
import { Screen } from '../design-system/Screen';
import { logger } from './logger';

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('app', 'Unhandled render error', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <Screen>
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <AppText variant="h2" color="primary" center>
              Something went wrong
            </AppText>
            <AppText variant="body" color="secondary" center>
              The app hit an unexpected error. Your saved workout and testing data is safe — it
              lives on this device (and syncs to your account when connected) independently of this
              screen.
            </AppText>
            <Button onPress={this.reset}>Try again</Button>
          </View>
        </Screen>
      );
    }

    return this.props.children;
  }
}
