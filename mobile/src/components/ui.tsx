import React from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../lib/session';

export const colors = { paper: '#f3f0e7', surface: '#fcfaf4', ink: '#29332b', muted: '#5e6759', forest: '#283c31', rust: '#934125', border: '#c9ccbb', error: '#8a251a' };
export const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 700, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  card: { padding: 18, gap: 12, borderColor: colors.border, borderWidth: 1, borderRadius: 4, backgroundColor: colors.surface },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
});
export function Button({ title, onPress, busy = false, disabled = false, secondary = false, selected = false }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: busy || disabled, busy, selected }} disabled={busy || disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: colors.rust,
      backgroundColor: selected ? colors.forest : secondary ? colors.surface : colors.rust, opacity: disabled || busy ? .6 : pressed ? .8 : 1 })}>
    <Text style={{ fontSize: 16, fontWeight: '600', color: secondary && !selected ? colors.rust : colors.surface }}>{busy ? 'Please wait…' : title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={styles.text}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props}
    style={[{ minHeight: props.multiline ? 100 : 48, borderWidth: 1, borderColor: '#8d9586', backgroundColor: colors.surface, borderRadius: 4, padding: 12, fontSize: 16, color: colors.ink, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function Notice({ text, error = false }: { text?: string; error?: boolean }) { return text ? <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.text, { color: error ? colors.error : colors.forest }]}>{text}</Text> : null; }
export function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Heading({ children }: { children: React.ReactNode }) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Choices({ label, values, value, onChange, disabled = false }: { label: string; values: readonly string[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <View style={{ gap: 8 }}><Text style={styles.text}>{label}</Text><View style={styles.row}>{values.map(option => <Button key={option} title={option} secondary selected={option === value} disabled={disabled} onPress={() => onChange(option)} />)}</View></View>;
}
export function Screen({ title, children, refresh, refreshing = false, publicScreen = false }: { title: string; children: React.ReactNode; refresh?: () => void; refreshing?: boolean; publicScreen?: boolean }) {
  const session = useSession();
  if (session.loading) return <View style={[styles.content, { paddingTop: 80 }]}><ActivityIndicator accessibilityLabel="Restoring session" color={colors.forest} /><Text style={styles.text}>Restoring your session…</Text></View>;
  if (!publicScreen && !session.user) return <Redirect href="/" />;
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.forest} /> : undefined}>
      <Image source={require('../../assets/checkpoint-logo.png')} accessibilityLabel="checkpoint" style={{ width: 210, height: 70, alignSelf: 'flex-start' }} resizeMode="contain" />
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  </KeyboardAvoidingView>;
}
