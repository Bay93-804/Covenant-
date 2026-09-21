import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { TabIcon } from '../../src/design-system';
import { color, semanticColor } from '../../src/design-system/tokens';
import { ConnectivityBanner } from '../../src/features/shared/ConnectivityBanner';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: color.navy[900] }}>
      <ConnectivityBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: semanticColor.accentPrimary,
          tabBarInactiveTintColor: color.silver[400],
          tabBarStyle: {
            backgroundColor: color.navy[950],
            borderTopColor: color.navy[700],
            height: 84,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: 'Today',
            tabBarIcon: ({ focused }) => <TabIcon glyph="●" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="program"
          options={{
            title: 'Program',
            tabBarIcon: ({ focused }) => <TabIcon glyph="▤" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ focused }) => <TabIcon glyph="▲" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="testing"
          options={{
            title: 'Testing',
            tabBarIcon: ({ focused }) => <TabIcon glyph="◆" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon glyph="◐" focused={focused} />,
          }}
        />
      </Tabs>
    </View>
  );
}
