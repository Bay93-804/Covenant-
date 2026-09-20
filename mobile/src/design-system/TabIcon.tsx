import { View } from 'react-native';

import { color, semanticColor } from './tokens';
import { AppText } from './Text';

/**
 * Minimal glyph-in-a-ring tab icon. Deliberately not an icon-font library —
 * keeps the tab bar in the same disciplined, unadorned register as the rest
 * of the brand rather than reaching for generic outline icon sets.
 */
export function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: focused ? 1.5 : 0,
        borderColor: semanticColor.accentPrimary,
      }}
    >
      <AppText
        variant="bodySm"
        weight="700"
        style={{ color: focused ? semanticColor.accentPrimary : color.silver[400] }}
      >
        {glyph}
      </AppText>
    </View>
  );
}
