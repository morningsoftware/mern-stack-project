import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Button, Card, Screen } from '../../../components';
import { confirmAction } from '../../../lib/hooks';
import { initials } from '../../../lib/format';
import { api, useSession } from '../../../lib/session';
import { colors, space, text } from '../../../theme';

export default function Account() {
  const { user, signOut, error } = useSession();
  async function confirmSignOut() {
    if (await confirmAction('Sign out?', 'You will need to sign in again to report bugs or leave feedback.', 'Sign out')) await signOut();
  }
  return (
    <Screen bottomInset={false}>
      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar} accessibilityElementsHidden><Text style={styles.avatarText}>{initials(user?.displayName ?? '')}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={text.heading} numberOfLines={2}>{user?.displayName}</Text>
            <Text style={text.small}>@{user?.username}{user?.role ? ` · ${user.role}` : ''}</Text>
          </View>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
      </Card>
      <Text style={text.small}>Team management, planning and triage stay in the desktop workspace. Your reports and feedback appear there for the team.</Text>
      <Text style={text.mono}>checkpoint {Constants.expoConfig?.version ?? ''} · {api.origin}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.forest },
});
