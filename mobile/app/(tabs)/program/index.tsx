import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Badge, Card, Screen } from '../../../src/design-system';
import { semanticColor } from '../../../src/design-system/tokens';
import { getProgramContent } from '../../../src/content';
import { useEnrollmentSchedule } from '../../../src/features/program/useEnrollmentSchedule';
import { useProgramCalendar } from '../../../src/features/program/useProgramCalendar';

type BlockFilter = 'all' | 1 | 2 | 3;

export default function ProgramScreen() {
  const content = getProgramContent();
  const { isLoading: scheduleLoading } = useEnrollmentSchedule();
  const { data: weeks, isLoading: calendarLoading } = useProgramCalendar();
  const [filter, setFilter] = useState<BlockFilter>('all');

  if (scheduleLoading || calendarLoading || !weeks) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const visibleWeeks = weeks.filter((w) => {
    if (filter === 'all') return true;
    const block = content.blocks.find((b) => b.weeks.includes(w.weekNumber));
    return block?.id === filter;
  });

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 4 }}>
        Program
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 16 }}>
        {content.meta.durationWeeks} weeks · {content.meta.daysPerWeekTrained} training days/week
      </AppText>

      <View className="flex-row gap-2 mb-5 flex-wrap">
        {(['all', 1, 2, 3] as BlockFilter[]).map((f) => {
          const selected = filter === f;
          const label = f === 'all' ? 'All' : `Block ${f}`;
          return (
            <Pressable
              key={String(f)}
              onPress={() => setFilter(f)}
              style={{
                minHeight: 36,
                paddingHorizontal: 14,
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: selected ? semanticColor.accentPrimary : semanticColor.borderSubtle,
                backgroundColor: selected ? semanticColor.accentPrimary : 'transparent',
              }}
            >
              <AppText variant="bodySm" color={selected ? 'onAccent' : 'primary'} weight="600">
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Card className="mb-4">
        <View className="flex-row items-center justify-between">
          <AppText variant="h3" color="primary">
            Week 0
          </AppText>
          <Badge label="Baseline testing" tone="neutral" />
        </View>
        <AppText variant="bodySm" color="secondary" style={{ marginTop: 6 }}>
          Full testing across all 15 markers, completed before Week 1 begins. See the Testing tab.
        </AppText>
      </Card>

      {visibleWeeks.map((week) => {
        const block = content.blocks.find((b) => b.weeks.includes(week.weekNumber));
        const weekContext = week.days[0]?.scheduledDay.weekContext;
        const isCurrent = week.days.some((d) => d.amState === 'today' || d.pmState === 'today');

        return (
          <Pressable
            key={week.weekNumber}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/program/week/[weekNumber]',
                params: { weekNumber: String(week.weekNumber) },
              })
            }
          >
            <Card className="mb-3" emphasized={isCurrent}>
              <View className="flex-row items-center justify-between mb-2">
                <AppText variant="h3" color="primary">
                  Week {week.weekNumber}
                  {block ? ` · ${block.name}` : ''}
                </AppText>
                {isCurrent ? <Badge label="This week" tone="gold" /> : null}
              </View>
              <View className="flex-row items-center gap-2 flex-wrap mb-2">
                {weekContext?.isDeload ? <Badge label="Deload" tone="neutral" /> : null}
                {weekContext?.isRetest ? <Badge label="Retest" tone="gold" /> : null}
                {weekContext?.isTaperAndTest ? <Badge label="Test week" tone="gold" /> : null}
              </View>
              <AppText variant="bodySm" color="secondary">
                {week.completedSlots}/{week.totalTrainingSlots} sessions completed
                {week.missedSlots > 0 ? ` · ${week.missedSlots} missed` : ''}
              </AppText>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
