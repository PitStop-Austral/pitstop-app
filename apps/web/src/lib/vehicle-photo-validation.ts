const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

export function validatePhotoFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Elegí una imagen (JPG, PNG o WebP)';
  if (file.size > MAX_PHOTO_SIZE) return 'La foto pesa más de 10 MB. Probá con otra.';
  return null;
}
