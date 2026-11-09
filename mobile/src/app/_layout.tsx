import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
export default function Layout() {
  return <SafeAreaProvider><SessionProvider><StatusBar style="dark" /><Stack screenOptions={{ headerStyle: { backgroundColor: '#f3f0e7' }, headerTintColor: '#29332b', headerTitle: 'checkpoint', contentStyle: { backgroundColor: '#f3f0e7' } }} /></SessionProvider></SafeAreaProvider>;
}
