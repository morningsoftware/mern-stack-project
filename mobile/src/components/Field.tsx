import { memo, useState } from 'react';
import type { ComponentRef, ReactNode, Ref } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors, radius, text, touch } from '../theme';

export type InputRef = ComponentRef<typeof TextInput>;

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  inputRef?: Ref<InputRef>;
  /** Small control shown beside the label, such as Show/Hide for passwords. */
  action?: ReactNode;
  /**
   * Long forms pass a field name with stable handlers instead of inline closures, so typing in one
   * field re-renders only that field.
   */
  name?: string;
  onChangeField?: (name: string, value: string) => void;
  onBlurField?: (name: string) => void;
}

export const Field = memo(function Field({ label, hint, error, optional = false, inputRef, action, name, onChangeField, onBlurField, onChangeText, onFocus, onBlur, editable = true, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const count = props.multiline && props.maxLength ? `${(props.value ?? '').length}/${props.maxLength}` : '';
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={text.label}>{label}{optional && <Text style={styles.optional}> (optional)</Text>}</Text>
        {action}
      </View>
      {hint && !error ? <Text style={text.small}>{hint}</Text> : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        editable={editable}
        onChangeText={onChangeField && name !== undefined ? value => onChangeField(name, value) : onChangeText}
        onFocus={event => { setFocused(true); onFocus?.(event); }}
        onBlur={event => { setFocused(false); if (onBlurField && name !== undefined) onBlurField(name); onBlur?.(event); }}
        {...props}
        style={[
          styles.input,
          props.multiline && styles.multiline,
          { borderColor: error ? colors.error : focused ? colors.focus : colors.inputBorder, backgroundColor: editable ? colors.inputBg : colors.neutralBg },
        ]}
      />
      <View style={styles.footer}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <View style={{ flex: 1 }} />}
        {count ? <Text style={styles.count}>{count}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optional: { fontWeight: '400', color: colors.muted },
  input: { minHeight: touch, borderWidth: 1.5, borderRadius: radius, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.ink, ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null) },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  error: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.error },
  count: { fontSize: 13, color: colors.muted },
});
