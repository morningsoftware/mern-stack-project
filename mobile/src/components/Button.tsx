import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius, touch } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

const palette: Record<Variant, { bg: string; border: string; fg: string; pressed: string }> = {
  primary: { bg: colors.rust, border: colors.rust, fg: colors.surface, pressed: colors.rustDark },
  secondary: { bg: colors.surface, border: colors.rust, fg: colors.rust, pressed: colors.neutralBg },
  danger: { bg: colors.surface, border: colors.error, fg: colors.error, pressed: colors.errorBg },
};

export interface ButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: Variant;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({ title, onPress, variant = 'primary', busy = false, busyLabel, disabled = false, style, accessibilityHint }: ButtonProps) {
  const colorSet = palette[variant];
  const inactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={() => { void onPress(); }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? colorSet.pressed : colorSet.bg, borderColor: colorSet.border, opacity: disabled && !busy ? 0.5 : 1 },
        style,
      ]}>
      {busy && <ActivityIndicator size="small" color={colorSet.fg} />}
      <Text style={[styles.label, { color: colorSet.fg }]} numberOfLines={2}>{busy ? busyLabel ?? title : title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: touch, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius, borderWidth: 1 },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
