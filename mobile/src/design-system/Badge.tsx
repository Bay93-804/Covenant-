import { View } from 'react-native';

import { AppText } from './Text';

export type BadgeTone = 'gold' | 'neutral' | 'danger' | 'success';

const toneClasses: Record<BadgeTone, string> = {
  gold: 'bg-gold-900 border-gold-600',
  neutral: 'bg-navy-600 border-navy-500',
  danger: 'bg-navy-700 border-danger',
  success: 'bg-navy-700 border-success',
};

const toneTextColor: Record<BadgeTone, 'accent' | 'secondary' | 'danger' | 'primary'> = {
  gold: 'accent',
  neutral: 'secondary',
  danger: 'danger',
  success: 'primary',
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return (
    <View className={`self-start rounded-full border px-3 py-1 ${toneClasses[tone]}`}>
      <AppText variant="overline" color={toneTextColor[tone]}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}
