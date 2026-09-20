import { View } from 'react-native';

import { semanticColor } from './tokens';

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View
      className="flex-row items-center justify-center gap-2"
      accessibilityLabel={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              i === current ? semanticColor.accentPrimary : semanticColor.surfaceCardBorder,
          }}
        />
      ))}
    </View>
  );
}
