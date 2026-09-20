import { View } from 'react-native';

import { AppText } from './Text';
import { Badge } from './Badge';

interface PlaceholderStateProps {
  title: string;
  description: string;
  icon?: string;
  phaseLabel?: string;
}

/**
 * Attractive "coming soon" state for screens whose real functionality lands
 * in a later phase. Never used for the program-content layer itself — only
 * for screen chrome that has no behavior yet (see PRD §6, SCREEN_MAP.md).
 */
export function PlaceholderState({
  title,
  description,
  icon = '◆',
  phaseLabel = 'Coming in a future update',
}: PlaceholderStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <View className="h-16 w-16 items-center justify-center rounded-full border border-gold-600 bg-navy-800">
        <AppText variant="h2" color="accent">
          {icon}
        </AppText>
      </View>
      <AppText variant="h3" color="primary" center>
        {title}
      </AppText>
      <AppText variant="body" color="secondary" center>
        {description}
      </AppText>
      <Badge label={phaseLabel} tone="gold" />
    </View>
  );
}
