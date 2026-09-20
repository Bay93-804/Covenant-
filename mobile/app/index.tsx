import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Screen } from '../src/design-system';
import { semanticColor } from '../src/design-system/tokens';
import { useAuth } from '../src/lib/auth/AuthContext';
import { useEnrollmentStatus } from '../src/lib/onboarding/useEnrollmentStatus';

export default function Index() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <RoutedByEnrollment />;
}

function RoutedByEnrollment() {
  const { data, isLoading } = useEnrollmentStatus();

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator color={semanticColor.accentPrimary} style={{ flex: 1 }} />
      </Screen>
    );
  }

  if (!data.hasActiveEnrollment) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)/today" />;
}
