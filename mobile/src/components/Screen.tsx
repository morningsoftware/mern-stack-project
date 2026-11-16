import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, text } from '../theme';

export interface ScreenProps {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pad for the on-screen keyboard (forms). */
  keyboard?: boolean;
  /** False inside tabs, where the tab bar already clears the home indicator. */
  bottomInset?: boolean;
}

export function Screen({ children, onRefresh, refreshing = false, keyboard = false, bottomInset = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const scroll = (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={[styles.content, { paddingBottom: space.xxl + (bottomInset ? insets.bottom : 0) }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.select({ ios: 'interactive', android: 'on-drag', default: 'none' })}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.forest} colors={[colors.forest]} /> : undefined}>
      {children}
    </ScrollView>
  );
  if (!keyboard) return scroll;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{scroll}</KeyboardAvoidingView>;
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: string }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={text.heading}>{title}</Text>
        {aside ? <Text style={text.small}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 680, alignSelf: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
});
