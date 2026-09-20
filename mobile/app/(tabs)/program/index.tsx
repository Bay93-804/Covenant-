import { View } from 'react-native';

import { AppText, Badge, Card, Screen } from '../../../src/design-system';
import { getProgramContent } from '../../../src/content';

export default function ProgramScreen() {
  const content = getProgramContent();

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 4 }}>
        Program
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        {content.meta.durationWeeks} weeks · {content.meta.daysPerWeekTrained} training days/week
      </AppText>

      {content.blocks.map((block) => (
        <Card key={block.id} className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <AppText variant="h3" color="primary">
              Block {block.id} · {block.name}
            </AppText>
            <AppText variant="caption" color="muted">
              WEEKS {block.weeks[0]}–{block.weeks[block.weeks.length - 1]}
            </AppText>
          </View>
          <AppText variant="body" color="secondary" style={{ marginBottom: 12 }}>
            {block.narrative}
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            <Badge label={`Deload wk ${block.deloadWeek}`} tone="neutral" />
            {block.retestWeek ? (
              <Badge label={`Retest wk ${block.retestWeek}`} tone="gold" />
            ) : null}
            {block.taperAndTestWeek ? (
              <Badge label={`Test wk ${block.taperAndTestWeek}`} tone="gold" />
            ) : null}
          </View>
        </Card>
      ))}

      <Card>
        <AppText variant="caption" color="secondary" style={{ marginBottom: 6 }}>
          WEEK 0
        </AppText>
        <AppText variant="body" color="primary">
          Full baseline testing across all 15 markers, completed before Week 1 begins.
        </AppText>
      </Card>

      <AppText variant="caption" color="muted" style={{ marginTop: 20 }}>
        Full week-by-week day detail and session logging arrive in a future update.
      </AppText>
    </Screen>
  );
}
