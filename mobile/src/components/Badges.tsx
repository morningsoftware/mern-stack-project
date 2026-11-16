import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { formatPlatform, formatStatus } from '../lib/format';
import { bugStatuses } from '../lib/models';

export type Tone = 'neutral' | 'warn' | 'success' | 'danger';

const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.neutralBg, fg: colors.neutralText, border: colors.neutralBorder },
  warn: { bg: colors.warnBg, fg: colors.warnText, border: colors.warnBorder },
  success: { bg: colors.successBg, fg: colors.successText, border: colors.successBorder },
  danger: { bg: colors.errorBg, fg: '#7b291e', border: colors.errorBorder },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const set = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: set.bg, borderColor: set.border }]}>
      <Text style={[styles.label, { color: set.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function statusTone(status: string): Tone {
  if (status === 'in_progress' || status === 'active') return 'warn';
  if (status === 'resolved' || status === 'completed' || status === 'done') return 'success';
  return 'neutral';
}

export function severityTone(severity: string): Tone {
  if (severity === 'high') return 'danger';
  if (severity === 'medium') return 'warn';
  return 'neutral';
}

/** Text label plus color, never color alone (DESIGN.md accessibility rule). */
export function StatusBadge({ status }: { status: string }) {
  return <Badge label={formatStatus(status)} tone={statusTone(status)} />;
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge label={`${formatStatus(severity)} severity`} tone={severityTone(severity)} />;
}

export function PlatformBadge({ platform }: { platform: string }) {
  return <Badge label={formatPlatform(platform)} />;
}

/** Open, In progress, Resolved as three labeled steps so a reporter sees where their report stands. */
export function StatusTrack({ status }: { status: string }) {
  const index = bugStatuses.findIndex(step => step === status);
  return (
    <View accessible accessibilityLabel={`Status: ${formatStatus(status)}${index >= 0 ? `, step ${index + 1} of ${bugStatuses.length}` : ''}`} style={styles.track}>
      {bugStatuses.map((step, position) => {
        const reached = index >= position;
        const current = index === position;
        const tone = reached ? tones[statusTone(index === bugStatuses.length - 1 ? 'resolved' : status)] : null;
        return (
          <View key={step} style={styles.step}>
            <View style={[styles.bar, { backgroundColor: tone ? tone.fg : colors.border }]} />
            <Text style={[styles.stepLabel, current && styles.stepCurrent, !reached && { color: colors.muted }]}>{formatStatus(step)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderRadius: 3 },
  label: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  track: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, gap: 6 },
  bar: { height: 5, borderRadius: 2 },
  stepLabel: { fontSize: 13, color: colors.ink },
  stepCurrent: { fontWeight: '700' },
});
