import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Banner, Button, Card, Field, Screen } from '../../components';
import type { InputRef } from '../../components/Field';
import { useSession } from '../../lib/session';
import { colors, space, text } from '../../theme';

export default function SignIn() {
  const session = useSession();
  const [form, setForm] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState({ username: false, password: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const passwordRef = useRef<InputRef>(null);

  const errors = {
    username: form.username.trim() ? '' : 'Enter your username.',
    password: form.password ? '' : 'Enter your password.',
  };
  const update = (name: 'username' | 'password', value: string) => { setForm(current => ({ ...current, [name]: value })); setError(''); };
  const touch = (name: 'username' | 'password') => setTouched(current => ({ ...current, [name]: true }));

  async function submit() {
    if (lock.current) return;
    setTouched({ username: true, password: true });
    if (errors.username || errors.password) return;
    lock.current = true; setPending(true); setError('');
    try {
      await session.signIn({ username: form.username.trim(), password: form.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Try again.');
    } finally {
      lock.current = false; setPending(false);
    }
  }

  return (
    <Screen keyboard>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <Image source={require('../../../assets/checkpoint-logo.png')} accessibilityLabel="checkpoint" resizeMode="contain" style={styles.logo} />
        <Text accessibilityRole="header" style={text.title}>Playtest, then report.</Text>
        <Text style={text.body}>Test builds, share feedback and report bugs with a screenshot. Use your existing checkpoint account.</Text>
      </View>
      <Card>
        {session.error ? (
          <View style={{ gap: space.sm }}>
            <Banner tone="error" message={session.error} />
            <Button title="Retry saved session" variant="secondary" onPress={session.retry} />
            <Button title="Clear saved session" variant="secondary" onPress={session.signOut} />
          </View>
        ) : null}
        <Banner tone="error" message={error} />
        <Field label="Username" value={form.username} onChangeText={value => update('username', value)} onBlur={() => touch('username')}
          error={touched.username ? errors.username : ''} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username"
          returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} editable={!pending} />
        <Field label="Password" inputRef={passwordRef} value={form.password} onChangeText={value => update('password', value)} onBlur={() => touch('password')}
          error={touched.password ? errors.password : ''} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
          autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} editable={!pending}
          action={<Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={10} onPress={() => setShowPassword(value => !value)}>
            <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable>} />
        <Button title="Sign in" busy={pending} busyLabel="Signing in…" onPress={submit} />
      </Card>
      <View style={styles.footer}>
        <Text style={text.body}>New to playtesting?</Text>
        <Button title="Create a playtester account" variant="secondary" disabled={pending} onPress={() => router.push('/register')} />
        <Text style={text.small}>Project administration and planning stay in the desktop workspace.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.md, paddingTop: space.lg },
  logo: { width: 210, height: 70, alignSelf: 'flex-start' },
  toggle: { fontSize: 15, fontWeight: '600', color: colors.rust },
  footer: { gap: space.md },
});
