import { ScrollView, View } from 'react-native';

import { AppText } from '../Text';
import { color, semanticColor } from '../tokens';

export type BarEmphasis = 'default' | 'good' | 'bad' | 'neutral';

export interface BarTrendPoint {
  label: string;
  /** Null renders as an empty/outline bar — "no data", never a false zero. */
  value: number | null;
  emphasis?: BarEmphasis;
  /** Shown under the bar in addition to the label — e.g. "3/4". */
  sublabel?: string;
}

const emphasisColor: Record<BarEmphasis, string> = {
  default: color.gold[500],
  good: color.success,
  bad: color.danger,
  neutral: color.navy[500],
};

const BAR_AREA_HEIGHT = 96;
const BAR_WIDTH = 28;

/**
 * A bar-per-point trend chart built from plain Views (not SVG) — a flexbox
 * percentage-height bar renders identically and accessibly on iOS, Android,
 * and web with no viewBox/scaling edge cases. Every bar is its own
 * accessible element carrying the exact value in its label (never
 * color-only), the axis always starts at zero (no truncated/deceptive
 * scale), and a missing value renders as a hollow outline rather than a
 * misleading zero-height bar.
 */
export function BarTrendChart({
  title,
  points,
  valueSuffix = '',
  domainMax,
}: {
  title: string;
  points: BarTrendPoint[];
  valueSuffix?: string;
  /** Fixed axis ceiling (e.g. 100 for a percentage chart) — falls back to the data's own max, never below it. */
  domainMax?: number;
}) {
  const dataMax = Math.max(1, ...points.map((p) => p.value ?? 0));
  const max = domainMax != null ? Math.max(domainMax, dataMax) : dataMax;

  const summary = points
    .map((p) => `${p.label}: ${p.value == null ? 'no data' : `${p.value}${valueSuffix}`}`)
    .join('; ');

  return (
    <View accessible accessibilityLabel={`${title}. ${summary}`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View
          className="flex-row items-end"
          style={{ height: BAR_AREA_HEIGHT, gap: 10, paddingHorizontal: 4 }}
        >
          {points.map((p, i) => {
            const heightPct = p.value == null ? 0 : Math.max(2, (p.value / max) * 100);
            const tone = emphasisColor[p.emphasis ?? 'default'];
            return (
              <View key={i} style={{ alignItems: 'center', width: BAR_WIDTH }}>
                <View
                  style={{
                    height: BAR_AREA_HEIGHT,
                    width: BAR_WIDTH,
                    justifyContent: 'flex-end',
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      borderRadius: 4,
                      backgroundColor: p.value == null ? 'transparent' : tone,
                      borderWidth: p.value == null ? 1.5 : 0,
                      borderColor: semanticColor.borderSubtle,
                      borderStyle: p.value == null ? 'dashed' : 'solid',
                    }}
                  />
                </View>
                <AppText variant="caption" color="muted" style={{ marginTop: 4 }} numberOfLines={1}>
                  {p.label}
                </AppText>
                {p.sublabel ? (
                  <AppText variant="caption" color="secondary" numberOfLines={1}>
                    {p.sublabel}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
