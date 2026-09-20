import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, Divider, Screen } from '../../src/design-system';
import { getProgramContent } from '../../src/content';

const pillars = ['Mindset', 'Character', 'Purpose', 'Success'];

export default function WelcomeScreen() {
  const content = getProgramContent();

  return (
    <Screen scroll>
      <View className="mt-10 items-center mb-10">
        <View className="h-20 w-20 items-center justify-center rounded-full border-2 border-gold-500 mb-6">
          <AppText variant="h1" color="accent" weight="700">
            CC
          </AppText>
        </View>
        <AppText variant="display" color="primary" center>
          {content.meta.title}
        </AppText>
        <AppText variant="bodyLg" color="secondary" center style={{ marginTop: 12 }}>
          {content.meta.tagline}
        </AppText>
      </View>

      <Divider className="mb-8" />

      <View className="flex-row flex-wrap justify-center gap-3 mb-10">
        {pillars.map((pillar) => (
          <View key={pillar} className="rounded-full border border-navy-600 px-4 py-2">
            <AppText variant="overline" color="secondary">
              {pillar}
            </AppText>
          </View>
        ))}
      </View>

      <AppText variant="body" color="secondary" center style={{ marginBottom: 32 }}>
        {content.meta.durationWeeks} weeks. Three blocks — Absorb, Build, Express. Let&apos;s set up
        your program.
      </AppText>

      <Button onPress={() => router.push('/(onboarding)/profile-setup')}>Get Started</Button>
    </Screen>
  );
}
