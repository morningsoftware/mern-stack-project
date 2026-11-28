import { Stack } from 'expo-router';
import { colors, font } from '../../theme';

export default function AppLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.forest },
      headerTintColor: colors.onForest,
      headerTitleStyle: { fontFamily: font.serif, fontWeight: '700', fontSize: 18 },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.paper },
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
      <Stack.Screen name="feedback" options={{ title: 'Playtest feedback' }} />
      <Stack.Screen name="report" options={{ title: 'Report a bug' }} />
      <Stack.Screen name="bug/[id]" options={{ title: 'Bug report' }} />
    </Stack>
  );
}
