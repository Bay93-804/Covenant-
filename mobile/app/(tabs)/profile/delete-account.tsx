import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, Screen, TextField } from '../../../src/design-system';
import {
  AccountDeletionError,
  deleteAccountWithReauth,
} from '../../../src/lib/accountDeletion/deleteAccount';
import { useAuth } from '../../../src/lib/auth/AuthContext';

const CONFIRM_PHRASE = 'DELETE';

/**
 * Self-service account deletion: explains exactly what's deleted, requires
 * re-entering the password (reauthentication, also enforced server-side)
 * and typing DELETE before the destructive action is enabled. See
 * src/lib/accountDeletion/deleteAccount.ts for what happens in each mode.
 */
export default function DeleteAccountScreen() {
  const { user, isDemoMode, signIn, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const canSubmit = password.length > 0 && confirmText.trim() === CONFIRM_PHRASE && !loading;

  async function handleDelete() {
    if (submitting.current) return;
    if (!user?.email) {
      setError('No signed-in account found.');
      return;
    }
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      await deleteAccountWithReauth({
        userId: user.id,
        email: user.email,
        password,
        reauthenticate: signIn,
      });
      // Session is already cleared locally; this also clears the React
      // Query cache so nothing from the deleted account stays in memory.
      await signOut().catch(() => {});
      router.replace('/(auth)/sign-in');
    } catch (e) {
      setError(
        e instanceof AccountDeletionError
          ? e.message
          : 'Account deletion failed. Nothing was deleted — please try again.',
      );
      if (e instanceof AccountDeletionError && e.code === 'reauth_failed') setPassword('');
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <AppText variant="overline" color="danger" style={{ marginTop: 16 }}>
        DANGER ZONE
      </AppText>
      <AppText variant="h2" color="danger" style={{ marginBottom: 16 }}>
        Delete your account
      </AppText>

      <Card className="mb-4" emphasized>
        <AppText variant="body" color="primary" style={{ marginBottom: 8 }}>
          Deletion is permanent. It removes:
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Your sign-in, profile, and notification preferences
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Every program run — current and archived — with all logged workouts and sets
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Readiness check-ins, safety adjustments, and pickup-sport entries
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Every Week 0/6/12 testing result, exercise max, and personal record
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 8 }}>
          • All of the above stored on this device{isDemoMode ? '' : ' and in the cloud'}
        </AppText>
        <AppText variant="bodySm" color="danger" weight="600">
          This cannot be undone, and Coach Conde cannot recover it.
        </AppText>
      </Card>

      {isDemoMode ? (
        <Card className="mb-4">
          <AppText variant="bodySm" color="secondary">
            Demo mode: this deletes the local demo account only — there is no cloud record to
            remove.
          </AppText>
        </Card>
      ) : null}

      <TextField
        label="Confirm your password"
        required
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <TextField
        label={`Type ${CONFIRM_PHRASE} to confirm`}
        required
        autoCapitalize="characters"
        autoCorrect={false}
        value={confirmText}
        onChangeText={setConfirmText}
        editable={!loading}
      />

      {error ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert">
          <AppText variant="bodySm" color="danger" style={{ marginBottom: 12 }}>
            {error}
          </AppText>
        </View>
      ) : null}

      <View className="gap-3 mb-8">
        <Button
          variant="danger"
          onPress={handleDelete}
          loading={loading}
          disabled={!canSubmit}
          testID="confirm-delete-account"
        >
          Permanently Delete Account
        </Button>
        <Button variant="secondary" onPress={() => router.back()} disabled={loading}>
          Cancel
        </Button>
      </View>
    </Screen>
  );
}
