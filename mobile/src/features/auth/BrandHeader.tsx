import { View } from 'react-native';

import { AppText } from '../../design-system';

export function BrandHeader({ tagline }: { tagline?: string }) {
  return (
    <View className="items-center mb-10 mt-6">
      <View className="h-16 w-16 items-center justify-center rounded-full border-2 border-gold-500 mb-4">
        <AppText variant="h2" color="accent" weight="700">
          CC
        </AppText>
      </View>
      <AppText variant="h1" color="primary" center>
        The Long Game
      </AppText>
      {tagline ? (
        <AppText variant="bodySm" color="secondary" center style={{ marginTop: 6 }}>
          {tagline}
        </AppText>
      ) : null}
    </View>
  );
}
