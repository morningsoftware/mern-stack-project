import { Tabs } from 'expo-router';
import { colors, font } from '../../../theme';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.forest },
      headerTintColor: colors.onForest,
      headerTitleStyle: { fontFamily: font.serif, fontWeight: '700', fontSize: 18 },
      headerShadowVisible: false,
      sceneStyle: { backgroundColor: colors.paper },
      tabBarStyle: { backgroundColor: colors.forest, borderTopColor: colors.forestBorder },
      tabBarActiveTintColor: colors.selected,
      tabBarInactiveTintColor: colors.onForestMuted,
      tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
      tabBarLabelPosition: 'beside-icon',
      tabBarIcon: () => null,
      tabBarIconStyle: { display: 'none' },
    }}>
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarLabel: 'Projects', tabBarAccessibilityLabel: 'Projects' }} />
      <Tabs.Screen name="reports" options={{ title: 'My reports', tabBarLabel: 'My reports', tabBarAccessibilityLabel: 'My reports' }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarLabel: 'Account', tabBarAccessibilityLabel: 'Account' }} />
    </Tabs>
  );
}
