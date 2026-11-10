import { httpError } from "./errors.js";

export const IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export function imageContentType(
  buffer: Buffer,
  label = "image"
): string {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return "image/jpeg";
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  throw httpError(400, `Use a PNG, JPEG, or WebP ${label}`);
}
