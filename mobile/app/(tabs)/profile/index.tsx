import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../src/design-system';
import { getProgramContent } from '../../../src/content';
import { useAuth } from '../../../src/lib/auth/AuthContext';
import { useProfileSummary } from '../../../src/lib/profile/useProfileSummary';

export default function ProfileScreen() {
  const { user, isDemoMode, signOut } = useAuth();
  const { data: profile } = useProfileSummary();
  const content = getProgramContent();

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 20 }}>
        Profile
      </AppText>

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
          NAME
        </AppText>
        <AppText variant="body" color="primary" style={{ marginBottom: 12 }}>
          {profile?.displayName || '—'}
        </AppText>

        <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
          EMAIL
        </AppText>
        <AppText variant="body" color="primary" style={{ marginBottom: 12 }}>
          {user?.email ?? '—'}
        </AppText>

        <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
          UNITS
        </AppText>
        <AppText variant="body" color="primary">
          {profile?.unitsWeight?.toUpperCase() ?? 'LB'} ·{' '}
          {profile?.unitsDistance?.toUpperCase() ?? 'MI'}
        </AppText>
      </Card>

      {isDemoMode ? (
        <Card className="mb-4" emphasized>
          <View className="flex-row items-center gap-2 mb-2">
            <Badge label="Demo mode" tone="gold" />
          </View>
          <AppText variant="bodySm" color="secondary">
            No Supabase connection is configured. Your account and program data live only on this
            device.
          </AppText>
        </Card>
      ) : null}

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
          PROGRAM
        </AppText>
        <AppText variant="body" color="primary">
          {content.meta.title} — Edition {content.meta.edition}
        </AppText>
      </Card>

      <Divider className="mb-4" />

      <Button variant="danger" onPress={handleSignOut}>
        Sign Out
      </Button>
    </Screen>
  );
}
