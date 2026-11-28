import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, text, touch } from '../theme';
import { ratingLabels } from '../lib/models';
import type { Build } from '../lib/models';
import { formatPlatform } from '../lib/format';

export interface Option<T extends string> { value: T; label: string; caption?: string }

/** A single-choice group rendered as equal-width segments (3-5 short options). */
function ChoiceGroupImpl<T extends string>({ label, options, value, onChange, disabled = false, error }: {
  label: string; options: readonly Option<T>[]; value: T | null; onChange: (value: T) => void; disabled?: boolean; error?: string;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={text.label}>{label}</Text>
      <View style={styles.segments}>
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.caption ? `${option.label}, ${option.caption}` : option.label}
              accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && !selected && styles.segmentPressed, disabled && { opacity: 0.55 }]}>
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
              {option.caption ? <Text style={[styles.segmentCaption, selected && { color: colors.onForestMuted }]} numberOfLines={1}>{option.caption}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export const ChoiceGroup = memo(ChoiceGroupImpl) as typeof ChoiceGroupImpl;

export function RatingInput({ value, onChange, disabled, error }: { value: number | null; onChange: (value: number) => void; disabled?: boolean; error?: string }) {
  const options = ratingLabels.map((caption, index) => ({ value: String(index + 1), label: String(index + 1), caption }));
  return <ChoiceGroup label="Overall rating" options={options} value={value === null ? null : String(value)} onChange={next => onChange(Number(next))} disabled={disabled} error={error} />;
}

/** Radio list for choosing which build a report or feedback refers to. */
export const BuildPicker = memo(function BuildPicker({ label = 'Build', builds, value, onChange, disabled = false, noneLabel = 'General, not tied to one build' }: {
  label?: string; builds: Build[]; value: string; onChange: (id: string) => void; disabled?: boolean; noneLabel?: string;
}) {
  const rows = [{ id: '', title: noneLabel, caption: '' }, ...builds.map(build => ({ id: build._id, title: `Build ${build.version}`, caption: formatPlatform(build.platform) }))];
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={text.label}>{label}</Text>
      <View style={styles.list}>
        {rows.map((row, index) => {
          const selected = row.id === value;
          return (
            <Pressable key={row.id || 'none'} accessibilityRole="radio" accessibilityLabel={row.caption ? `${row.title}, ${row.caption}` : row.title} accessibilityState={{ checked: selected, disabled }}
              disabled={disabled} onPress={() => onChange(row.id)}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && { backgroundColor: colors.neutralBg }, disabled && { opacity: 0.55 }]}>
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
              <Text style={[text.body, { flex: 1 }, selected && { fontWeight: '600' }]}>{row.title}</Text>
              {row.caption ? <Text style={text.small}>{row.caption}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

/** Filter or view switcher with optional counts. */
export function SegmentedTabs<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map(option => {
        const selected = option.value === value;
        const label = option.count === undefined ? option.label : `${option.label} (${option.count})`;
        return (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => onChange(option.value)}
            style={[styles.tab, selected && styles.tabSelected]}>
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, minHeight: touch, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius, backgroundColor: colors.inputBg },
  segmentSelected: { backgroundColor: colors.forest, borderColor: colors.forest },
  segmentPressed: { backgroundColor: colors.neutralBg },
  segmentLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  segmentLabelSelected: { color: colors.selected },
  segmentCaption: { fontSize: 11.5, color: colors.muted },
  error: { fontSize: 14, lineHeight: 20, color: colors.error },
  list: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius, backgroundColor: colors.inputBg, overflow: 'hidden' },
  row: { minHeight: touch, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.forest },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.surface, padding: 3, gap: 3 },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderRadius: 2 },
  tabSelected: { backgroundColor: colors.forest },
  tabLabel: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  tabLabelSelected: { color: colors.selected },
});
