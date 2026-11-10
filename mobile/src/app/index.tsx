import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Button, Card, Field, Notice, Screen, styles } from '../components/ui';
import { useSession } from '../lib/session';
export default function SignIn() {
  const session = useSession();
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', email: '', displayName: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const update = (name: string, value: string) => setForm(f => ({ ...f, [name]: value }));
  if (session.user) return <Redirect href="/projects" />;
  async function submit() {
    if (lock.current) return;
    if (!form.username.trim() || !form.password || register && (!form.displayName.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim()) || form.password.length < 8)) {
      setError(register ? 'Enter a username, display name, valid email and password of at least 8 characters.' : 'Enter your username and password.'); return;
    }
    lock.current = true; setPending(true); setError('');
    try { await session.signIn(register ? { ...form, username: form.username.trim(), email: form.email.trim(), displayName: form.displayName.trim(), role: 'playtester' } : { username: form.username.trim(), password: form.password }, register); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); }
    finally { lock.current = false; setPending(false); }
  }
  return <Screen title={register ? 'Join the playtest' : 'Playtest, then report.'} publicScreen>
    <Text style={styles.text}>A focused companion for testing builds, sharing feedback and reporting bugs. Use your existing checkpoint account.</Text>
    <Card><Notice text={error || session.error} error />
      {session.error && <Button title="Retry saved session" secondary onPress={session.retry} />}
      {session.error && <Button title="Clear saved session" secondary onPress={() => { void session.signOut(); }} />}
      <Field label="Username" value={form.username} onChangeText={v => update('username', v)} autoCapitalize="none" autoCorrect={false} autoComplete="username" editable={!pending} />
      {register && <><Field label="Display name" value={form.displayName} onChangeText={v => update('displayName', v)} editable={!pending} />
        <Field label="Email" value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!pending} /></>}
      <Field label="Password" value={form.password} onChangeText={v => update('password', v)} secureTextEntry autoCapitalize="none" autoComplete={register ? 'new-password' : 'current-password'} editable={!pending} onSubmitEditing={() => { void submit(); }} />
      <Button title={register ? 'Create playtester account' : 'Sign in'} onPress={() => { void submit(); }} busy={pending} />
      <Button title={register ? 'I already have an account' : 'Create an account'} secondary disabled={pending} onPress={() => { setRegister(v => !v); setError(''); }} />
    </Card>
    <View><Text style={styles.muted}>Project administration and planning stay in the desktop workspace.</Text></View>
  </Screen>;
}
