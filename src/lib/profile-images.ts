/**
 * Ported from includes/profile-images.php. The original used PHP's finfo()
 * to sniff the real file type off the bytes rather than trusting the
 * extension/declared content-type; this does the same via magic-byte
 * signatures for the three formats the original allows.
 */
export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

export function sniffImageMime(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length >= offset + sig.bytes.length && sig.bytes.every((b, i) => buffer[offset + i] === b)) {
      return sig.mime;
    }
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function profileImageUrl(userId: number, checksum: string): string {
  return `/api/profile/photo/${userId}?v=${checksum.slice(0, 16)}`;
}
