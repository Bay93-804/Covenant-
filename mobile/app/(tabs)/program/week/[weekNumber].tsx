import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Badge, Card, Screen } from '../../../../src/design-system';
import {
  useProgramCalendar,
  type DayCalendarState,
} from '../../../../src/features/program/useProgramCalendar';

function stateBadge(
  state: DayCalendarState,
): { label: string; tone: 'gold' | 'neutral' | 'success' | 'danger' } | null {
  switch (state) {
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'in_progress':
      return { label: 'In progress', tone: 'gold' };
    case 'missed':
      return { label: 'Missed', tone: 'danger' };
    case 'today':
      return { label: 'Today', tone: 'gold' };
    case 'upcoming':
      return { label: 'Upcoming', tone: 'neutral' };
    default:
      return null;
  }
}

export default function WeekDetailScreen() {
  const { weekNumber } = useLocalSearchParams<{ weekNumber: string }>();
  const { data: weeks, isLoading } = useProgramCalendar();

  if (isLoading || !weeks) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const week = weeks.find((w) => w.weekNumber === Number(weekNumber));
  if (!week) {
    return (
      <Screen>
        <AppText variant="body" color="secondary" style={{ marginTop: 40 }}>
          Week not found.
        </AppText>
      </Screen>
    );
  }

  const weekContext = week.days[0]?.scheduledDay.weekContext;

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        WEEK {week.weekNumber}
        {weekContext?.block ? ` · ${weekContext.block.name}` : ''}
      </AppText>
      <View className="flex-row items-center gap-2 mb-5 mt-2 flex-wrap">
        {weekContext?.isDeload ? <Badge label="Deload" tone="neutral" /> : null}
        {weekContext?.isRetest ? <Badge label="Retest" tone="gold" /> : null}
        {weekContext?.isTaperAndTest ? <Badge label="Test week" tone="gold" /> : null}
      </View>

      {week.days.map((day) => {
        const amBadge = stateBadge(day.amState);
        const pmBadge = stateBadge(day.pmState);
        return (
          <Pressable
            key={day.scheduledDay.date}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/program/day/[date]',
                params: { date: day.scheduledDay.date },
              })
            }
          >
            <Card className="mb-3">
              <AppText variant="h3" color="primary" style={{ marginBottom: 8 }}>
                {day.scheduledDay.dayLabel} · {day.scheduledDay.date}
              </AppText>
              <View className="flex-row items-center justify-between mb-2">
                <AppText variant="bodySm" color="secondary" style={{ flex: 1 }}>
                  AM · {day.scheduledDay.am.title}
                </AppText>
                <View className="flex-row items-center gap-2">
                  {amBadge ? <Badge label={amBadge.label} tone={amBadge.tone} /> : null}
                  {day.amAdjusted ? <Badge label="Adjusted" tone="gold" /> : null}
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <AppText variant="bodySm" color="secondary" style={{ flex: 1 }}>
                  PM · {day.scheduledDay.pm.title}
                </AppText>
                <View className="flex-row items-center gap-2">
                  {pmBadge ? <Badge label={pmBadge.label} tone={pmBadge.tone} /> : null}
                  {day.pmAdjusted ? <Badge label="Adjusted" tone="gold" /> : null}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
