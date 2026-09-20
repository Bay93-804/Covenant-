import { Screen, PlaceholderState } from '../../../src/design-system';

export default function ProgressScreen() {
  return (
    <Screen>
      <PlaceholderState
        icon="▲"
        title="Your progress, tracked honestly"
        description="Adherence, load progression, readiness trends, and Week 0/6/12 testing comparisons will live here once you've logged real sessions."
      />
    </Screen>
  );
}
