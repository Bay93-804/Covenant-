/**
 * Chalk-style month calendar + daily agenda for the Program tab.
 *
 * All date math comes from ./monthCalendar.ts (string-only, timezone-safe).
 * Cells are memoized so changing the selection re-renders only the two
 * affected cells, which keeps month paging and taps snappy on small iPhones.
 */
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Badge, Card } from '../../design-system';
import { a11y, color, semanticColor } from '../../design-system/tokens';
import type { IsoDate } from '../schedule/dateUtils';
import {
  addMonths,
  buildAgenda,
  buildMonthGrid,
  dayStatus,
  formatLongDate,
  isSameMonth,
  monthLabel,
  monthOf,
  weekdayHeaders,
  type AgendaAction,
  type AgendaItem,
  type DayStatus,
  type MonthRef,
  type TestingDay,
} from './monthCalendar';
import type { DayCalendarEntry, DayCalendarState } from './useProgramCalendar';

const STATUS_LABEL: Record<DayStatus, string> = {
  scheduled: 'workout scheduled',
  completed: 'workout completed',
  in_progress: 'workout in progress',
  missed: 'workout missed or incomplete',
  rest: 'rest day',
  none: 'nothing scheduled',
};

/** Marker shapes differ as well as colors, so status never relies on color alone. */
function StatusMark({ status, onSelected }: { status: DayStatus; onSelected: boolean }) {
  const ink = onSelected ? semanticColor.accentOnAccent : undefined;
  switch (status) {
    case 'completed':
      return (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: ink ?? semanticColor.success,
          }}
        />
      );
    case 'in_progress':
      return (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: ink ?? semanticColor.accentPrimary,
            backgroundColor: ink ? 'transparent' : color.gold[800],
          }}
        />
      );
    case 'scheduled':
      return (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: ink ?? color.bone[300],
          }}
        />
      );
    case 'missed':
      return (
        <AppText
          variant="caption"
          style={{ color: ink ?? semanticColor.danger, fontSize: 10, lineHeight: 10 }}
        >
          ✕
        </AppText>
      );
    case 'rest':
      return (
        <View
          style={{
            width: 8,
            height: 2,
            borderRadius: 1,
            backgroundColor: ink ?? color.silver[500],
          }}
        />
      );
    default:
      return <View style={{ height: 7 }} />;
  }
}

function TestingMark({ onSelected }: { onSelected: boolean }) {
  return (
    <View
      style={{
        width: 6,
        height: 6,
        transform: [{ rotate: '45deg' }],
        backgroundColor: onSelected ? semanticColor.accentOnAccent : semanticColor.accentPrimary,
      }}
    />
  );
}

const DayCell = memo(function DayCell({
  date,
  status,
  isTesting,
  isToday,
  isSelected,
  weekLabel,
  onSelect,
}: {
  date: IsoDate;
  status: DayStatus;
  isTesting: boolean;
  isToday: boolean;
  isSelected: boolean;
  weekLabel: string | null;
  onSelect: (date: IsoDate) => void;
}) {
  const dayNumber = Number(date.slice(8, 10));
  const a11yLabel = [
    formatLongDate(date, true),
    isToday ? 'today' : null,
    weekLabel,
    STATUS_LABEL[status],
    isTesting ? 'testing day' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onSelect(date)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: isSelected }}
      style={{ flex: 1, minHeight: a11y.minTouchTarget + 4, padding: 2 }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          borderWidth: isToday && !isSelected ? 1.5 : 0,
          borderColor: semanticColor.accentPrimary,
          backgroundColor: isSelected ? semanticColor.accentPrimary : 'transparent',
          gap: 3,
        }}
      >
        <AppText
          variant="body"
          weight={isToday || isSelected ? '700' : '500'}
          color={
            isSelected ? 'onAccent' : isToday ? 'accent' : status === 'none' ? 'muted' : 'primary'
          }
          allowFontScaling={false}
        >
          {dayNumber}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 8 }}>
          <StatusMark status={status} onSelected={isSelected} />
          {isTesting ? <TestingMark onSelected={isSelected} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

function Legend() {
  const items: { label: string; node: ReactNode }[] = [
    { label: 'Scheduled', node: <StatusMark status="scheduled" onSelected={false} /> },
    { label: 'Done', node: <StatusMark status="completed" onSelected={false} /> },
    { label: 'Missed', node: <StatusMark status="missed" onSelected={false} /> },
    { label: 'Rest', node: <StatusMark status="rest" onSelected={false} /> },
    { label: 'Testing', node: <TestingMark onSelected={false} /> },
  ];
  return (
    <View
      className="flex-row flex-wrap mt-3"
      style={{ columnGap: 14, rowGap: 6 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 10, alignItems: 'center' }}>{item.node}</View>
          <AppText variant="caption" color="muted">
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function HeaderButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: a11y.minTouchTarget,
        minHeight: a11y.minTouchTarget,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: pressed ? semanticColor.surfaceCard : 'transparent',
      })}
    >
      <AppText variant="h3" color="accent">
        {label}
      </AppText>
    </Pressable>
  );
}

