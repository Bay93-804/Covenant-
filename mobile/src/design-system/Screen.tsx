import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

interface ScreenProps extends PropsWithChildren, Pick<ViewProps, 'style'> {
  scroll?: boolean;
  edges?: readonly Edge[];
  padded?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * Standard full-bleed Midnight Navy screen container. Use `scroll` for forms
 * and long content, leave it off for screens that manage their own layout
 * (e.g. tab roots with sticky headers).
 */
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom', 'left', 'right'],
  padded = true,
  className = '',
  contentClassName = '',
  style,
}: ScreenProps) {
  const paddingClass = padded ? 'px-5' : '';

  if (scroll) {
    return (
      <SafeAreaView edges={edges} className={`flex-1 bg-navy-900 ${className}`} style={style}>
        <ScrollView
          className="flex-1"
          contentContainerClassName={`${paddingClass} pb-12 ${contentClassName}`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} className={`flex-1 bg-navy-900 ${className}`} style={style}>
      <View className={`flex-1 ${paddingClass} ${contentClassName}`}>{children}</View>
    </SafeAreaView>
  );
}
