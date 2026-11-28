import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageResizeMode, StyleProp, ViewStyle } from 'react-native';
import { api } from '../lib/session';
import { colors, radius } from '../theme';

/**
 * Shows a private screenshot. Images are served only to signed-in reporters and team members,
 * so the request carries the bearer token: native sends it as an image header, web fetches a blob.
 */
export function AuthImage({ path, label, resizeMode = 'cover', style }: { path: string; label: string; resizeMode?: ImageResizeMode; style?: StyleProp<ViewStyle> }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; uri: string | null; failed: boolean }>({ key: '', uri: null, failed: false });
  const key = `${path}:${attempt}`;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(api.url(path), { headers: api.authHeaders() })
      .then(response => { if (!response.ok) throw new Error('failed'); return response.blob(); })
      .then(blob => { objectUrl = URL.createObjectURL(blob); if (!cancelled) setState({ key, uri: objectUrl, failed: false }); })
      .catch(() => { if (!cancelled) setState({ key, uri: null, failed: true }); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, key]);

  const current = state.key === key ? state : null;
  const failed = current?.failed ?? false;
  const uri = Platform.OS === 'web' ? current?.uri ?? null : api.url(path);

  return (
    <View style={[styles.frame, style]}>
      {uri && !failed ? (
        <Image accessibilityLabel={label} source={{ uri, headers: api.authHeaders() }} resizeMode={resizeMode} style={StyleSheet.absoluteFill}
          onError={() => setState({ key, uri: null, failed: true })} />
      ) : failed ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} failed to load. Retry`} onPress={() => setAttempt(n => n + 1)} style={styles.center}>
          <Text style={styles.failed}>Could not load. Tap to retry.</Text>
        </Pressable>
      ) : (
        <View style={styles.center}><ActivityIndicator color={colors.forest} /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.neutralBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  failed: { fontSize: 12.5, textAlign: 'center', color: colors.muted },
});