const STATE_BADGE: Record<
  DayCalendarState,
  { label: string; tone: 'gold' | 'neutral' | 'success' | 'danger' }
> = {
  completed: { label: 'Completed', tone: 'success' },
  in_progress: { label: 'In progress', tone: 'gold' },
  missed: { label: 'Missed', tone: 'danger' },
  today: { label: 'Today', tone: 'gold' },
  upcoming: { label: 'Scheduled', tone: 'neutral' },
  rest: { label: 'Rest', tone: 'neutral' },
};

function runAction(action: AgendaAction) {
  switch (action.kind) {
    case 'review':
      router.push({
        pathname: '/workout/[sessionId]/summary',
        params: { sessionId: action.sessionId, mode: 'review' },
      });
      return;
    case 'resume':
      router.push({
        pathname: '/workout/[sessionId]/player',
        params: { sessionId: action.sessionId },
      });
      return;
    case 'start_today':
      // Today owns the readiness check + safety-adjustment gate before a session starts.
      router.navigate('/(tabs)/today');
      return;
    case 'view_day':
      router.push({ pathname: '/(tabs)/program/day/[date]', params: { date: action.date } });
      return;
    case 'open_testing':
      router.navigate('/(tabs)/testing');
      return;
  }
}

function AgendaCard({ item }: { item: AgendaItem }) {
  if (item.type === 'rest') {
    return (
      <Card className="mb-3">
        <AppText variant="overline" color="muted">
          WEEK {item.weekNumber} · DAY {item.dayNumber}
        </AppText>
        <AppText variant="h3" color="secondary" style={{ marginTop: 4 }}>
          {item.title}
        </AppText>
        <AppText variant="bodySm" color="muted" style={{ marginTop: 4 }}>
          {item.note}
        </AppText>
      </Card>
    );
  }

  const isWorkout = item.type === 'workout';
  const badge = isWorkout ? STATE_BADGE[item.state] : null;
  const a11yLabel = isWorkout
    ? `${item.slot.toUpperCase()} ${item.title}, week ${item.weekNumber} day ${item.dayNumber}` +
      `${item.durationLabel ? `, ${item.durationLabel}` : ''}, ${badge!.label}. ${item.actionLabel}`
    : `${item.title}. ${item.actionLabel}`;

  return (
    <Pressable
      onPress={() => runAction(item.action)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card className="mb-3" emphasized={isWorkout && item.state === 'today'}>
        <View className="flex-row items-center justify-between mb-1" style={{ gap: 8 }}>
          <AppText variant="overline" color="accent" style={{ flexShrink: 1 }}>
            {isWorkout
              ? `${item.slot.toUpperCase()} · WEEK ${item.weekNumber} · DAY ${item.dayNumber}`
              : 'TESTING'}
          </AppText>
          {badge ? (
            <Badge label={badge.label} tone={badge.tone} />
          ) : (
            <Badge label="Testing" tone="gold" />
          )}
        </View>
        <AppText variant="h3" color="primary">
          {item.title}
        </AppText>
        <View className="flex-row items-center justify-between mt-2" style={{ gap: 8 }}>
          <AppText variant="bodySm" color="secondary" style={{ flexShrink: 1 }}>
            {isWorkout
              ? [
                  item.durationLabel ? `≈ ${item.durationLabel}` : null,
                  item.adjusted ? 'Adjusted' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || ' '
              : 'Baseline & retest markers'}
          </AppText>
          <AppText variant="button" color="accent">
            {item.actionLabel} ›
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

export interface ProgramCalendarProps {
  todayIso: IsoDate;
  /** Date to select on open (e.g. Week 1, Day 1 after a restart); defaults to today. Re-key the component to re-apply. */
  initialDate?: IsoDate | null;
  week1StartDate: IsoDate;
  entriesByDate: Map<IsoDate, DayCalendarEntry>;
  testingByDate: Map<IsoDate, TestingDay>;
}

export function ProgramCalendar({
  todayIso,
  initialDate,
  week1StartDate,
  entriesByDate,
  testingByDate,
}: ProgramCalendarProps) {
  const [selected, setSelected] = useState<IsoDate>(initialDate ?? todayIso);
  const [visibleMonth, setVisibleMonth] = useState<MonthRef>(() =>
    monthOf(initialDate ?? todayIso),
  );

  const rows = useMemo(() => buildMonthGrid(visibleMonth, 0), [visibleMonth]);
  const headers = useMemo(() => weekdayHeaders(0), []);

  const onSelect = useCallback((date: IsoDate) => setSelected(date), []);
  const goToday = useCallback(() => {
    setSelected(todayIso);
    setVisibleMonth(monthOf(todayIso));
  }, [todayIso]);

  const agenda = useMemo(
    () => buildAgenda(selected, entriesByDate.get(selected), testingByDate.get(selected)),
    [selected, entriesByDate, testingByDate],
  );
  const selectedEntry = entriesByDate.get(selected);
  const viewingToday = selected === todayIso && isSameMonth(visibleMonth, monthOf(todayIso));

  return (
    <View>
      <Card className="mb-4" style={{ paddingHorizontal: 8 }}>
        <View className="flex-row items-center justify-between mb-2">
          <HeaderButton
            label="‹"
            accessibilityLabel="Previous month"
            onPress={() => setVisibleMonth((m) => addMonths(m, -1))}
          />
          <AppText variant="h3" color="primary" accessibilityRole="header">
            {monthLabel(visibleMonth)}
          </AppText>
          <View className="flex-row items-center">
            {!viewingToday ? (
              <Pressable
                onPress={goToday}
                accessibilityRole="button"
                accessibilityLabel="Jump to today"
                hitSlop={6}
                style={{
                  minHeight: 32,
                  paddingHorizontal: 10,
                  justifyContent: 'center',
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: semanticColor.accentPrimary,
                  marginRight: 2,
                }}
              >
                <AppText variant="caption" color="accent" weight="700">
                  Today
                </AppText>
              </Pressable>
            ) : null}
            <HeaderButton
              label="›"
              accessibilityLabel="Next month"
              onPress={() => setVisibleMonth((m) => addMonths(m, 1))}
            />
          </View>
        </View>

        <View
          className="flex-row"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {headers.map((h, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <AppText variant="overline" color="muted">
                {h}
              </AppText>
            </View>
          ))}
        </View>

        {rows.map((row, r) => (
          <View key={r} className="flex-row">
            {row.map((date, c) => {
              if (!date) return <View key={c} style={{ flex: 1 }} />;
              const entry = entriesByDate.get(date);
              const weekLabel = entry
                ? `week ${entry.scheduledDay.weekNumber} day ${entry.scheduledDay.dayOfWeek + 1}`
                : null;
              return (
                <DayCell
                  key={date}
                  date={date}
                  status={dayStatus(entry)}
                  isTesting={testingByDate.has(date)}
                  isToday={date === todayIso}
                  isSelected={date === selected}
                  weekLabel={weekLabel}
                  onSelect={onSelect}
                />
              );
            })}
          </View>
        ))}

        <View style={{ paddingHorizontal: 8 }}>
          <Legend />
        </View>
      </Card>

      <View className="mb-2">
        <AppText variant="overline" color="accent">
          {selected === todayIso
            ? 'TODAY'
            : selectedEntry
              ? `WEEK ${selectedEntry.scheduledDay.weekNumber}`
              : 'AGENDA'}
        </AppText>
        <AppText
          variant="h2"
          color="primary"
          style={{ marginBottom: 12 }}
          accessibilityRole="header"
        >
          {formatLongDate(selected)}
        </AppText>
      </View>

      {agenda.length > 0 ? (
        agenda.map((item) => <AgendaCard key={item.key} item={item} />)
      ) : (
        <Card className="mb-3">
          <AppText variant="body" color="secondary">
            {selected < week1StartDate
              ? `Nothing scheduled. Week 1 begins ${formatLongDate(week1StartDate, true)}.`
              : 'Nothing scheduled — this date is outside your current 12-week run.'}
          </AppText>
        </Card>
      )}
    </View>
  );
}
