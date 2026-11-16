// Screenshot rules. These mirror server/src/images.ts and the bug screenshot
// route (PNG/JPEG/WebP, 2 MB each, three per bug); the server remains authoritative.

export const MAX_SCREENSHOTS = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type UploadStatus = 'ready' | 'uploading' | 'done' | 'error';

export interface PickedImage {
  uri: string;
  mimeType: string;
  size?: number;
  status: UploadStatus;
  error?: string;
}

const extensionTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };

export function mimeFromUri(uri: string): string | null {
  const match = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(uri);
  return match ? extensionTypes[match[1].toLowerCase()] ?? null : null;
}

export type ImageCheck = { ok: true; mimeType: string } | { ok: false; error: string };

export function checkImage(input: { uri: string; mimeType?: string | null; fileSize?: number | null }): ImageCheck {
  const mimeType = input.mimeType || mimeFromUri(input.uri) || 'image/jpeg';
  if (!(IMAGE_TYPES as readonly string[]).includes(mimeType)) {
    return { ok: false, error: 'Choose a PNG, JPEG or WebP screenshot. HEIC photos must be exported to JPEG first.' };
  }
  if (input.fileSize && input.fileSize > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'That image is larger than 2 MB. Choose a smaller screenshot.' };
  }
  return { ok: true, mimeType };
}
