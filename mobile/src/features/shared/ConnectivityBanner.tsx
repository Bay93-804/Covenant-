import { View } from 'react-native';

import { AppText } from '../../design-system';
import { useSupabaseHealth } from '../../lib/supabase/health';

/**
 * A quiet, dismissable-by-navigating-away banner shown across the signed-in
 * app when the configured Supabase project can't actually be reached (wrong
 * URL, paused project, no connectivity). Renders nothing in demo mode, and
 * nothing while the project is reachable — this is not a general offline
 * indicator (every screen already works offline-first regardless), it's
 * specifically "your data is not syncing right now, and here's why that's
 * not a screen-by-screen mystery."
 */
export function ConnectivityBanner() {
  const { data } = useSupabaseHealth();

  if (!data || data.reachable) return null;

  return (
    <View className="border-b border-danger bg-navy-800 px-4 py-2">
      <AppText variant="bodySm" color="danger" center>
        Can&apos;t reach the server right now — your entries are still saved on this device and will
        sync automatically once connection is restored.
      </AppText>
    </View>
  );
}
