import { memo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radius, text } from '../theme';
import { MAX_SCREENSHOTS } from '../lib/images';
import type { PickedImage } from '../lib/images';
import { formatBytes } from '../lib/format';

const statusText: Record<PickedImage['status'], string> = { ready: 'Ready to attach', uploading: 'Uploading…', done: 'Attached', error: 'Upload failed' };

/** Photo picker with a preview of every chosen screenshot, before and during upload. */
export const ScreenshotPicker = memo(function ScreenshotPicker({ images, onPick, onRemove, disabled = false, error, max = MAX_SCREENSHOTS, hint }: {
  images: PickedImage[]; onPick: () => void; onRemove: (uri: string) => void; disabled?: boolean; error?: string; max?: number; hint?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={text.label}>Screenshots <Text style={styles.optional}>(optional, up to {max})</Text></Text>
      <Text style={text.small}>{hint ?? 'PNG, JPEG or WebP, up to 2 MB each. Only you and the project team can see them.'}</Text>
      {images.map((image, index) => (
        <View key={image.uri} style={styles.item}>
          <Image source={{ uri: image.uri }} accessibilityLabel={`Preview of screenshot ${index + 1}`} resizeMode="cover" style={styles.thumb} />
          <View style={styles.info}>
            <Text style={text.label}>Screenshot {index + 1}</Text>
            <View style={styles.statusRow}>
              {image.status === 'uploading' && <ActivityIndicator size="small" color={colors.forest} />}
              <Text style={[text.small, image.status === 'error' && { color: colors.error }, image.status === 'done' && { color: colors.successText }]}>
                {statusText[image.status]}{image.size ? ` · ${formatBytes(image.size)}` : ''}
              </Text>
            </View>
            {image.error ? <Text accessibilityRole="alert" style={styles.itemError}>{image.error}</Text> : null}
          </View>
          {image.status !== 'done' && image.status !== 'uploading' && !disabled ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove screenshot ${index + 1}`} hitSlop={6} onPress={() => onRemove(image.uri)} style={styles.remove}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {images.length < max ? <Button title={images.length ? 'Add another screenshot' : 'Choose screenshot'} variant="secondary" onPress={onPick} disabled={disabled} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.itemError}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  optional: { fontWeight: '400', color: colors.muted },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.inputBg },
  thumb: { width: 72, height: 72, borderRadius: 3, backgroundColor: colors.neutralBg },
  info: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemError: { fontSize: 14, lineHeight: 20, color: colors.error },
  remove: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  removeText: { fontSize: 15, fontWeight: '600', color: colors.error },
});
