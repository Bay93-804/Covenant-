import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { AppText } from '../Text';
import { color, semanticColor } from '../tokens';

export interface LineTrendPoint {
  label: string;
  value: number | null;
}

const CHART_HEIGHT = 90;
const CHART_WIDTH = 320;
const PADDING = 10;

/**
 * A single-series line trend for readiness/RHR-style data over a 12-week
 * dataset. Built on react-native-svg (already a dependency — no new
 * package). Handles: a single data point (renders one dot, no line), gaps
 * from missing data (the line breaks rather than interpolating across a
 * missing week), and an all-zero or flat series (the y-axis always spans at
 * least the data's own min/max with a small margin, never an artificially
 * exaggerated scale). Every value is also listed as plain text beneath the
 * chart, since an SVG polyline alone is not readable by a screen reader.
 */
export function LineTrendChart({
  title,
  points,
  valueSuffix = '',
}: {
  title: string;
  points: LineTrendPoint[];
  valueSuffix?: string;
}) {
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const summary = points
    .map((p) => `${p.label}: ${p.value == null ? 'no data' : `${p.value}${valueSuffix}`}`)
    .join('; ');

  if (values.length === 0) {
    return (
      <View accessible accessibilityLabel={`${title}. No data yet.`}>
        <AppText variant="bodySm" color="muted">
          No data yet.
        </AppText>
      </View>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const domainMin = min - span * 0.1;
  const domainMax = max + span * 0.1;
  const domainSpan = domainMax - domainMin || 1;

  const plotWidth = CHART_WIDTH - PADDING * 2;
  const plotHeight = CHART_HEIGHT - PADDING * 2;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    if (p.value == null) return null;
    const x = PADDING + i * stepX;
    const y = PADDING + plotHeight - ((p.value - domainMin) / domainSpan) * plotHeight;
    return { x, y };
  });

  // Break the polyline into contiguous runs so a missing week never draws a
  // straight line across the gap.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const c of coords) {
    if (c) current.push(c);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);

  return (
    <View accessible accessibilityLabel={`${title}. ${summary}`}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Line
          x1={PADDING}
          y1={CHART_HEIGHT - PADDING}
          x2={CHART_WIDTH - PADDING}
          y2={CHART_HEIGHT - PADDING}
          stroke={semanticColor.borderSubtle}
          strokeWidth={1}
        />
        {segments.map((seg, i) =>
          seg.length > 1 ? (
            <Polyline
              key={i}
              points={seg.map((c) => `${c.x},${c.y}`).join(' ')}
              fill="none"
              stroke={color.gold[500]}
              strokeWidth={2}
            />
          ) : null,
        )}
        {coords.map((c, i) =>
          c ? <Circle key={i} cx={c.x} cy={c.y} r={3} fill={color.gold[400]} /> : null,
        )}
      </Svg>
      <View className="flex-row justify-between mt-1">
        <AppText variant="caption" color="muted">
          {points[0]?.label}
        </AppText>
        <AppText variant="caption" color="muted">
          {points[points.length - 1]?.label}
        </AppText>
      </View>
      <AppText variant="caption" color="secondary" style={{ marginTop: 4 }}>
        Range: {min}
        {valueSuffix} – {max}
        {valueSuffix}
      </AppText>
    </View>
  );
}
