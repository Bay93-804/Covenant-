import { View } from 'react-native';

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-[1px] bg-navy-600 ${className}`} />;
}
