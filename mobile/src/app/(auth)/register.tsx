import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Banner, Button, Card, Field, Screen } from '../../components';
import type { InputRef } from '../../components/Field';
import { useSession } from '../../lib/session';
import { space, text } from '../../theme';

type Name = 'displayName' | 'username' | 'email' | 'password';

function validate(form: Record<Name, string>): Record<Name, string> {
  return {
    displayName: form.displayName.trim() ? '' : 'Enter the name teammates should see.',
    username: form.username.trim() ? '' : 'Choose a username.',
    email: /^\S+@\S+\.\S+$/.test(form.email.trim()) ? '' : 'Enter a valid email address.',
    password: form.password.length >= 8 ? '' : 'Use at least 8 characters.',
  };
}

export default function Register() {
  const session = useSession();
  const [form, setForm] = useState<Record<Name, string>>({ displayName: '', username: '', email: '', password: '' });
  const [touched, setTouched] = useState<Record<Name, boolean>>({ displayName: false, username: false, email: false, password: false });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const usernameRef = useRef<InputRef>(null);
  const emailRef = useRef<InputRef>(null);
  const passwordRef = useRef<InputRef>(null);
  const errors = validate(form);

  const update = (name: Name, value: string) => { setForm(current => ({ ...current, [name]: value })); setError(''); };
  const touch = (name: Name) => setTouched(current => ({ ...current, [name]: true }));
  const shown = (name: Name) => (touched[name] ? errors[name] : '');

  async function submit() {
    if (lock.current) return;
    setTouched({ displayName: true, username: true, email: true, password: true });
    if (Object.values(errors).some(Boolean)) { setError('Fix the highlighted fields to continue.'); return; }
    lock.current = true; setPending(true); setError('');
    try {
      await session.signIn({
        username: form.username.trim(), displayName: form.displayName.trim(), email: form.email.trim(), password: form.password, role: 'playtester',
      }, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account. Try again.');
    } finally {
      lock.current = false; setPending(false);
    }
  }

  return (
    <Screen keyboard>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <Image source={require('../../../assets/checkpoint-logo.png')} accessibilityLabel="checkpoint" resizeMode="contain" style={styles.logo} />
        <Text accessibilityRole="header" style={text.title}>Join the playtest</Text>
        <Text style={text.body}>Create a playtester account. It works on the website too.</Text>
      </View>
      <Card>
        <Banner tone="error" message={error} />
        <Field label="Display name" value={form.displayName} onChangeText={value => update('displayName', value)} onBlur={() => touch('displayName')} error={shown('displayName')}
          autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => usernameRef.current?.focus()} editable={!pending} />
        <Field label="Username" inputRef={usernameRef} value={form.username} onChangeText={value => update('username', value)} onBlur={() => touch('username')} error={shown('username')}
          autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} editable={!pending} />
        <Field label="Email" inputRef={emailRef} value={form.email} onChangeText={value => update('email', value)} onBlur={() => touch('email')} error={shown('email')}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} editable={!pending} />
        <Field label="Password" inputRef={passwordRef} hint="At least 8 characters." value={form.password} onChangeText={value => update('password', value)} onBlur={() => touch('password')} error={shown('password')}
          secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} editable={!pending} />
        <Button title="Create account" busy={pending} busyLabel="Creating account…" onPress={submit} />
      </Card>
      <Button title="I already have an account" variant="secondary" disabled={pending} onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.md, paddingTop: space.lg },
  logo: { width: 210, height: 70, alignSelf: 'flex-start' },
});
