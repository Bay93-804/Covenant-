import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../src/design-system';
import { getProgramContent } from '../../../src/content';
import { useAuth } from '../../../src/lib/auth/AuthContext';
import { clearAllDemoStorage } from '../../../src/lib/demo/storage';
import { env } from '../../../src/lib/env';
import { useProfileSummary } from '../../../src/lib/profile/useProfileSummary';

export default function ProfileScreen() {
  const { user, isDemoMode, signOut } = useAuth();
  const { data: profile } = useProfileSummary();
  const content = getProgramContent();
  const [resetArmed, setResetArmed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/sign-in');
  }

  async function handleConfirmReset() {
    setResetting(true);
    try {
      await clearAllDemoStorage();
      setResetArmed(false);
      setResetDone(true);
    } finally {
      setResetting(false);
    }
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

      {isDemoMode ? (
        <Card className="mb-4">
          <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
            DEMO DATA
          </AppText>
          <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
            Clears every demo account and its local data from this device — a clean slate for
            testing, separate from deleting a single account.
          </AppText>
          {resetDone ? (
            <AppText variant="bodySm" color="accent">
              Local demo data cleared.
            </AppText>
          ) : resetArmed ? (
            <View className="gap-2">
              <AppText variant="bodySm" color="danger">
                This cannot be undone. Reset local demo data?
              </AppText>
              <Button variant="danger" onPress={handleConfirmReset} loading={resetting}>
                Confirm Reset
              </Button>
              <Button variant="ghost" onPress={() => setResetArmed(false)}>
                Cancel
              </Button>
            </View>
          ) : (
            <Button variant="secondary" onPress={() => setResetArmed(true)}>
              Reset Local Demo Data
            </Button>
          )}
        </Card>
      ) : null}

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
          PRIVACY & SUPPORT
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          Privacy policy:{' '}
          {env.PRIVACY_URL ?? 'Not yet published — see docs/phase5/RELEASE_GUIDE.md'}
        </AppText>
        <AppText variant="bodySm" color="secondary">
          Support: {env.SUPPORT_URL ?? 'Not yet published — see docs/phase5/RELEASE_GUIDE.md'}
        </AppText>
      </Card>

      <Divider className="mb-4" />

      <View className="gap-3">
        <Button variant="danger" onPress={handleSignOut}>
          Sign Out
        </Button>
        <Button variant="ghost" onPress={() => router.push('/(tabs)/profile/delete-account')}>
          Delete Account
        </Button>
      </View>
    </Screen>
  );
}
