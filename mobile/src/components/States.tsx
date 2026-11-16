import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, radius, text } from '../theme';
import { Button } from './Button';

type BannerTone = 'error' | 'success' | 'info';

const bannerColors: Record<BannerTone, { bg: string; border: string; fg: string }> = {
  error: { bg: colors.errorBg, border: colors.errorBorder, fg: colors.error },
  success: { bg: colors.successBg, border: colors.successBorder, fg: colors.successText },
  info: { bg: colors.warnBg, border: colors.warnBorder, fg: colors.warnText },
};

/** Inline status message. Errors are announced as alerts, other tones politely. */
export function Banner({ tone = 'info', message, actionLabel, onAction }: { tone?: BannerTone; message?: string; actionLabel?: string; onAction?: () => void }) {
  if (!message) return null;
  const set = bannerColors[tone];
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: set.bg, borderColor: set.border }]}>
      <Text style={[styles.bannerText, { color: set.fg }]}>{message}</Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant={tone === 'error' ? 'danger' : 'secondary'} /> : null}
    </View>
  );
}

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator accessibilityLabel={label} size="large" color={colors.forest} />
      <Text style={text.body}>{label}</Text>
    </View>
  );
}

function usePulse() {
  const [opacity] = useState(() => new Animated.Value(1));
  const [reduce, setReduce] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduce); }, []);
  useEffect(() => {
    if (reduce) { opacity.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduce]);
  return opacity;
}

/** Placeholder cards shown while a list loads for the first time. */
export function SkeletonList({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  const opacity = usePulse();
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <Animated.View key={index} style={[styles.skeleton, { opacity }]}>
          <View style={[styles.skeletonLine, { width: '55%', height: 18 }]} />
          <View style={[styles.skeletonLine, { width: '90%' }]} />
          <View style={[styles.skeletonLine, { width: '70%' }]} />
        </Animated.View>
      ))}
    </View>
  );
}

export function ErrorState({ message, onRetry, title = 'Something went wrong' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <View style={styles.state}>
      <Text accessibilityRole="header" style={text.heading}>{title}</Text>
      <Text style={[text.body, { color: colors.error }]} accessibilityRole="alert">{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" style={styles.stateButton} /> : null}
    </View>
  );
}

/** Says what to do next and offers the action when one exists (DESIGN.md empty-state rule). */
export function EmptyState({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.state}>
      <Text accessibilityRole="header" style={text.heading}>{title}</Text>
      <Text style={text.body}>{body}</Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.stateButton} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { gap: 10, padding: 12, borderWidth: 1, borderRadius: radius },
  bannerText: { fontSize: 15, lineHeight: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.paper, padding: 24 },
  skeleton: { gap: 10, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.surface },
  skeletonLine: { height: 12, borderRadius: 2, backgroundColor: colors.border },
  state: { gap: 10, padding: 20, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius, backgroundColor: colors.surface },
  stateButton: { alignSelf: 'flex-start', marginTop: 4 },
});
