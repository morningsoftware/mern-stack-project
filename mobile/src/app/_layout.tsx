import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingScreen } from '../components';
import { SessionProvider, useSession } from '../lib/session';
import { colors } from '../theme';

function Routes() {
  const { user, loading } = useSession();
  if (loading) return <LoadingScreen label="Restoring your session…" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Routes />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
