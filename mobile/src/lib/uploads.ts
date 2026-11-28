import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { api } from './session';
import { MAX_IMAGE_BYTES, MAX_SCREENSHOTS, checkImage } from './images';
import type { PickedImage } from './images';
import type { Screenshot } from './models';

export async function uploadScreenshot(bugId: string, image: PickedImage): Promise<Screenshot> {
  const body = Platform.OS === 'web' ? await fetch(image.uri).then(response => response.blob()) : new File(image.uri);
  if (body.size > MAX_IMAGE_BYTES) throw new Error('That image is larger than 2 MB. Choose a smaller screenshot.');
  return api.request<Screenshot>(`/api/bug-reports/${encodeURIComponent(bugId)}/screenshots`, {
    method: 'POST',
    headers: { 'Content-Type': image.mimeType },
    body,
  });
}

/**
 * Screenshots chosen on this device, uploaded one at a time to an existing bug report.
 * A failed upload keeps its image and error so it can be retried; the report is never recreated.
 */
export function useImageQueue(limit = MAX_SCREENSHOTS) {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [pickError, setPickError] = useState('');
  const [uploading, setUploading] = useState(false);
  const running = useRef(false);

  const patch = useCallback((uri: string, change: Partial<PickedImage>) => {
    setImages(current => current.map(image => (image.uri === uri ? { ...image, ...change } : image)));
  }, []);

  const pick = useCallback(async () => {
    setPickError('');
    const remaining = limit - images.length;
    if (remaining <= 0) { setPickError(`You can attach up to ${limit} screenshots.`); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: remaining > 1, selectionLimit: remaining, quality: 0.7, exif: false,
      });
      if (result.canceled) return;
      const added: PickedImage[] = [];
      let rejected = '';
      for (const asset of result.assets.slice(0, remaining)) {
        if (images.some(existing => existing.uri === asset.uri)) continue;
        const check = checkImage({ uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize });
        if (check.ok) added.push({ uri: asset.uri, mimeType: check.mimeType, size: asset.fileSize, status: 'ready' });
        else rejected = check.error;
      }
      if (added.length) setImages(current => [...current, ...added]);
      setPickError(rejected);
    } catch {
      setPickError('Could not open your photos. Check that checkpoint can access them in Settings.');
    }
  }, [images, limit]);

  const remove = useCallback((uri: string) => setImages(current => current.filter(image => image.uri !== uri)), []);
  const clear = useCallback(() => setImages([]), []);

  /** Uploads every image that is not already attached. Resolves with how many failed. */
  const upload = useCallback(async (bugId: string): Promise<{ done: number; failed: number }> => {
    if (running.current) return { done: 0, failed: 0 };
    running.current = true;
    setUploading(true);
    let done = 0;
    let failed = 0;
    try {
      for (const image of images.filter(item => item.status !== 'done')) {
        patch(image.uri, { status: 'uploading', error: undefined });
        try {
          await uploadScreenshot(bugId, image);
          patch(image.uri, { status: 'done' });
          done++;
        } catch (err) {
          patch(image.uri, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed.' });
          failed++;
        }
      }
    } finally {
      running.current = false;
      setUploading(false);
    }
    return { done, failed };
  }, [images, patch]);

  return { images, pickError, uploading, pick, remove, clear, upload, setPickError };
}
