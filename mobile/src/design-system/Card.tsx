import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

interface CardProps extends PropsWithChildren, Pick<ViewProps, 'style'> {
  className?: string;
  emphasized?: boolean;
}

/** Elevated surface used for list rows, session cards, and form sections. */
export function Card({ children, className = '', emphasized = false, style }: CardProps) {
  return (
    <View
      className={`rounded-lg bg-navy-700 border border-navy-600 p-4 ${
        emphasized ? 'border-gold-500' : ''
      } ${className}`}
      style={style}
    >
      {children}
    </View>
  );
}
